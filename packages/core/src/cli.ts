#!/usr/bin/env node

import { resolve } from 'node:path';
import { VideoResolver } from './resolver/index';
import { DouyinAdapter } from './adapters/douyin';
import { YouTubeAdapter } from './adapters/youtube';
import { downloadVideo } from './downloader/index';
import type { DownloadProgress } from './types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function printProgress(progress: DownloadProgress): void {
  const downloaded = formatBytes(progress.downloaded);
  if (progress.percentage !== null && progress.total !== null) {
    const total = formatBytes(progress.total);
    process.stdout.write(`\r  Downloading: ${downloaded} / ${total} (${progress.percentage}%)`);
  } else {
    process.stdout.write(`\r  Downloading: ${downloaded}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
omni-clip - Video downloader

Usage:
  omni-clip <url> [options]

Options:
  -o, --output <dir>   Output directory (default: ./downloads)
  -h, --help           Show this help message

Supported platforms:
  - Douyin (抖音)
  - YouTube

Examples:
  omni-clip https://v.douyin.com/iRNBho5m/
  omni-clip https://www.youtube.com/watch?v=dQw4w9WgXcQ
  omni-clip https://youtu.be/dQw4w9WgXcQ -o ./videos
`);
    process.exit(0);
  }

  // Parse arguments
  let url = '';
  let outputDir = './downloads';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      outputDir = args[++i] ?? './downloads';
    } else if (!args[i].startsWith('-')) {
      url = args[i];
    }
  }

  if (!url) {
    console.error('Error: Please provide a video URL');
    process.exit(1);
  }

  const absoluteOutputDir = resolve(outputDir);

  // Set up resolver with adapters
  const resolver = new VideoResolver();
  resolver.register(new DouyinAdapter());
  resolver.register(new YouTubeAdapter());

  try {
    console.log('Resolving video URL...');
    const videoInfo = await resolver.resolve(url);

    console.log(`\n  Title:    ${videoInfo.title}`);
    console.log(`  Author:   ${videoInfo.author}`);
    console.log(`  Platform: ${videoInfo.platform}`);
    if (videoInfo.hasWatermark) {
      console.log('  Warning:  Watermark-free version not available');
    }
    console.log('');

    const result = await downloadVideo(videoInfo, {
      outputDir: absoluteOutputDir,
      onProgress: printProgress,
    });

    console.log('\n');
    console.log(`  Saved to: ${result.filePath}`);
    console.log(`  Size:     ${formatBytes(result.fileSize)}`);
    console.log('');
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
