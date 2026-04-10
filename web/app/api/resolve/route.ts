import { NextResponse } from 'next/server';
import { resolveVideo } from '@/lib/bridge';
import { storeVideo } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid URL' },
        { status: 400 }
      );
    }

    const videoInfo = await resolveVideo(url.trim());
    const token = storeVideo(videoInfo);

    // Don't expose videoUrl to the client
    const { videoUrl, ...safeInfo } = videoInfo;

    return NextResponse.json({
      success: true,
      data: safeInfo,
      token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve video';
    return NextResponse.json(
      { success: false, error: message },
      { status: 422 }
    );
  }
}
