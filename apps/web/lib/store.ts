import type { VideoInfo } from '@omni-clip/core';

interface StoreEntry {
  videoInfo: VideoInfo;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const LARGE_FILE_TTL_MS = 15 * 60 * 1000; // 15 minutes for large files

// Persist store across Next.js dev hot reloads via globalThis
const g = globalThis as unknown as { __omniClipStore?: Map<string, StoreEntry> };
if (!g.__omniClipStore) {
  g.__omniClipStore = new Map();
}
const store = g.__omniClipStore;

export function storeVideo(videoInfo: VideoInfo, fileSizeHint?: number): string {
  cleanup();
  const token = crypto.randomUUID();
  const ttl = fileSizeHint && fileSizeHint > 100 * 1024 * 1024 ? LARGE_FILE_TTL_MS : TTL_MS;
  store.set(token, {
    videoInfo,
    expiresAt: Date.now() + ttl,
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
  // Refresh TTL on access — keeps token alive during slow downloads (e.g. Tencent HLS)
  entry.expiresAt = Date.now() + TTL_MS;
  return entry.videoInfo;
}

/** Explicitly refresh token TTL without returning video info. */
export function refreshToken(token: string): boolean {
  const entry = store.get(token);
  if (!entry) return false;
  entry.expiresAt = Date.now() + LARGE_FILE_TTL_MS;
  return true;
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }
}
