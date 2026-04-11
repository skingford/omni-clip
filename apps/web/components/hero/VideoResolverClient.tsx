'use client';

import { useVideoResolver } from '@/hooks/use-video-resolver';
import HeroSection from '@/components/hero/HeroSection';
import VideoPreview from '@/components/video/VideoPreview';
import VideoError from '@/components/video/VideoError';
import CollectionView from '@/components/collection/CollectionView';

export default function VideoResolverClient() {
  const { state, handleResolve, handleReset } = useVideoResolver();

  const isResolved = state.status === 'resolved';
  const showCollection = isResolved && state.collection;

  return (
    <>
      <HeroSection
        onSubmit={handleResolve}
        loading={state.status === 'resolving'}
      />
      {isResolved && !showCollection ? (
        <VideoPreview
          video={state.video}
          token={state.token}
          onReset={handleReset}
        />
      ) : null}
      {showCollection ? (
        <CollectionView
          collection={state.collection!}
          onReset={handleReset}
        />
      ) : null}
      {state.status === 'error' ? (
        <VideoError message={state.message} onRetry={handleReset} />
      ) : null}
    </>
  );
}
