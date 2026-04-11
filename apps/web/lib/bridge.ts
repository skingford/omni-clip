import { VideoResolver, DouyinAdapter, YouTubeAdapter } from '@omni-clip/core';
import type { VideoInfo, CollectionInfo, PlatformAdapter } from '@omni-clip/core';

let resolver: VideoResolver | null = null;
let adapters: PlatformAdapter[] | null = null;

function getAdapters(): PlatformAdapter[] {
  if (!adapters) {
    adapters = [new DouyinAdapter(), new YouTubeAdapter()];
  }
  return adapters;
}

function getResolver(): VideoResolver {
  if (!resolver) {
    resolver = new VideoResolver();
    for (const adapter of getAdapters()) {
      resolver.register(adapter);
    }
  }
  return resolver;
}

export async function resolveVideo(url: string): Promise<VideoInfo> {
  return getResolver().resolve(url);
}

export async function resolveCollection(url: string): Promise<CollectionInfo | null> {
  // Find the matching adapter and attempt collection resolution
  for (const adapter of getAdapters()) {
    if (adapter.canHandle(url) && adapter.getCollectionInfo) {
      const canonicalUrl = await adapter.resolve(url);
      return adapter.getCollectionInfo(canonicalUrl);
    }
  }
  return null;
}

export { type VideoInfo, type CollectionInfo };
