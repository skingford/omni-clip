export type {
  VideoInfo,
  CollectionInfo,
  PlatformAdapter,
  DownloadOptions,
  DownloadProgress,
  DownloadResult,
} from './types';

export { VideoResolver } from './resolver/index';
export { DouyinAdapter } from './adapters/douyin';
export { YouTubeAdapter } from './adapters/youtube';
export { downloadVideo } from './downloader/index';

import { VideoResolver } from './resolver/index';
import { DouyinAdapter } from './adapters/douyin';
import { YouTubeAdapter } from './adapters/youtube';
import { downloadVideo } from './downloader/index';
import type { DownloadOptions, DownloadResult } from './types';

/**
 * Download a video from a supported platform URL.
 * Supports: Douyin (抖音), YouTube
 */
export async function download(
  url: string,
  options: DownloadOptions
): Promise<DownloadResult> {
  const resolver = new VideoResolver();
  resolver.register(new DouyinAdapter());
  resolver.register(new YouTubeAdapter());

  const videoInfo = await resolver.resolve(url);
  return downloadVideo(videoInfo, options);
}
