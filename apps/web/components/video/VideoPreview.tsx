'use client';

import type { VideoData } from '@/components/types';
import type { DownloadLogEntry } from '@/lib/download-log';
import type { ToastType } from '@/components/ui/Toast';
import { useDownloadProgress } from '@/hooks/use-download-progress';
import ProgressBar from '@/components/ui/ProgressBar';
import styles from './VideoPreview.module.css';

interface VideoPreviewProps {
  video: VideoData;
  token: string;
  onReset: () => void;
  onLogDownload: (entry: DownloadLogEntry) => Promise<void>;
  originalUrl: string;
  showToast: (message: string, type?: ToastType) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Platforms whose download requires server-side processing (HLS → MP4). */
const SLOW_DOWNLOAD_PLATFORMS = new Set(['tencent']);

/** Safely trigger a file download from a Blob without conflicting with React's DOM. */
function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.parentNode?.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** Safely trigger a file download from a URL. */
function triggerLinkDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.parentNode?.removeChild(a); }, 100);
}

export default function VideoPreview({ video, token, onReset, onLogDownload, originalUrl, showToast }: VideoPreviewProps) {
  const { progress, downloading, download } = useDownloadProgress();

  async function handleDownload() {
    const downloadUrl = `/api/download?token=${encodeURIComponent(token)}`;

    if (SLOW_DOWNLOAD_PLATFORMS.has(video.platform)) {
      // Server-side HLS download — takes time, poll server-side yt-dlp progress
      const pollUrl = `/api/download/progress?token=${encodeURIComponent(token)}`;
      try {
        const blob = await download(downloadUrl, pollUrl);
        triggerBlobDownload(blob, `${video.author}-${video.title}.mp4`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Download failed', 'error');
        return;
      }
    } else {
      // Direct CDN proxy — browser handles the download immediately
      triggerLinkDownload(downloadUrl, `${video.author}-${video.title}.mp4`);
    }

    onLogDownload({
      videoId: video.id,
      title: video.title,
      author: video.author,
      platform: video.platform,
      coverUrl: video.coverUrl,
      duration: video.duration ?? null,
      originalUrl,
      downloadedAt: Date.now(),
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cover}>
            {video.coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={video.coverUrl}
                alt={video.title}
                className={styles.coverImage}
              />
            ) : null}
            <span className={styles.badge}>{video.platform}</span>
            {video.duration != null ? (
              <span className={styles.duration}>{formatDuration(video.duration)}</span>
            ) : null}
          </div>
          <div className={styles.info}>
            <h2 className={styles.title}>{video.title}</h2>
            <p className={styles.author}>{video.author}</p>
            <div className={styles.actions}>
              <button className={styles.downloadBtn} onClick={handleDownload} disabled={downloading}>
                {downloading ? <SpinnerIcon /> : <DownloadIcon />}
                {downloading
                  ? progress?.phase === 'server'
                    ? `Server preparing...${progress.percent != null ? ` ${progress.percent}%` : ''}`
                    : `Downloading...${progress?.percent != null ? ` ${progress.percent}%` : ''}`
                  : 'Download Video'}
              </button>
              <button className={styles.resetBtn} onClick={onReset}>
                New Link
              </button>
            </div>
          </div>
          {downloading && (
            <ProgressBar
              percent={progress?.percent ?? null}
              loaded={progress?.loaded ?? 0}
              total={progress?.total ?? null}
              compact
            />
          )}
        </div>
      </div>
    </section>
  );
}

function SpinnerIcon() {
  return (
    <svg className={styles.spinner} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
