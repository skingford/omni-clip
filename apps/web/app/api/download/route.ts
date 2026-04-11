import { NextResponse } from 'next/server';
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

function getHeadersForPlatform(platform: string): Record<string, string> {
  switch (platform) {
    case 'douyin':
      return DOUYIN_HEADERS;
    case 'youtube':
      return YOUTUBE_HEADERS;
    default:
      return YOUTUBE_HEADERS;
  }
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
