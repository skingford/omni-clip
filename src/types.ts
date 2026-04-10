export interface VideoInfo {
  id: string;
  title: string;
  author: string;
  description: string;
  videoUrl: string;
  coverUrl: string;
  duration?: number;
  hasWatermark: boolean;
  platform: string;
}

export interface PlatformAdapter {
  readonly name: string;
  canHandle(url: string): boolean;
  resolve(url: string): Promise<string>;
  getVideoInfo(url: string): Promise<VideoInfo>;
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
