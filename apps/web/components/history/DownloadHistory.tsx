'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { DownloadLogRecord } from '@/lib/download-log';
import { formatTime, formatDayLabel } from '@/lib/format-relative-time';
import styles from './DownloadHistory.module.css';

interface DownloadHistoryProps {
  open: boolean;
  onClose: () => void;
  history: DownloadLogRecord[];
  onRedownload: (originalUrl: string) => void;
  onDelete: (id: number) => void;
}

interface DayGroup {
  label: string;
  count: number;
  entries: DownloadLogRecord[];
}

function groupByDay(records: DownloadLogRecord[]): DayGroup[] {
  const groups: Map<string, DownloadLogRecord[]> = new Map();
  for (const record of records) {
    const label = formatDayLabel(record.downloadedAt);
    const list = groups.get(label);
    if (list) {
      list.push(record);
    } else {
      groups.set(label, [record]);
    }
  }
  return Array.from(groups, ([label, entries]) => ({
    label,
    count: entries.length,
    entries,
  }));
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DownloadHistory({
  open,
  onClose,
  history,
  onRedownload,
  onDelete,
}: DownloadHistoryProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  const dayGroups = useMemo(() => groupByDay(history), [history]);

  const totalDownloads = useMemo(
    () => history.reduce((sum, e) => sum + (e.downloadCount || 1), 0),
    [history],
  );

  useEffect(() => {
    if (open && panelRef.current) {
      const closeBtn = panelRef.current.querySelector('button');
      closeBtn?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  function handleImgError(id: number) {
    setImgErrors((prev) => new Set(prev).add(id));
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Download History"
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Recent Downloads</h2>
            {history.length > 0 ? (
              <p className={styles.stats}>
                {history.length} video{history.length !== 1 ? 's' : ''} &middot; {totalDownloads} download{totalDownloads !== 1 ? 's' : ''}
              </p>
            ) : null}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.list}>
          {history.length === 0 ? (
            <div className={styles.empty}>
              <EmptyIcon />
              <p>No downloads yet</p>
            </div>
          ) : (
            dayGroups.map((group) => (
              <div key={group.label}>
                <div className={styles.dayHeader}>
                  <span>{group.label}</span>
                  <span className={styles.dayCount}>{group.count}</span>
                </div>
                {group.entries.map((entry) => (
                  <div key={entry.id} className={styles.item}>
                    <div className={styles.thumb}>
                      {entry.coverUrl && !imgErrors.has(entry.id) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={entry.coverUrl}
                          alt=""
                          className={styles.thumbImg}
                          onError={() => handleImgError(entry.id)}
                        />
                      ) : (
                        <div className={styles.thumbFallback}>
                          <VideoIcon />
                        </div>
                      )}
                    </div>
                    <div className={styles.itemInfo}>
                      <p className={styles.itemTitle}>{entry.title || entry.author}</p>
                      <p className={styles.itemMeta}>
                        <span className={styles.platform}>{entry.platform}</span>
                        {entry.duration != null ? (
                          <> &middot; {formatDuration(entry.duration)}</>
                        ) : null}
                        <> &middot; {formatTime(entry.downloadedAt)}</>
                        {(entry.downloadCount || 1) > 1 ? (
                          <span className={styles.downloadCount}>x{entry.downloadCount}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className={styles.itemActions}>
                      <button
                        className={styles.redownloadBtn}
                        onClick={() => onRedownload(entry.originalUrl)}
                        title="Re-download"
                      >
                        <DownloadIcon />
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => onDelete(entry.id)}
                        title="Remove"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
