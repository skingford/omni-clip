import { NextResponse } from 'next/server';
import { getDownloadProgress, isChunkedProgress } from '@/lib/download-progress-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ status: 'not_found' });
  }

  const progress = getDownloadProgress(token);
  if (!progress) {
    return NextResponse.json({ status: 'not_found' });
  }

  // Normalize both progress types into a unified response format
  if (isChunkedProgress(progress)) {
    return NextResponse.json({
      status: progress.status,
      percent: progress.percent,
      downloadedBytes: progress.downloadedBytes,
      totalBytes: progress.totalBytes,
      speed: progress.speed,
      eta: progress.eta,
      connections: progress.connections,
    });
  }

  // Tencent/yt-dlp progress (legacy format, kept for backward compatibility)
  return NextResponse.json(progress);
}
