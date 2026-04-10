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

    // Resolve single video
    const videoInfo = await resolveVideo(trimmedUrl);
    const token = storeVideo(videoInfo);
    const { videoUrl, ...safeInfo } = videoInfo;

    // Try to resolve collection
    let collection = null;
    try {
      const collectionInfo = await resolveCollection(trimmedUrl);
      if (collectionInfo && collectionInfo.videos.length > 1) {
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
      }
    } catch {
      // Collection resolution failed — still return single video
    }

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
