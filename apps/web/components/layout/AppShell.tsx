'use client';

import { useState, useCallback } from 'react';
import { useVideoResolver } from '@/hooks/use-video-resolver';
import { useDownloadLog } from '@/hooks/use-download-log';
import { useToast } from '@/hooks/use-toast';
import Navigation from './Navigation';
import VideoResolverClient from '@/components/hero/VideoResolverClient';
import DownloadHistory from '@/components/history/DownloadHistory';
import Toast from '@/components/ui/Toast';

export default function AppShell() {
  const { state, handleResolve, handleReset } = useVideoResolver();
  const { history, log, remove } = useDownloadLog();
  const { items: toastItems, show: showToast, dismiss: dismissToast } = useToast();
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
          showToast={showToast}
        />
      </main>
      <DownloadHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onRedownload={handleRedownload}
        onDelete={remove}
      />
      <Toast items={toastItems} onDismiss={dismissToast} />
    </>
  );
}
