import { NextResponse } from 'next/server';
import { getVideo } from '@/lib/store';
import { sanitizeFilename } from '@omni-clip/core/utils/filename';

const DOWNLOAD_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  Referer: 'https://www.douyin.com/',
};

async function fetchFromUrl(url: string): Promise<Response> {
  // Follow Douyin play URL redirect manually
  const redirectRes = await fetch(url, {
    headers: DOWNLOAD_HEADERS,
    redirect: 'manual',
  });

  if (redirectRes.status === 302 || redirectRes.status === 301) {
    const cdnUrl = redirectRes.headers.get('location') || url;
    return fetch(cdnUrl, { headers: DOWNLOAD_HEADERS });
  }

  // Not a redirect — might be a direct CDN URL
  return fetch(url, { headers: DOWNLOAD_HEADERS });
}

async function fetchVideoWithFallbacks(urls: string[]): Promise<Response | null> {
  for (const url of urls) {
    try {
      const res = await fetchFromUrl(url);
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
    // Try all available URLs (primary + CDN mirrors)
    const urls = videoInfo.videoUrls ?? [videoInfo.videoUrl];
    const cdnResponse = await fetchVideoWithFallbacks(urls);

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
    const headers: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    };
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    return new Response(cdnResponse.body, { headers });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Download failed: ${msg}` },
      { status: 502 }
    );
  }
}
