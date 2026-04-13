'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  streamUrl: string;
  streamType?: 'hls' | 'mp4';
  poster?: string;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ streamUrl, streamType = 'hls', poster, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const hasPlayedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Initialize player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (streamType === 'mp4') {
      // Direct MP4 playback
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setError('Failed to load video');
      });
      return;
    }

    // HLS playback
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => { /* autoplay blocked */ });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setError('Network error — stream may have expired');
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setError('Playback error');
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        video.play().catch(() => {});
      });
    } else {
      setError('HLS playback is not supported in this browser');
    }
  }, [streamUrl, streamType]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setPlaying(true);
      // Once playback starts, never re-show the initial loading overlay
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        setLoading(false);
      }
      setBuffering(false);
    };
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onDurationChange = () => setDuration(video.duration);
    const onWaiting = () => {
      // Only show initial loading if never played; otherwise just mark buffering
      if (!hasPlayedRef.current) {
        setLoading(true);
      }
      setBuffering(true);
    };
    const onCanPlay = () => {
      setLoading(false);
      setBuffering(false);
    };
    const onPlaying = () => {
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        setLoading(false);
      }
      setBuffering(false);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, []);

  // Auto-hide controls
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playing]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const v = Number(e.target.value);
    video.volume = v;
    setVolume(v);
    if (v === 0) {
      video.muted = true;
      setMuted(true);
    } else if (muted) {
      video.muted = false;
      setMuted(false);
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  if (error) {
    return (
      <div className={styles.container} ref={containerRef}>
        <div className={styles.errorOverlay}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onMouseMove={showControls}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        className={styles.video}
        poster={poster}
        playsInline
      />

      {/* Loading / buffering spinner */}
      {(loading || buffering) && (
        <div className={`${styles.loadingOverlay} ${!loading && buffering ? styles.bufferingOverlay : ''}`}>
          <div className={styles.spinner} />
        </div>
      )}

      {/* Center play button when paused */}
      {!playing && !loading && (
        <div className={styles.centerPlay}>
          <PlayIcon size={48} />
        </div>
      )}

      {/* Controls bar */}
      <div
        className={`${styles.controls} ${controlsVisible ? styles.controlsVisible : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className={styles.closeBtn} onClick={onClose} title="Close player">
          <CloseIcon />
        </button>

        {/* Progress bar */}
        <div className={styles.progressContainer}>
          <div className={styles.progressTrack}>
            <div className={styles.progressBuffered} style={{ width: `${bufferedPercent}%` }} />
            <div className={styles.progressFilled} style={{ width: `${progress}%` }} />
          </div>
          <input
            type="range"
            className={styles.progressInput}
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
          />
        </div>

        {/* Bottom controls */}
        <div className={styles.bottomBar}>
          <button className={styles.controlBtn} onClick={togglePlay}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <div className={styles.volumeGroup}>
            <button className={styles.controlBtn} onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeMuteIcon /> : <VolumeIcon />}
            </button>
            <input
              type="range"
              className={styles.volumeSlider}
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
            />
          </div>

          <span className={styles.time}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className={styles.spacer} />

          <button className={styles.controlBtn} onClick={toggleFullscreen}>
            <FullscreenIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeMuteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
