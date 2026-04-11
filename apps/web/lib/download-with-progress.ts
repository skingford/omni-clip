export interface DownloadProgress {
  /** Bytes received so far */
  loaded: number;
  /** Total bytes expected, or null if Content-Length was absent */
  total: number | null;
  /** 0–100 percentage, or null if total is unknown */
  percent: number | null;
  /** 'server' = yt-dlp downloading on server, 'download' = streaming to client */
  phase?: 'server' | 'download';
  /** Download speed string from server (e.g. "5.2KiB/s") */
  speed?: string;
  /** Estimated time remaining from server (e.g. "12:34") */
  eta?: string;
}

interface PollProgressResponse {
  status: 'downloading' | 'merging' | 'done' | 'error' | 'not_found';
  percent?: number;
  totalSize?: string;
  speed?: string;
  eta?: string;
  fragment?: string;
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
            loaded: 0,
            total: null,
            percent: data.percent ?? null,
            phase: 'server',
            speed: data.speed,
            eta: data.eta,
          });
        }
      } catch {
        // Polling failure is not critical
      }
    }, 2000);
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

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.byteLength;

      const percent = total != null && total > 0
        ? Math.round((loaded / total) * 100)
        : null;

      onProgress({ loaded, total, percent, phase: 'download' });
    }

    return new Blob(chunks as BlobPart[], { type: 'video/mp4' });
  } finally {
    polling = false;
    if (pollTimer) clearInterval(pollTimer);
  }
}
