import { NextResponse } from 'next/server';
import { getVideo } from '@/lib/store';
import { sanitizeFilename } from '@omni-clip/utils/filename.js';

const DOWNLOAD_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  Referer: 'https://www.douyin.com/',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Missing token' },
      { status: 400 }
    );
  }

  const videoInfo = getVideo(token);
  if (!videoInfo) {
    return NextResponse.json(
      { success: false, error: 'Token expired or invalid — please resolve the video again' },
      { status: 410 }
    );
  }

  try {
    const cdnResponse = await fetch(videoInfo.videoUrl, {
      headers: DOWNLOAD_HEADERS,
    });

    if (!cdnResponse.ok) {
      return NextResponse.json(
        { success: false, error: `CDN returned HTTP ${cdnResponse.status}` },
        { status: 502 }
      );
    }

    const filename = sanitizeFilename(`${videoInfo.author}-${videoInfo.title}`) + '.mp4';
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
    return NextResponse.json(
      { success: false, error: 'Failed to download video from source' },
      { status: 502 }
    );
  }
}
