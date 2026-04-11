import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { getVideo } from '@/lib/store';
import { sanitizeFilename } from '@omni-clip/core/utils/filename';

const DOUYIN_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  Referer: 'https://www.douyin.com/',
};

const YOUTUBE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Origin: 'https://www.youtube.com',
  Referer: 'https://www.youtube.com/',
};

const TENCENT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Referer: 'https://v.qq.com/',
};

function getHeadersForPlatform(platform: string): Record<string, string> {
  switch (platform) {
    case 'douyin':
      return DOUYIN_HEADERS;
    case 'youtube':
      return YOUTUBE_HEADERS;
    case 'tencent':
      return TENCENT_HEADERS;
    default:
      return YOUTUBE_HEADERS;
  }
}

/**
 * Download Tencent Video via yt-dlp (HLS streams can't be proxy-streamed directly).
 * Uses spawn (non-blocking) with concurrent fragments for speed.
 * Downloads to a temp file, then streams it to the client.
 */
async function downloadTencentVideo(
  pageUrl: string,
  filename: string,
): Promise<Response> {
  const tempDir = join(tmpdir(), 'omni-clip-tencent');
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

  const tempFile = join(tempDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);

  // Use spawn to avoid blocking the event loop
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '-f', 'best[ext=mp4]/best',
      '--no-warnings',
      '--merge-output-format', 'mp4',
      '--concurrent-fragments', '5',
      '-o', tempFile,
      pageUrl,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Tencent Video download timed out (10 min limit)'));
    }, 600000); // 10 minutes

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const detail = (stderr || stdout).slice(0, 300);
        console.error(`[download] yt-dlp failed (code=${code}):\n${detail}`);
        reject(new Error(`yt-dlp download failed: ${detail}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  }).catch((e) => {
    try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch { /* ignore */ }
    throw e;
  });

  if (!existsSync(tempFile)) {
    throw new Error('yt-dlp did not produce an output file');
  }

  const fileSize = statSync(tempFile).size;
  const nodeStream = createReadStream(tempFile);

  // Clean up temp file after stream ends or errors
  nodeStream.on('end', () => { try { unlinkSync(tempFile); } catch { /* ignore */ } });
  nodeStream.on('error', () => { try { unlinkSync(tempFile); } catch { /* ignore */ } });

  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(fileSize),
    },
  });
}

async function fetchDouyinUrl(url: string, headers: Record<string, string>): Promise<Response> {
  // Douyin play URLs redirect 301/302 to CDN — follow manually
  const redirectRes = await fetch(url, { headers, redirect: 'manual' });

  if (redirectRes.status === 302 || redirectRes.status === 301) {
    const cdnUrl = redirectRes.headers.get('location') || url;
    return fetch(cdnUrl, { headers });
  }

  // Already a direct CDN URL — return as-is (don't double-fetch)
  return redirectRes;
}

async function fetchVideoUrl(url: string, headers: Record<string, string>, platform: string): Promise<Response> {
  if (platform === 'douyin') {
    return fetchDouyinUrl(url, headers);
  }

  // YouTube and others: just follow redirects automatically
  return fetch(url, { headers, redirect: 'follow' });
}

async function fetchVideoWithFallbacks(
  urls: string[],
  headers: Record<string, string>,
  platform: string,
): Promise<Response | null> {
  for (const url of urls) {
    try {
      const res = await fetchVideoUrl(url, headers, platform);
      if (res.ok) return res;
    } catch {
      // try next URL
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const index = searchParams.get('index') || '';

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Missing token' },
      { status: 400 }
    );
  }

  const videoInfo = getVideo(token);
  if (!videoInfo) {
    return NextResponse.json(
      { success: false, error: 'Token expired — please resolve the video again' },
      { status: 410 }
    );
  }

  try {
    // Tencent Video uses HLS streams — must download via yt-dlp
    if (videoInfo.platform === 'tencent') {
      const cleanTitle = videoInfo.title
        .replace(/#[^\s#]*/g, '')
        .replace(/@[^\s@]*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      const prefix = index ? `${index}-` : '';
      const filename = sanitizeFilename(`${prefix}${cleanTitle || videoInfo.author}`) + '.mp4';
      return await downloadTencentVideo(videoInfo.videoUrl, filename);
    }

    const headers = getHeadersForPlatform(videoInfo.platform);
    const urls = videoInfo.videoUrls ?? [videoInfo.videoUrl];
    const cdnResponse = await fetchVideoWithFallbacks(urls, headers, videoInfo.platform);

    if (!cdnResponse) {
      return NextResponse.json(
        { success: false, error: 'All video sources failed' },
        { status: 502 }
      );
    }

    // Filename: [index-]clean_title.mp4
    const cleanTitle = videoInfo.title
      .replace(/#[^\s#]*/g, '')
      .replace(/@[^\s@]*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const prefix = index ? `${index}-` : '';
    const filename = sanitizeFilename(`${prefix}${cleanTitle || videoInfo.author}`) + '.mp4';

    const contentLength = cdnResponse.headers.get('content-length');
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    };
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    return new Response(cdnResponse.body, { headers: responseHeaders });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Download failed: ${msg}` },
      { status: 502 }
    );
  }
}
