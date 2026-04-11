import { formatBytes } from '@/lib/format-bytes';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  /** 0–100 percentage, or null for indeterminate mode */
  percent: number | null;
  /** Bytes downloaded so far */
  loaded: number;
  /** Total bytes, or null if unknown */
  total: number | null;
  /** Compact mode: thinner bar, no text label */
  compact?: boolean;
  /** Download speed string (e.g. "5.2KiB/s") */
  speed?: string;
  /** Estimated time remaining (e.g. "12:34") */
  eta?: string;
}

export default function ProgressBar({ percent, loaded, total, compact, speed, eta }: ProgressBarProps) {
  const isDeterminate = percent != null;
  const wrapperClass = [
    styles.wrapper,
    compact ? styles.compact : '',
    !isDeterminate ? styles.indeterminate : '',
  ].filter(Boolean).join(' ');

  function renderLabel() {
    // Server-phase: show speed and ETA from yt-dlp
    if (speed || eta) {
      const parts: string[] = [];
      if (percent != null) parts.push(`${percent}%`);
      if (speed) parts.push(speed);
      if (eta) parts.push(`ETA ${eta}`);
      return parts.join('  ·  ');
    }

    // Download-phase: show byte progress
    if (isDeterminate && total != null) {
      return `${formatBytes(loaded)} / ${formatBytes(total)}  (${percent}%)`;
    }

    if (loaded === 0) return 'Preparing download...';
    return `${formatBytes(loaded)} downloaded`;
  }

  return (
    <div className={wrapperClass}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={isDeterminate ? { width: `${percent}%` } : undefined}
        />
      </div>
      {!compact && (
        <div className={styles.label}>{renderLabel()}</div>
      )}
    </div>
  );
}
