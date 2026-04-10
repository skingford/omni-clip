import { VideoResolver } from '../../src/resolver/index.js';
import { DouyinAdapter } from '../../src/adapters/douyin.js';
import type { VideoInfo } from '../../src/types.js';

let resolver: VideoResolver | null = null;

function getResolver(): VideoResolver {
  if (!resolver) {
    resolver = new VideoResolver();
    resolver.register(new DouyinAdapter());
  }
  return resolver;
}

export async function resolveVideo(url: string): Promise<VideoInfo> {
  return getResolver().resolve(url);
}

export { type VideoInfo };
