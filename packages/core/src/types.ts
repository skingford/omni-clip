export interface VideoInfo {
  id: string;
  title: string;
  author: string;
  description: string;
  videoUrl: string;
  videoUrls?: string[]; // Fallback CDN mirrors
  coverUrl: string;
  duration?: number;
  hasWatermark: boolean;
  platform: string;
}

export interface CollectionInfo {
  id: string;
  name: string;
  desc: string;
  videoCount: number;
  videos: VideoInfo[];
}

export interface PlatformAdapter {
  readonly name: string;
  canHandle(url: string): boolean;
  resolve(url: string): Promise<string>;
  getVideoInfo(url: string): Promise<VideoInfo>;
  getCollectionInfo?(url: string): Promise<CollectionInfo | null>;
}

export interface DownloadOptions {
  outputDir: string;
  filename?: string;
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
  percentage: number | null;
}

export interface DownloadResult {
  filePath: string;
  videoInfo: VideoInfo;
  fileSize: number;
}
