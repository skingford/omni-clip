'use client';

import styles from './VideoError.module.css';

interface VideoErrorProps {
  message: string;
  onRetry: () => void;
}

export default function VideoError({ message, onRetry }: VideoErrorProps) {
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
