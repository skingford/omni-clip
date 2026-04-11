'use client';

import type { VideoData } from '@/components/types';
import type { DownloadLogEntry } from '@/lib/download-log';
import styles from './VideoPreview.module.css';

interface VideoPreviewProps {
  video: VideoData;
  token: string;
  onReset: () => void;
  onLogDownload: (entry: DownloadLogEntry) => Promise<void>;
  originalUrl: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPreview({ video, token, onReset, onLogDownload, originalUrl }: VideoPreviewProps) {
  function handleDownload() {
    const a = document.createElement('a');
    a.href = `/api/download?token=${encodeURIComponent(token)}`;
    a.download = `${video.author}-${video.title}.mp4`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();

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
