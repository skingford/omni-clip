'use client';

import { useState, useCallback } from 'react';
import { useVideoResolver } from '@/hooks/use-video-resolver';
import { useDownloadLog } from '@/hooks/use-download-log';
import Navigation from './Navigation';
import VideoResolverClient from '@/components/hero/VideoResolverClient';
import DownloadHistory from '@/components/history/DownloadHistory';

export default function AppShell() {
  const { state, handleResolve, handleReset } = useVideoResolver();
  const { history, log, remove } = useDownloadLog();
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleRedownload = useCallback((url: string) => {
    setHistoryOpen(false);
    handleResolve(url);
  }, [handleResolve]);

  const originalUrl = state.status === 'resolved' ? state.originalUrl : '';

  return (
    <>
      <Navigation
        onHistoryToggle={() => setHistoryOpen((v) => !v)}
        historyCount={history.length}
      />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <VideoResolverClient
          state={state}
          onResolve={handleResolve}
          onReset={handleReset}
          onLogDownload={log}
          originalUrl={originalUrl}
        />
      </main>
      <DownloadHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onRedownload={handleRedownload}
        onDelete={remove}
      />
    </>
  );
}
