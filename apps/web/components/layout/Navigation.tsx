'use client';

import styles from './Navigation.module.css';

interface NavigationProps {
  onHistoryToggle: () => void;
  historyCount: number;
}

export default function Navigation({ onHistoryToggle, historyCount }: NavigationProps) {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <span className={styles.logo}>omni-clip</span>
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

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
