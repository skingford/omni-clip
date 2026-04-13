import { useState, useCallback } from 'react';

export type PlayerState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'playing'; streamUrl: string; streamType: 'hls' | 'mp4' }
  | { status: 'error'; message: string };

export function useVideoPlayer() {
  const [playerState, setPlayerState] = useState<PlayerState>({ status: 'idle' });

  /** Returns error message on failure, or null on success. */
  const play = useCallback(async (token: string): Promise<string | null> => {
    setPlayerState({ status: 'parsing' });
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!data.success) {
        const msg = data.error || 'Failed to parse video';
        setPlayerState({ status: 'error', message: msg });
        return msg;
      }

      // MP4: direct CDN URL; HLS: proxy through /api/stream
      const streamUrl = data.directUrl
        ?? `/api/stream?token=${encodeURIComponent(data.streamToken)}`;

      setPlayerState({
        status: 'playing',
        streamUrl,
        streamType: data.type || 'hls',
      });
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to parse video';
      setPlayerState({ status: 'error', message: msg });
      return msg;
    }
  }, []);

  const close = useCallback(() => {
    setPlayerState({ status: 'idle' });
  }, []);

  return { playerState, play, close };
}
