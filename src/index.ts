export type {
  VideoInfo,
  PlatformAdapter,
  DownloadOptions,
  DownloadProgress,
  DownloadResult,
} from './types.js';

export { VideoResolver } from './resolver/index.js';
export { DouyinAdapter } from './adapters/douyin.js';
export { downloadVideo } from './downloader/index.js';

import { VideoResolver } from './resolver/index.js';
import { DouyinAdapter } from './adapters/douyin.js';
import { downloadVideo } from './downloader/index.js';
import type { DownloadOptions, DownloadResult } from './types.js';

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
