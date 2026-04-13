'use client';

import type { VideoData } from '@/components/types';
import type { DownloadLogEntry } from '@/lib/download-log';
import type { ToastType } from '@/components/ui/Toast';
import { useDownloadProgress } from '@/hooks/use-download-progress';
import { useVideoPlayer } from '@/hooks/use-video-player';
import ProgressBar from '@/components/ui/ProgressBar';
import VideoPlayer from '@/components/player/VideoPlayer';
import styles from './VideoPreview.module.css';

interface VideoPreviewProps {
  video: VideoData;
  token: string;
  onReset: () => void;
  onLogDownload: (entry: DownloadLogEntry) => Promise<void>;
  originalUrl: string;
  showToast: (message: string, type?: ToastType) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Safely trigger a file download from a Blob without conflicting with React's DOM. */
function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.parentNode?.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** Platforms that support online playback via third-party parsing. */
const PLAYABLE_PLATFORMS = new Set(['tencent']);

export default function VideoPreview({ video, token, onReset, onLogDownload, originalUrl, showToast }: VideoPreviewProps) {
  const { progress, downloading, download } = useDownloadProgress();
  const { playerState, play, close: closePlayer } = useVideoPlayer();
  const canPlay = PLAYABLE_PLATFORMS.has(video.platform);

  async function handleDownload() {
    const downloadUrl = `/api/download?token=${encodeURIComponent(token)}`;
    // All platforms now poll server-side progress for speed/ETA
    const pollUrl = `/api/download/progress?token=${encodeURIComponent(token)}`;

    try {
      const blob = await download(downloadUrl, pollUrl);
      triggerBlobDownload(blob, `${video.author}-${video.title}.mp4`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Download failed', 'error');
      return;
    }

    onLogDownload({
      videoId: video.id,
      title: video.title,
      author: video.author,
      platform: video.platform,
      coverUrl: video.coverUrl,
      duration: video.duration ?? null,
      originalUrl,
      downloadedAt: Date.now(),
    });
  }

  async function handlePlay() {
    const error = await play(token);
    if (error) {
      showToast(error, 'error');
    }
  }

  const isPlaying = playerState.status === 'playing';
  const isParsing = playerState.status === 'parsing';

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cover}>
            {isPlaying ? (
              <VideoPlayer
                streamUrl={playerState.streamUrl}
                streamType={playerState.streamType}
                poster={video.coverUrl}
                onClose={closePlayer}
              />
            ) : (
              <>
                {video.coverUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={video.coverUrl}
                    alt={video.title}
                    className={styles.coverImage}
                  />
                ) : null}
                <span className={styles.badge}>{video.platform}</span>
                {video.duration != null ? (
                  <span className={styles.duration}>{formatDuration(video.duration)}</span>
                ) : null}
                {canPlay && !isParsing && (
                  <button className={styles.coverPlayBtn} onClick={handlePlay} title="Play online">
                    <PlayIcon size={48} />
                  </button>
                )}
                {isParsing && (
                  <div className={styles.coverLoading}>
                    <SpinnerIcon />
                  </div>
                )}
              </>
            )}
          </div>
          <div className={styles.info}>
            <h2 className={styles.title}>{video.title}</h2>
            <p className={styles.author}>{video.author}</p>
            <div className={styles.actions}>
              {canPlay && (
                <button
                  className={styles.playBtn}
                  onClick={handlePlay}
                  disabled={isParsing || isPlaying}
                >
                  {isParsing ? <SpinnerIcon /> : <PlayIcon />}
                  {isParsing ? 'Parsing...' : isPlaying ? 'Playing' : 'Play Online'}
                </button>
              )}
              <button className={styles.downloadBtn} onClick={handleDownload} disabled={downloading}>
                {downloading ? <SpinnerIcon /> : <DownloadIcon />}
                {downloading
                  ? progress?.phase === 'server'
                    ? `Preparing...${progress.percent != null ? ` ${progress.percent}%` : ''}${progress.speed ? ` · ${progress.speed}` : ''}`
                    : `Downloading...${progress?.percent != null ? ` ${progress?.percent}%` : ''}${progress?.speed ? ` · ${progress?.speed}` : ''}`
                  : 'Download Video'}
              </button>
              <button className={styles.resetBtn} onClick={onReset}>
                New Link
              </button>
            </div>
          </div>
          {downloading && (
            <ProgressBar
              percent={progress?.percent ?? null}
              loaded={progress?.loaded ?? 0}
              total={progress?.total ?? null}
              speed={progress?.speed}
              eta={progress?.eta}
              compact
            />
          )}
        </div>
      </div>
    </section>
  );
}

function SpinnerIcon() {
  return (
    <svg className={styles.spinner} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
