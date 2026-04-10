import { VideoResolver } from '../../src/resolver/index.js';
import { DouyinAdapter } from '../../src/adapters/douyin.js';
import type { VideoInfo, CollectionInfo } from '../../src/types.js';

let adapter: DouyinAdapter | null = null;
let resolver: VideoResolver | null = null;

function getAdapter(): DouyinAdapter {
  if (!adapter) {
    adapter = new DouyinAdapter();
  }
  return adapter;
}

function getResolver(): VideoResolver {
  if (!resolver) {
    resolver = new VideoResolver();
    resolver.register(getAdapter());
  }
  return resolver;
}

export async function resolveVideo(url: string): Promise<VideoInfo> {
  return getResolver().resolve(url);
}

export async function resolveCollection(url: string): Promise<CollectionInfo | null> {
  const a = getAdapter();
  if (!a.canHandle(url)) return null;
  const canonicalUrl = await a.resolve(url);
  return a.getCollectionInfo(canonicalUrl);
}

export { type VideoInfo, type CollectionInfo };
