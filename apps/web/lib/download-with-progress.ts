export interface DownloadProgress {
  /** Bytes received so far */
  loaded: number;
  /** Total bytes expected, or null if Content-Length was absent */
  total: number | null;
  /** 0–100 percentage, or null if total is unknown */
  percent: number | null;
}

/**
 * Fetch a URL and stream the response body, reporting progress via callback.
 * Returns the completed Blob.
 */
export async function downloadWithProgress(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Download failed (HTTP ${res.status})`);
  }

  const contentLength = res.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : null;

  // Fallback if body is not available (should not happen for download responses)
  if (!res.body) {
    const blob = await res.blob();
    onProgress({ loaded: blob.size, total: blob.size, percent: 100 });
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

    onProgress({ loaded, total, percent });
  }

  return new Blob(chunks as BlobPart[], { type: 'video/mp4' });
}
