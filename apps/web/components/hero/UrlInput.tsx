'use client';

import { useState, type FormEvent } from 'react';
import styles from './UrlInput.module.css';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  loading: boolean;
  placeholder?: string;
}

export default function UrlInput({ onSubmit, loading, placeholder }: UrlInputProps) {
  const [url, setUrl] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed && !loading) {
      onSubmit(trimmed);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputWrapper}>
        <input
          type="text"
          className={styles.input}
          placeholder={placeholder ?? "Paste a video link (YouTube, Douyin)..."}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          autoFocus
        />
      </div>
      <button type="submit" className={styles.button} disabled={loading || !url.trim()}>
        {loading ? (
          <>
            <span className={styles.spinner} />
            Resolving
          </>
        ) : (
          'Get Video'
        )}
      </button>
    </form>
  );
}
