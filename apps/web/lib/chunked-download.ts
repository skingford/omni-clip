/**
 * Server-side parallel chunked download engine.
 * Uses HTTP Range requests to split a file into N chunks and download them concurrently.
 */

const MIN_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB — don't chunk files smaller than this * concurrency
const DEFAULT_CONCURRENCY = 4;
const MAX_RETRIES = 3;
const READ_TIMEOUT_MS = 30_000; // 30s stale-read timeout per chunk

export interface ChunkedDownloadOptions {
  concurrency?: number;
  onProgress?: (progress: ChunkDownloadProgress) => void;
}

export interface ChunkDownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  activeConnections: number;
  speed: number; // bytes/sec
}

export interface RangeProbeResult {
  supportsRange: boolean;
  contentLength: number | null;
}

/**
 * Probe whether a URL supports HTTP Range requests and get content length.
 */
export async function probeRangeSupport(
  url: string,
  headers: Record<string, string>,
): Promise<RangeProbeResult> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers,
      redirect: 'follow',
    });

    if (!res.ok) {
      return { supportsRange: false, contentLength: null };
    }

    const acceptRanges = res.headers.get('accept-ranges');
    const contentLength = res.headers.get('content-length');
    const len = contentLength ? parseInt(contentLength, 10) : null;

    return {
      supportsRange: acceptRanges === 'bytes' || acceptRanges?.includes('bytes') === true,
      contentLength: len && !isNaN(len) ? len : null,
    };
  } catch {
    return { supportsRange: false, contentLength: null };
  }
}

interface ChunkRange {
  index: number;
  start: number;
  end: number; // inclusive
}

function computeChunkRanges(totalBytes: number, concurrency: number): ChunkRange[] {
  const chunkSize = Math.ceil(totalBytes / concurrency);
  const ranges: ChunkRange[] = [];
  for (let i = 0; i < concurrency; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize - 1, totalBytes - 1);
    if (start > totalBytes - 1) break;
    ranges.push({ index: i, start, end });
  }
  return ranges;
}

/**
 * Download a single chunk with Range header. Retries up to MAX_RETRIES on failure.
 * Calls onData for each piece of data received.
 */
async function downloadChunk(
  url: string,
  headers: Record<string, string>,
  range: ChunkRange,
  onData: (data: Uint8Array) => void,
  signal?: AbortSignal,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error('Download aborted');

    try {
      const res = await fetch(url, {
        headers: {
          ...headers,
          Range: `bytes=${range.start}-${range.end}`,
        },
        redirect: 'follow',
        signal,
      });

      if (!res.ok && res.status !== 206) {
        throw new Error(`Chunk ${range.index} HTTP ${res.status}`);
      }

      if (!res.body) throw new Error(`Chunk ${range.index}: empty body`);

      const reader = res.body.getReader();

      for (;;) {
        // Stale-read timeout: if no data for READ_TIMEOUT_MS, abort and retry
        const readPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('Read timeout')), READ_TIMEOUT_MS);
          // Clean up timer if read completes first
          readPromise.then(() => clearTimeout(timer), () => clearTimeout(timer));
        });

        const { done, value } = await Promise.race([readPromise, timeoutPromise]);
        if (done) break;
        if (value) onData(value);
      }

      return; // Success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (signal?.aborted) throw lastError;

      // Exponential backoff before retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError ?? new Error(`Chunk ${range.index} failed after ${MAX_RETRIES} retries`);
}

/**
 * Download a file using parallel Range-based chunks.
 * Returns a ReadableStream that yields data in correct byte order.
 */
export function downloadParallelChunks(
  url: string,
  headers: Record<string, string>,
  contentLength: number,
  options: ChunkedDownloadOptions = {},
): ReadableStream<Uint8Array> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const onProgress = options.onProgress;

  // If file is too small for chunking, just use 1 chunk
  const effectiveConcurrency =
    contentLength < MIN_CHUNK_SIZE * concurrency ? 1 : concurrency;

  const ranges = computeChunkRanges(contentLength, effectiveConcurrency);

  // Track progress
  let totalDownloaded = 0;
  let activeConnections = 0;
  const startTime = Date.now();

  function reportProgress() {
    if (!onProgress) return;
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = elapsed > 0 ? totalDownloaded / elapsed : 0;
    onProgress({
      downloadedBytes: totalDownloaded,
      totalBytes: contentLength,
      activeConnections,
      speed,
    });
  }

  // Ordered assembly: buffers[i] holds data for chunk i until it can be flushed
  const chunkBuffers: Uint8Array[][] = ranges.map(() => []);
  const chunkDone: boolean[] = ranges.map(() => false);
  let nextFlushIndex = 0;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let streamClosed = false;

  const abortController = new AbortController();

  function tryFlush() {
    while (nextFlushIndex < ranges.length && chunkDone[nextFlushIndex]) {
      const buffers = chunkBuffers[nextFlushIndex];
      for (const buf of buffers) {
        if (!streamClosed) {
          try {
            controller.enqueue(buf);
          } catch {
            // Stream may have been cancelled by client
            streamClosed = true;
            abortController.abort();
            return;
          }
        }
      }
      chunkBuffers[nextFlushIndex] = []; // Free memory
      nextFlushIndex++;
    }

    // All chunks flushed
    if (nextFlushIndex >= ranges.length && !streamClosed) {
      streamClosed = true;
      try {
        controller.close();
      } catch { /* already closed */ }
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;

      // Launch all chunk downloads concurrently
      const promises = ranges.map(async (range) => {
        activeConnections++;
        try {
          await downloadChunk(
            url,
            headers,
            range,
            (data) => {
              totalDownloaded += data.byteLength;
              chunkBuffers[range.index].push(data);
              reportProgress();

              // If this chunk is the next expected one, try flushing incrementally
              if (range.index === nextFlushIndex) {
                // Don't flush yet — wait until chunk is fully done for simplicity
              }
            },
            abortController.signal,
          );
          chunkDone[range.index] = true;
          tryFlush();
        } catch (err) {
          if (!streamClosed) {
            streamClosed = true;
            try {
              controller.error(err instanceof Error ? err : new Error(String(err)));
            } catch { /* already errored */ }
          }
        } finally {
          activeConnections--;
          reportProgress();
        }
      });

      // If all promises reject, ensure stream is closed
      Promise.allSettled(promises).then(() => {
        if (!streamClosed) {
          // All chunks should be done or errored by now
          tryFlush();
        }
      });
    },

    cancel() {
      streamClosed = true;
      abortController.abort();
    },
  });

  return stream;
}

/**
 * Determine whether to use parallel chunked download.
 * Returns the content length if parallel download should be used, null otherwise.
 */
export async function shouldUseParallelDownload(
  url: string,
  headers: Record<string, string>,
  minSize: number = 5 * 1024 * 1024, // 5MB threshold
): Promise<{ useParallel: boolean; contentLength: number | null }> {
  const probe = await probeRangeSupport(url, headers);

  if (!probe.supportsRange || !probe.contentLength) {
    return { useParallel: false, contentLength: probe.contentLength };
  }

  if (probe.contentLength < minSize) {
    return { useParallel: false, contentLength: probe.contentLength };
  }

  return { useParallel: true, contentLength: probe.contentLength };
}
