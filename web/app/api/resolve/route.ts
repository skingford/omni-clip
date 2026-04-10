import { NextResponse } from 'next/server';
import { resolveVideo, resolveCollection } from '@/lib/bridge';
import { storeVideo, storeBatch } from '@/lib/store';

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

    const trimmedUrl = url.trim();

    // Try resolving as single video
    let videoInfo = null;
    let videoError: string | null = null;
    try {
      videoInfo = await resolveVideo(trimmedUrl);
    } catch (e) {
      videoError = e instanceof Error ? e.message : 'Failed to resolve video';
    }

    // Try resolving as collection (independent of single video result)
    let collection = null;
    try {
      const collectionInfo = await resolveCollection(trimmedUrl);
      if (collectionInfo && collectionInfo.videos.length > 0) {
        const tokens = storeBatch(collectionInfo.videos);
        collection = {
          id: collectionInfo.id,
          name: collectionInfo.name,
          desc: collectionInfo.desc,
          videoCount: collectionInfo.videoCount,
          videos: collectionInfo.videos.map((v) => {
            const { videoUrl: _url, ...safe } = v;
            return { ...safe, token: tokens[v.id] };
          }),
        };

        // If single video failed but collection succeeded, use first video
        if (!videoInfo && collectionInfo.videos.length > 0) {
          videoInfo = collectionInfo.videos[0];
        }
      }
    } catch {
      // Collection resolution failed
    }

    // If neither worked, return error
    if (!videoInfo) {
      return NextResponse.json(
        { success: false, error: videoError || 'Could not resolve this URL' },
        { status: 422 }
      );
    }

    const token = storeVideo(videoInfo);
    const { videoUrl, ...safeInfo } = videoInfo;

    return NextResponse.json({
      success: true,
      data: safeInfo,
      token,
      collection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve video';
    return NextResponse.json(
      { success: false, error: message },
      { status: 422 }
    );
  }
}
