/**
 * Sliding-window speed calculator for download progress.
 */

const WINDOW_SIZE_MS = 5000; // 5-second sliding window

interface Sample {
  time: number;
  bytes: number;
}

export class SpeedCalculator {
  private samples: Sample[] = [];
  private totalBytes = 0;

  /** Record bytes received at current time. */
  addBytes(bytes: number) {
    this.totalBytes += bytes;
    this.samples.push({ time: Date.now(), bytes: this.totalBytes });
    this.prune();
  }

  /** Get current speed in bytes/sec based on sliding window. */
  getSpeed(): number {
    this.prune();
    if (this.samples.length < 2) return 0;

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const elapsed = (last.time - first.time) / 1000;
    if (elapsed <= 0) return 0;

    return (last.bytes - first.bytes) / elapsed;
  }

  /** Get ETA in seconds, or null if unknown. */
  getEta(remainingBytes: number): number | null {
    const speed = this.getSpeed();
    if (speed <= 0) return null;
    return remainingBytes / speed;
  }

  private prune() {
    const cutoff = Date.now() - WINDOW_SIZE_MS;
    while (this.samples.length > 1 && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
  }
}

/** Format bytes/sec as human-readable speed string. */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.min(Math.floor(Math.log(bytesPerSec) / Math.log(1024)), units.length - 1);
  const value = bytesPerSec / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format seconds as human-readable ETA string. */
export function formatEta(seconds: number | null): string {
  if (seconds == null || seconds <= 0 || !isFinite(seconds)) return '';
  const s = Math.ceil(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}:${sec.toString().padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
