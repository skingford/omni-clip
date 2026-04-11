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
export { downloadVideo } from './downloader/index';

import { VideoResolver } from './resolver/index';
import { DouyinAdapter } from './adapters/douyin';
import { downloadVideo } from './downloader/index';
import type { DownloadOptions, DownloadResult } from './types';

/**
 * Download a video from a supported platform URL.
 * Currently supports: Douyin (抖音)
 */
export async function download(
  url: string,
  options: DownloadOptions
): Promise<DownloadResult> {
  const resolver = new VideoResolver();
  resolver.register(new DouyinAdapter());

  const videoInfo = await resolver.resolve(url);
  return downloadVideo(videoInfo, options);
}
