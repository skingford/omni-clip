import { NextResponse } from 'next/server';
import { getDownloadProgress } from '@/lib/download-progress-store';

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

  return NextResponse.json(progress);
}
