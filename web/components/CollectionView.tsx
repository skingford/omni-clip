'use client';

import { useState, useCallback } from 'react';
import styles from './CollectionView.module.css';

interface CollectionVideoData {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  duration?: number;
  token: string;
}

interface CollectionData {
  id: string;
  name: string;
  desc: string;
  videoCount: number;
  videos: CollectionVideoData[];
}

interface CollectionViewProps {
  collection: CollectionData;
  onReset: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function triggerDownload(token: string, author: string, title: string, collectionName?: string, index?: number) {
  const params = new URLSearchParams({ token });
  if (collectionName) params.set('collection', collectionName);
  if (index != null) params.set('index', String(index + 1).padStart(2, '0'));

  const a = document.createElement('a');
  a.href = `/api/download?${params}`;
  const prefix = index != null ? `${String(index + 1).padStart(2, '0')}-` : '';
  a.download = `${prefix}${author}-${title}.mp4`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function CollectionView({ collection, onReset }: CollectionViewProps) {
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleDownloadOne = useCallback((video: CollectionVideoData, index: number) => {
    triggerDownload(video.token, video.author, video.title, collection.name, index);
    setDownloadedSet((prev) => new Set(prev).add(video.id));
  }, [collection.name]);

  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    const total = collection.videos.length;
    setProgress({ current: 0, total });

    for (let i = 0; i < total; i++) {
      const video = collection.videos[i];
      triggerDownload(video.token, video.author, video.title, collection.name, i);
      setDownloadedSet((prev) => new Set(prev).add(video.id));
      setProgress({ current: i + 1, total });

      // Stagger downloads to avoid CDN rate limiting
      if (i < total - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    setDownloading(false);
  }, [collection.videos]);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 className={styles.collectionName}>{collection.name}</h2>
            <p className={styles.videoCount}>{collection.videoCount} videos</p>
          </div>
          <div className={styles.actions}>
            {downloading && (
              <span className={styles.progress}>
                {progress.current}/{progress.total}
              </span>
            )}
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
          {collection.videos.map((video, index) => (
            <div key={video.id} className={styles.item}>
              <span className={styles.index}>{index + 1}</span>
              <div className={styles.thumb}>
                {video.coverUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={video.coverUrl}
                    alt={video.title}
                    className={styles.thumbImg}
                  />
                )}
              </div>
              <div className={styles.itemInfo}>
                <p className={styles.itemTitle}>{video.title}</p>
                {video.duration != null && (
                  <p className={styles.itemDuration}>{formatDuration(video.duration)}</p>
                )}
              </div>
              <button
                className={`${styles.itemDownloadBtn} ${downloadedSet.has(video.id) ? styles.downloaded : ''}`}
                onClick={() => handleDownloadOne(video, index)}
                title="Download"
              >
                {downloadedSet.has(video.id) ? <CheckIcon /> : <DownloadSmallIcon />}
              </button>
            </div>
          ))}
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
