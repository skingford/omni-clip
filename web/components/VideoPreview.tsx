'use client';

import styles from './VideoPreview.module.css';

interface VideoData {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  duration?: number;
  hasWatermark: boolean;
  platform: string;
}

interface VideoPreviewProps {
  video: VideoData;
  token: string;
  onReset: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPreview({ video, token, onReset }: VideoPreviewProps) {
  function handleDownload() {
    const a = document.createElement('a');
    a.href = `/api/download?token=${encodeURIComponent(token)}`;
    a.download = `${video.author}-${video.title}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cover}>
            {video.coverUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={video.coverUrl}
                alt={video.title}
                className={styles.coverImage}
              />
            )}
            <span className={styles.badge}>{video.platform}</span>
            {video.duration != null && (
              <span className={styles.duration}>{formatDuration(video.duration)}</span>
            )}
          </div>
          <div className={styles.info}>
            <h2 className={styles.title}>{video.title}</h2>
            <p className={styles.author}>{video.author}</p>
            <div className={styles.actions}>
              <button className={styles.downloadBtn} onClick={handleDownload}>
                <DownloadIcon />
                Download Video
              </button>
              <button className={styles.resetBtn} onClick={onReset}>
                New Link
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
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

export function VideoError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className={styles.errorSection}>
      <div className={styles.errorCard}>
        <p className={styles.errorMessage}>{message}</p>
        <button className={styles.retryBtn} onClick={onRetry}>
          Try Again
        </button>
      </div>
    </section>
  );
}
