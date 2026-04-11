export interface TencentDownloadProgress {
  status: 'downloading' | 'merging' | 'done' | 'error';
  percent: number;
  totalSize: string;
  speed: string;
  eta: string;
  fragment: string;
}

// Persist across Next.js dev hot reloads
const globalStore = globalThis as unknown as {
  __downloadProgressMap?: Map<string, TencentDownloadProgress>;
};

function getStore(): Map<string, TencentDownloadProgress> {
  if (!globalStore.__downloadProgressMap) {
    globalStore.__downloadProgressMap = new Map();
  }
  return globalStore.__downloadProgressMap;
}

export function setDownloadProgress(token: string, progress: TencentDownloadProgress) {
  getStore().set(token, progress);
}

export function getDownloadProgress(token: string): TencentDownloadProgress | null {
  return getStore().get(token) ?? null;
}

export function clearDownloadProgress(token: string) {
  getStore().delete(token);
}
