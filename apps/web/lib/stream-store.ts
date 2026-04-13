interface StreamEntry {
  streamUrl: string;
  type: 'hls' | 'mp4';
  baseUrl: string;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const g = globalThis as unknown as { __omniClipStreamStore?: Map<string, StreamEntry> };
if (!g.__omniClipStreamStore) {
  g.__omniClipStreamStore = new Map();
}
const store = g.__omniClipStreamStore;

export function storeStream(streamUrl: string, type: 'hls' | 'mp4'): string {
  cleanup();
  const token = crypto.randomUUID();
  // Extract base URL for resolving relative paths in m3u8
  const lastSlash = streamUrl.lastIndexOf('/');
  const baseUrl = lastSlash > 0 ? streamUrl.substring(0, lastSlash + 1) : streamUrl;
  store.set(token, { streamUrl, type, baseUrl, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function getStream(token: string): StreamEntry | null {
  cleanup();
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  // Refresh TTL on access
  entry.expiresAt = Date.now() + TTL_MS;
  return entry;
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }
}
