export interface VideoData {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  duration?: number;
  hasWatermark: boolean;
  platform: string;
}

export interface CollectionVideoData {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  duration?: number;
  token: string;
}

export interface CollectionData {
  id: string;
  name: string;
  desc: string;
  videoCount: number;
  videos: CollectionVideoData[];
}

export type AppState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'resolved'; video: VideoData; token: string; collection: CollectionData | null; originalUrl: string }
  | { status: 'error'; message: string };
