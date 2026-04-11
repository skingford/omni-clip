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
}

export default function ProgressBar({ percent, loaded, total, compact }: ProgressBarProps) {
  const isDeterminate = percent != null;
  const wrapperClass = [
    styles.wrapper,
    compact ? styles.compact : '',
    !isDeterminate ? styles.indeterminate : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={isDeterminate ? { width: `${percent}%` } : undefined}
        />
      </div>
      {!compact && (
        <div className={styles.label}>
          {isDeterminate && total != null
            ? `${formatBytes(loaded)} / ${formatBytes(total)}  (${percent}%)`
            : loaded === 0
              ? 'Preparing download...'
              : `${formatBytes(loaded)} downloaded`}
        </div>
      )}
    </div>
  );
}
