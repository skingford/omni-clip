import type { VideoInfo } from '../../src/types.js';

interface StoreEntry {
  videoInfo: VideoInfo;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes

// Persist store across Next.js dev hot reloads via globalThis
const g = globalThis as unknown as { __omniClipStore?: Map<string, StoreEntry> };
if (!g.__omniClipStore) {
  g.__omniClipStore = new Map();
}
const store = g.__omniClipStore;

export function storeVideo(videoInfo: VideoInfo): string {
  cleanup();
  const token = crypto.randomUUID();
  store.set(token, {
    videoInfo,
    expiresAt: Date.now() + TTL_MS,
  });
  return token;
}

export function storeBatch(videos: VideoInfo[]): Record<string, string> {
  cleanup();
  const tokens: Record<string, string> = {};
  for (const video of videos) {
    const token = crypto.randomUUID();
    store.set(token, {
      videoInfo: video,
      expiresAt: Date.now() + TTL_MS,
    });
    tokens[video.id] = token;
  }
  return tokens;
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
