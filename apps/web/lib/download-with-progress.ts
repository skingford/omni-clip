import { SpeedCalculator, formatSpeed, formatEta } from './download-speed';

export interface DownloadProgress {
  /** Bytes received so far */
  loaded: number;
  /** Total bytes expected, or null if Content-Length was absent */
  total: number | null;
  /** 0–100 percentage, or null if total is unknown */
  percent: number | null;
  /** 'server' = yt-dlp downloading on server, 'download' = streaming to client */
  phase?: 'server' | 'download';
  /** Download speed string (e.g. "5.2 MB/s") */
  speed?: string;
  /** Estimated time remaining (e.g. "1:23") */
  eta?: string;
}

interface PollProgressResponse {
  status: 'downloading' | 'merging' | 'done' | 'error' | 'not_found';
  percent?: number;
  totalSize?: string;
  speed?: string;
  eta?: string;
  fragment?: string;
  // Chunked download fields
  downloadedBytes?: number;
  totalBytes?: number;
  connections?: number;
}

/**
 * Fetch a URL and stream the response body, reporting progress via callback.
 * Optionally polls a server-side progress URL while waiting for the response.
 * Returns the completed Blob.
 */
export async function downloadWithProgress(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  pollProgressUrl?: string,
): Promise<Blob> {
  // Start polling server-side progress if URL provided
  let polling = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  if (pollProgressUrl) {
    polling = true;
    pollTimer = setInterval(async () => {
      if (!polling) return;
      try {
        const res = await fetch(pollProgressUrl, { signal });
        if (!res.ok) return;
        const data: PollProgressResponse = await res.json();
        if (data.status === 'downloading' || data.status === 'merging') {
          onProgress({
            loaded: data.downloadedBytes ?? 0,
            total: data.totalBytes ?? null,
            percent: data.percent ?? null,
            phase: 'server',
            speed: data.speed,
            eta: data.eta,
          });
        }
      } catch {
        // Polling failure is not critical
      }
    }, 1000); // Poll every 1s instead of 2s for more responsive progress
  }

  try {
    const res = await fetch(url, { signal });

    // Stop polling once we get the response
    polling = false;
    if (pollTimer) clearInterval(pollTimer);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Download failed (HTTP ${res.status})`);
    }

    const contentLength = res.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : null;

    // Fallback if body is not available
    if (!res.body) {
      const blob = await res.blob();
      onProgress({ loaded: blob.size, total: blob.size, percent: 100, phase: 'download' });
      return blob;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    const speedCalc = new SpeedCalculator();

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.byteLength;
      speedCalc.addBytes(value.byteLength);

      const percent = total != null && total > 0
        ? Math.round((loaded / total) * 100)
        : null;

      const speed = speedCalc.getSpeed();
      const remaining = total != null ? total - loaded : null;
      const etaSec = remaining != null ? speedCalc.getEta(remaining) : null;

      onProgress({
        loaded,
        total,
        percent,
        phase: 'download',
        speed: formatSpeed(speed),
        eta: formatEta(etaSec),
      });
    }

    return new Blob(chunks as BlobPart[], { type: 'video/mp4' });
  } finally {
    polling = false;
    if (pollTimer) clearInterval(pollTimer);
  }
}
