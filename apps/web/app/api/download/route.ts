import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { getVideo } from '@/lib/store';
import { setDownloadProgress, clearDownloadProgress } from '@/lib/download-progress-store';
import { shouldUseParallelDownload, downloadParallelChunks } from '@/lib/chunked-download';
import { formatSpeed, formatEta, SpeedCalculator } from '@/lib/download-speed';
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
/** Parse yt-dlp progress line into structured data. */
function parseYtdlpProgress(line: string): { percent: number; totalSize: string; speed: string; eta: string; fragment: string } | null {
  // Match: [download]  XX.X% of ~YY.YYMIB at ZZKiB/s ETA HH:MM:SS (frag N/M)
  const m = line.match(/\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+([\d:]+)\s+\(frag\s+(\d+\/\d+)\)/);
  if (m) return { percent: parseFloat(m[1]), totalSize: m[2], speed: m[3], eta: m[4], fragment: m[5] };

  // Simpler: [download]  XX.X% of ~YY.YYMIB at ZZKiB/s ETA HH:MM:SS
  const m2 = line.match(/\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+([\d:]+)/);
  if (m2) return { percent: parseFloat(m2[1]), totalSize: m2[2], speed: m2[3], eta: m2[4], fragment: '' };

  return null;
}

async function downloadTencentVideo(
  pageUrl: string,
  filename: string,
  token: string,
): Promise<Response> {
  const tempDir = join(tmpdir(), 'omni-clip-tencent');
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

  const tempFile = join(tempDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);

  setDownloadProgress(token, { status: 'downloading', percent: 0, totalSize: '', speed: '', eta: '', fragment: '' });

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
    let lastLine = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      // yt-dlp writes progress to stdout with \r for in-place updates
      lastLine += chunk.toString();
      const lines = lastLine.split(/[\r\n]/);
      lastLine = lines.pop() ?? '';
      for (const line of lines) {
        const progress = parseYtdlpProgress(line);
        if (progress) {
          setDownloadProgress(token, { status: 'downloading', ...progress });
        } else if (line.includes('[Merger]') || line.includes('[ffmpeg]')) {
          setDownloadProgress(token, { status: 'merging', percent: 100, totalSize: '', speed: '', eta: '', fragment: '' });
        }
      }
    });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Tencent Video download timed out (10 min limit)'));
    }, 600000); // 10 minutes

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        setDownloadProgress(token, { status: 'done', percent: 100, totalSize: '', speed: '', eta: '', fragment: '' });
        resolve();
      } else {
        const detail = (stderr || lastLine).slice(0, 300);
        console.error(`[download] yt-dlp failed (code=${code}):\n${detail}`);
        setDownloadProgress(token, { status: 'error', percent: 0, totalSize: '', speed: '', eta: '', fragment: '' });
        reject(new Error(`yt-dlp download failed: ${detail}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  }).catch((e) => {
    try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch { /* ignore */ }
    clearDownloadProgress(token);
    throw e;
  });

  if (!existsSync(tempFile)) {
    throw new Error('yt-dlp did not produce an output file');
  }

  const fileSize = statSync(tempFile).size;
  const nodeStream = createReadStream(tempFile);

  // Clean up temp file and progress after stream ends or errors
  nodeStream.on('end', () => { try { unlinkSync(tempFile); } catch { /* ignore */ } clearDownloadProgress(token); });
  nodeStream.on('error', () => { try { unlinkSync(tempFile); } catch { /* ignore */ } clearDownloadProgress(token); });

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

/**
 * Resolve Douyin URL to its final CDN URL (following redirects).
 * Needed for Range probe since we need the final URL.
 */
async function resolveDouyinCdnUrl(url: string, headers: Record<string, string>): Promise<string> {
  const redirectRes = await fetch(url, { headers, redirect: 'manual' });
  if (redirectRes.status === 302 || redirectRes.status === 301) {
    return redirectRes.headers.get('location') || url;
  }
  return url;
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

/**
 * Attempt parallel chunked download for a video URL.
 * Returns a Response if parallel download is used, null otherwise.
 */
async function tryParallelDownload(
  urls: string[],
  headers: Record<string, string>,
  platform: string,
  token: string,
  filename: string,
): Promise<Response | null> {
  // Resolve the actual CDN URL (follow redirects for Douyin)
  let cdnUrl: string | null = null;
  for (const url of urls) {
    try {
      if (platform === 'douyin') {
        cdnUrl = await resolveDouyinCdnUrl(url, headers);
      } else {
        // For YouTube, do a HEAD request to get the final URL after redirects
        const headRes = await fetch(url, { method: 'HEAD', headers, redirect: 'follow' });
        if (headRes.ok) {
          cdnUrl = headRes.url;
        }
      }
      if (cdnUrl) break;
    } catch {
      // try next URL
    }
  }

  if (!cdnUrl) return null;

  const { useParallel, contentLength } = await shouldUseParallelDownload(cdnUrl, headers);

  if (!useParallel || !contentLength) return null;

  // Set up progress tracking
  const speedCalc = new SpeedCalculator();

  const stream = downloadParallelChunks(cdnUrl, headers, contentLength, {
    concurrency: 4,
    onProgress: (progress) => {
      speedCalc.addBytes(0); // We track bytes via the progress callback
      const percent = Math.round((progress.downloadedBytes / progress.totalBytes) * 100);
      const speed = progress.speed;
      const remaining = progress.totalBytes - progress.downloadedBytes;
      const etaSec = speed > 0 ? remaining / speed : null;

      setDownloadProgress(token, {
        status: percent >= 100 ? 'done' : 'downloading',
        downloadedBytes: progress.downloadedBytes,
        totalBytes: progress.totalBytes,
        percent,
        speed: formatSpeed(speed),
        eta: formatEta(etaSec),
        connections: progress.activeConnections,
      });
    },
  });

  // Clean up progress when stream completes
  const trackedStream = stream.pipeThrough(new TransformStream({
    flush() {
      clearDownloadProgress(token);
    },
  }));

  return new Response(trackedStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(contentLength),
    },
  });
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
      return await downloadTencentVideo(videoInfo.videoUrl, filename, token);
    }

    const headers = getHeadersForPlatform(videoInfo.platform);
    const urls = videoInfo.videoUrls ?? [videoInfo.videoUrl];

    // Filename: [index-]clean_title.mp4
    const cleanTitle = videoInfo.title
      .replace(/#[^\s#]*/g, '')
      .replace(/@[^\s@]*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const prefix = index ? `${index}-` : '';
    const filename = sanitizeFilename(`${prefix}${cleanTitle || videoInfo.author}`) + '.mp4';

    // Try parallel chunked download first (Douyin/YouTube)
    const parallelResponse = await tryParallelDownload(urls, headers, videoInfo.platform, token, filename);
    if (parallelResponse) {
      return parallelResponse;
    }

    // Fallback: single-stream proxy download
    const cdnResponse = await fetchVideoWithFallbacks(urls, headers, videoInfo.platform);

    if (!cdnResponse) {
      return NextResponse.json(
        { success: false, error: 'All video sources failed' },
        { status: 502 }
      );
    }

    // Set up single-stream progress tracking
    const contentLength = cdnResponse.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : null;

    let trackedBody: ReadableStream | null = cdnResponse.body;

    if (cdnResponse.body && totalBytes) {
      let downloaded = 0;
      const speedCalc = new SpeedCalculator();

      trackedBody = cdnResponse.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          downloaded += chunk.byteLength;
          speedCalc.addBytes(chunk.byteLength);
          const percent = Math.round((downloaded / totalBytes) * 100);
          const speed = speedCalc.getSpeed();
          const etaSec = speedCalc.getEta(totalBytes - downloaded);

          setDownloadProgress(token, {
            status: percent >= 100 ? 'done' : 'downloading',
            downloadedBytes: downloaded,
            totalBytes,
            percent,
            speed: formatSpeed(speed),
            eta: formatEta(etaSec),
            connections: 1,
          });

          controller.enqueue(chunk);
        },
        flush() {
          clearDownloadProgress(token);
        },
      }));
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    };
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    return new Response(trackedBody, { headers: responseHeaders });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Download failed: ${msg}` },
      { status: 502 }
    );
  }
}
