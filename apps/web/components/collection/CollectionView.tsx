'use client';

import { useState, useCallback } from 'react';
import type { CollectionData, CollectionVideoData } from '@/components/types';
import styles from './CollectionView.module.css';

interface CollectionViewProps {
  collection: CollectionData;
  onReset: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function downloadVideo(
  token: string,
  title: string,
  collectionName?: string,
  index?: number,
): Promise<boolean> {
  const params = new URLSearchParams({ token });
  if (collectionName) params.set('collection', collectionName);
  if (index != null) params.set('index', String(index + 1).padStart(2, '0'));

  try {
    const res = await fetch(`/api/download?${params}`);
    if (!res.ok) return false;

    const blob = await res.blob();
    if (blob.type === 'application/json' || blob.size < 1000) return false;

    const url = URL.createObjectURL(blob);
    const cleanTitle = title.replace(/#[^\s#]*/g, '').replace(/@[^\s@]*/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const prefix = index != null ? `${String(index + 1).padStart(2, '0')}-` : '';
    const filename = `${prefix}${cleanTitle || 'video'}.mp4`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

type ItemStatus = 'idle' | 'loading' | 'done' | 'failed';

export default function CollectionView({ collection, onReset }: CollectionViewProps) {
  const [statusMap, setStatusMap] = useState<Record<string, ItemStatus>>({});
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0 });

  function setStatus(id: string, status: ItemStatus) {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }

  const handleDownloadOne = useCallback(async (video: CollectionVideoData, index: number) => {
    setStatus(video.id, 'loading');
    const ok = await downloadVideo(video.token, video.title, collection.name, index);
    setStatus(video.id, ok ? 'done' : 'failed');
  }, [collection.name]);

  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    const total = collection.videos.length;
    let failed = 0;
    setProgress({ current: 0, total, failed: 0 });

    for (let i = 0; i < total; i++) {
      const video = collection.videos[i];
      setStatus(video.id, 'loading');
      const ok = await downloadVideo(video.token, video.title, collection.name, i);
      setStatus(video.id, ok ? 'done' : 'failed');
      if (!ok) failed++;
      setProgress({ current: i + 1, total, failed });

      // Stagger to avoid CDN rate limiting
      if (i < total - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    setDownloading(false);
  }, [collection.videos, collection.name]);

  const doneCount = Object.values(statusMap).filter((s) => s === 'done').length;
  const failedCount = Object.values(statusMap).filter((s) => s === 'failed').length;

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 className={styles.collectionName}>{collection.name}</h2>
            <p className={styles.videoCount}>
              {collection.videoCount} videos
              {doneCount > 0 ? <> &middot; {doneCount} downloaded</> : null}
              {failedCount > 0 ? <> &middot; <span className={styles.failedText}>{failedCount} failed</span></> : null}
            </p>
          </div>
          <div className={styles.actions}>
            {downloading ? (
              <span className={styles.progress}>
                {progress.current}/{progress.total}
              </span>
            ) : null}
            <button
              className={styles.downloadAllBtn}
              onClick={handleDownloadAll}
              disabled={downloading}
            >
              <DownloadIcon />
              {downloading ? 'Downloading...' : 'Download All'}
            </button>
            <button className={styles.resetBtn} onClick={onReset}>
              New Link
            </button>
          </div>
        </div>

        <div className={styles.list}>
          {collection.videos.map((video, index) => {
            const status = statusMap[video.id] || 'idle';
            return (
              <div key={video.id} className={`${styles.item} ${status === 'failed' ? styles.itemFailed : ''}`}>
                <span className={styles.index}>{index + 1}</span>
                <div className={styles.thumb}>
                  {video.coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={video.coverUrl} alt={video.title} className={styles.thumbImg} />
                  ) : null}
                </div>
                <div className={styles.itemInfo}>
                  <p className={styles.itemTitle}>{video.title}</p>
                  {video.duration != null ? (
                    <p className={styles.itemDuration}>{formatDuration(video.duration)}</p>
                  ) : null}
                </div>
                <button
                  className={`${styles.itemDownloadBtn} ${status === 'done' ? styles.downloaded : ''} ${status === 'failed' ? styles.failedBtn : ''}`}
                  onClick={() => handleDownloadOne(video, index)}
                  disabled={status === 'loading'}
                  title={status === 'failed' ? 'Retry' : 'Download'}
                >
                  {status === 'loading' ? <SpinnerIcon /> : null}
                  {status === 'done' ? <CheckIcon /> : null}
                  {status === 'failed' ? <RetryIcon /> : null}
                  {status === 'idle' ? <DownloadSmallIcon /> : null}
                </button>
              </div>
            );
          })}
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

function DownloadSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinner}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
