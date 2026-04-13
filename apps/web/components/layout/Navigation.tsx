'use client';

import styles from './Navigation.module.css';

export type AppMode = 'download' | 'play';

interface NavigationProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onHistoryToggle: () => void;
  historyCount: number;
}

export default function Navigation({ mode, onModeChange, onHistoryToggle, historyCount }: NavigationProps) {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <span className={styles.logo}>omni-clip</span>
        <div className={styles.links}>
          <button
            className={`${styles.navLink} ${mode === 'download' ? styles.navLinkActive : ''}`}
            onClick={() => onModeChange('download')}
          >
            <DownloadNavIcon />
            Video Download
          </button>
          <button
            className={`${styles.navLink} ${mode === 'play' ? styles.navLinkActive : ''}`}
            onClick={() => onModeChange('play')}
          >
            <PlayNavIcon />
            Online Play
          </button>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.historyBtn}
            onClick={onHistoryToggle}
            aria-label="Download History"
          >
            <ClockIcon />
            {historyCount > 0 ? (
              <span className={styles.badge}>{historyCount}</span>
            ) : null}
          </button>
        </div>
      </div>
    </nav>
  );
}

function DownloadNavIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PlayNavIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
