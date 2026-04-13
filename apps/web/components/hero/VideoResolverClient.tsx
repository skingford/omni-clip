'use client';

import type { AppState } from '@/components/types';
import type { DownloadLogEntry } from '@/lib/download-log';
import type { ToastType } from '@/components/ui/Toast';
import type { AppMode } from '@/components/layout/Navigation';
import HeroSection from '@/components/hero/HeroSection';
import VideoPreview from '@/components/video/VideoPreview';
import VideoError from '@/components/video/VideoError';
import CollectionView from '@/components/collection/CollectionView';

interface VideoResolverClientProps {
  state: AppState;
  mode: AppMode;
  onResolve: (url: string) => void;
  onReset: () => void;
  onLogDownload: (entry: DownloadLogEntry) => Promise<void>;
  originalUrl: string;
  showToast: (message: string, type?: ToastType) => void;
}

export default function VideoResolverClient({
  state,
  mode,
  onResolve,
  onReset,
  onLogDownload,
  originalUrl,
  showToast,
}: VideoResolverClientProps) {
  const isResolved = state.status === 'resolved';
  const showCollection = isResolved && state.collection;

  return (
    <>
      <HeroSection
        onSubmit={onResolve}
        loading={state.status === 'resolving'}
        mode={mode}
      />
      {isResolved && !showCollection ? (
        <VideoPreview
          video={state.video}
          token={state.token}
          onReset={onReset}
          onLogDownload={onLogDownload}
          originalUrl={originalUrl}
          showToast={showToast}
        />
      ) : null}
      {showCollection ? (
        <CollectionView
          collection={state.collection!}
          onReset={onReset}
          onLogDownload={onLogDownload}
          originalUrl={originalUrl}
          showToast={showToast}
        />
      ) : null}
      {state.status === 'error' ? (
        <VideoError message={state.message} onRetry={onReset} />
      ) : null}
    </>
  );
}
