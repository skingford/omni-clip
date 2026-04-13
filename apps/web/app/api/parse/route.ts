import { NextResponse } from 'next/server';
import { getVideo } from '@/lib/store';
import { parseVideoUrl } from '@/lib/parse-sources';
import { storeStream } from '@/lib/stream-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing token' },
        { status: 400 }
      );
    }

    const videoInfo = getVideo(token);
    if (!videoInfo) {
      return NextResponse.json(
        { success: false, error: 'Video token expired. Please resolve the URL again.' },
        { status: 404 }
      );
    }

    // Use the stored page URL (videoUrl for tencent is the page URL, not a stream URL)
    const pageUrl = videoInfo.videoUrl;

    const result = await parseVideoUrl(pageUrl);

    // For MP4: return the direct CDN URL so the browser can connect directly
    // (avoids slow server-side proxy; <video> elements don't need CORS).
    // For HLS: use the stream proxy (m3u8 needs URL rewriting).
    if (result.type === 'mp4') {
      return NextResponse.json({
        success: true,
        directUrl: result.streamUrl,
        type: result.type,
      });
    }

    const streamToken = storeStream(result.streamUrl, result.type);
    return NextResponse.json({
      success: true,
      streamToken,
      type: result.type,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse video';
    return NextResponse.json(
      { success: false, error: message },
      { status: 422 }
    );
  }
}
