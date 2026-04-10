import { NextResponse } from 'next/server';
import { getVideo } from '@/lib/store';
import { sanitizeFilename } from '@omni-clip/utils/filename.js';

const DOWNLOAD_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  Referer: 'https://www.douyin.com/',
};

async function fetchVideo(videoUrl: string, retries = 2): Promise<Response> {
  // Step 1: Get CDN URL from Douyin play redirect
  const redirectRes = await fetch(videoUrl, {
    headers: DOWNLOAD_HEADERS,
    redirect: 'manual',
  });

  let cdnUrl = videoUrl;
  if (redirectRes.status === 302 || redirectRes.status === 301) {
    cdnUrl = redirectRes.headers.get('location') || videoUrl;
  }

  // Step 2: Fetch video from CDN
  const res = await fetch(cdnUrl, { headers: DOWNLOAD_HEADERS });

  if (!res.ok && retries > 0) {
    // Wait and retry on failure (rate limiting)
    await new Promise((r) => setTimeout(r, 1000));
    return fetchVideo(videoUrl, retries - 1);
  }

  return res;
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
    const cdnResponse = await fetchVideo(videoInfo.videoUrl);

    if (!cdnResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Video source returned ${cdnResponse.status}` },
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
