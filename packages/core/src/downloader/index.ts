import { createWriteStream, mkdirSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { DownloadOptions, DownloadProgress, DownloadResult, VideoInfo } from '../types';
import { generateVideoFilename, resolveUniqueFilePath } from '../utils/filename';

const DOWNLOAD_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  Referer: 'https://www.douyin.com/',
};

export async function downloadVideo(
  videoInfo: VideoInfo,
  options: DownloadOptions
): Promise<DownloadResult> {
  const { outputDir, onProgress } = options;

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Determine filename
  const filename =
    options.filename ?? generateVideoFilename(videoInfo.author, videoInfo.title);
  const filePath = resolveUniqueFilePath(outputDir, filename);

  // Follow redirects to get the final CDN URL
  const response = await fetch(videoInfo.videoUrl, {
    headers: DOWNLOAD_HEADERS,
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Download failed: empty response body');
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : null;

  let downloaded = 0;
  const writeStream = createWriteStream(filePath);

  try {
    const reader = response.body.getReader();
    const nodeStream = new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        downloaded += value.byteLength;
        if (onProgress) {
          const progress: DownloadProgress = {
            downloaded,
            total,
            percentage: total ? Math.round((downloaded / total) * 100) : null,
          };
          onProgress(progress);
        }
        this.push(Buffer.from(value));
      },
    });

    await pipeline(nodeStream, writeStream);
  } catch (error) {
    // Clean up partial file
    try {
      writeStream.close();
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  const fileSize = statSync(filePath).size;

  return {
    filePath,
    videoInfo,
    fileSize,
  };
}
