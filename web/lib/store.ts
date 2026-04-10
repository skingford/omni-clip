import type { VideoInfo } from '../../src/types.js';

interface StoreEntry {
  videoInfo: VideoInfo;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const store = new Map<string, StoreEntry>();

export function storeVideo(videoInfo: VideoInfo): string {
  cleanup();
  const token = crypto.randomUUID();
  store.set(token, {
    videoInfo,
    expiresAt: Date.now() + TTL_MS,
  });
  return token;
}

export function getVideo(token: string): VideoInfo | null {
  cleanup();
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  return entry.videoInfo;
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }
}
