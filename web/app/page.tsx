'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import VideoPreview, { VideoError } from '@/components/VideoPreview';
import Footer from '@/components/Footer';

interface VideoData {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  duration?: number;
  hasWatermark: boolean;
  platform: string;
}

type AppState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'resolved'; video: VideoData; token: string }
  | { status: 'error'; message: string };

export default function Home() {
  const [state, setState] = useState<AppState>({ status: 'idle' });

  async function handleResolve(url: string) {
    setState({ status: 'resolving' });
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        setState({ status: 'resolved', video: data.data, token: data.token });
      } else {
        setState({ status: 'error', message: data.error });
      }
    } catch {
      setState({ status: 'error', message: 'Network error — please check your connection' });
    }
  }

  function handleReset() {
    setState({ status: 'idle' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navigation />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <HeroSection
          onSubmit={handleResolve}
          loading={state.status === 'resolving'}
        />
        {state.status === 'resolved' && (
          <VideoPreview
            video={state.video}
            token={state.token}
            onReset={handleReset}
          />
        )}
        {state.status === 'error' && (
          <VideoError message={state.message} onRetry={handleReset} />
        )}
      </main>
      <Footer />
    </div>
  );
}
