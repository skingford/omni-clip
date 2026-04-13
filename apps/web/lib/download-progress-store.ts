export interface TencentDownloadProgress {
  status: 'downloading' | 'merging' | 'done' | 'error';
  percent: number;
  totalSize: string;
  speed: string;
  eta: string;
  fragment: string;
}

/** Extended progress for parallel chunk downloads (Douyin/YouTube). */
export interface ChunkedDownloadProgress {
  status: 'downloading' | 'done' | 'error';
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  speed: string;
  eta: string;
  connections: number;
}

export type ServerDownloadProgress = TencentDownloadProgress | ChunkedDownloadProgress;

/** Type guard: is this a chunked download progress? */
export function isChunkedProgress(p: ServerDownloadProgress): p is ChunkedDownloadProgress {
  return 'downloadedBytes' in p;
}

// Persist across Next.js dev hot reloads
const globalStore = globalThis as unknown as {
  __downloadProgressMap?: Map<string, ServerDownloadProgress>;
};

function getStore(): Map<string, ServerDownloadProgress> {
  if (!globalStore.__downloadProgressMap) {
    globalStore.__downloadProgressMap = new Map();
  }
  return globalStore.__downloadProgressMap;
}

export function setDownloadProgress(token: string, progress: ServerDownloadProgress) {
  getStore().set(token, progress);
}

export function getDownloadProgress(token: string): ServerDownloadProgress | null {
  return getStore().get(token) ?? null;
}

export function clearDownloadProgress(token: string) {
  getStore().delete(token);
}
