import { execSync } from 'node:child_process';
import type { PlatformAdapter, VideoInfo, CollectionInfo } from '../types';

// ============================================================
// Constants
// ============================================================

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ============================================================
// URL Utilities
// ============================================================

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'];

export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return YOUTUBE_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    const v = parsed.searchParams.get('v');
    if (v && /^[\w-]{11}$/.test(v)) return v;

    const pathMatch = parsed.pathname.match(/\/(?:shorts|embed|v)\/([\w-]{11})/);
    if (pathMatch) return pathMatch[1];

    return null;
  } catch {
    return null;
  }
}

export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const list = parsed.searchParams.get('list');
    return list && /^[A-Za-z0-9_-]+$/.test(list) ? list : null;
  } catch {
    return null;
  }
}

// ============================================================
// yt-dlp Integration
// ============================================================

let ytdlpChecked = false;
let ytdlpAvailable = false;

function checkYtdlp(): boolean {
  if (ytdlpChecked) return ytdlpAvailable;
  ytdlpChecked = true;
  try {
    execSync('yt-dlp --version', { stdio: 'pipe', timeout: 5000 });
    ytdlpAvailable = true;
  } catch {
    ytdlpAvailable = false;
  }
  return ytdlpAvailable;
}

interface YtdlpVideoJson {
  id: string;
  title: string;
  uploader?: string;
  channel?: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  url?: string;
  requested_formats?: Array<{ url: string; format_id: string; ext: string; vcodec?: string; acodec?: string }>;
  formats?: Array<{ url: string; format_id: string; ext: string; height?: number; vcodec?: string; acodec?: string }>;
}

function ytdlpGetInfo(url: string): YtdlpVideoJson {
  if (!checkYtdlp()) {
    throw new Error(
      'yt-dlp is required for YouTube downloads. Install it: https://github.com/yt-dlp/yt-dlp#installation'
    );
  }

  try {
    const output = execSync(
      `yt-dlp --dump-json --no-download --no-warnings -f "best[ext=mp4][protocol=https]/best[ext=mp4]" "${url}"`,
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );
    return JSON.parse(output.toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('is not recognized') || msg.includes('not found')) {
      throw new Error(
        'yt-dlp is required for YouTube downloads. Install it: https://github.com/yt-dlp/yt-dlp#installation'
      );
    }
    throw new Error(`yt-dlp failed: ${msg.slice(0, 200)}`);
  }
}

function extractVideoUrl(info: YtdlpVideoJson): string {
  // Prefer the direct url field (best single format)
  if (info.url) return info.url;

  // Fall back to requested_formats (when yt-dlp selects video+audio)
  if (info.requested_formats?.length) {
    // Find the video format (has vcodec != "none")
    const videoFmt = info.requested_formats.find((f) => f.vcodec !== 'none');
    if (videoFmt?.url) return videoFmt.url;
    return info.requested_formats[0].url;
  }

  // Last resort: find best mp4 from all formats
  if (info.formats?.length) {
    const mp4s = info.formats
      .filter((f) => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    if (mp4s[0]?.url) return mp4s[0].url;
  }

  throw new Error('yt-dlp returned no downloadable URL');
}

// ============================================================
// Page Metadata Extraction (zero-dep fallback for info)
// ============================================================

function extractPlayerResponse(html: string): any {
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
  if (match) {
    try { return JSON.parse(match[1]); } catch { /* fall through */ }
  }
  return null;
}

async function fetchMetadata(videoId: string): Promise<Partial<VideoInfo>> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { ...DEFAULT_HEADERS, Cookie: 'CONSENT=PENDING+999' },
    });
    if (!res.ok) return {};

    const html = await res.text();
    const pr = extractPlayerResponse(html);
    if (!pr) return {};

    const vd = pr.videoDetails;
    if (!vd) return {};

    return {
      id: videoId,
      title: vd.title ?? 'Untitled',
      author: vd.author ?? 'Unknown',
      description: vd.shortDescription ?? '',
      coverUrl: vd.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ?? '',
      duration: vd.lengthSeconds ? parseInt(vd.lengthSeconds, 10) : undefined,
    };
  } catch {
    return {};
  }
}

// ============================================================
// YouTubeAdapter
// ============================================================

export class YouTubeAdapter implements PlatformAdapter {
  readonly name = 'youtube';

  canHandle(url: string): boolean {
    return isYouTubeUrl(url);
  }

  async resolve(url: string): Promise<string> {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') {
        const videoId = parsed.pathname.slice(1).split('/')[0];
        if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
      }
    } catch { /* fall through */ }
    return url;
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error(`Could not extract video ID from URL: ${url}`);

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Get video URL via yt-dlp (handles PoToken, cipher, n-param automatically)
    const ytdlpInfo = ytdlpGetInfo(canonicalUrl);
    const videoUrl = extractVideoUrl(ytdlpInfo);

    // Merge yt-dlp metadata with page metadata for best coverage
    const pageMeta = await fetchMetadata(videoId);

    return {
      id: videoId,
      title: ytdlpInfo.title ?? pageMeta.title ?? 'Untitled',
      author: ytdlpInfo.uploader ?? ytdlpInfo.channel ?? pageMeta.author ?? 'Unknown',
      description: ytdlpInfo.description ?? pageMeta.description ?? '',
      videoUrl,
      coverUrl: ytdlpInfo.thumbnail ?? pageMeta.coverUrl ?? '',
      duration: ytdlpInfo.duration ?? pageMeta.duration,
      hasWatermark: false,
      platform: 'youtube',
    };
  }

  async getCollectionInfo(url: string): Promise<CollectionInfo | null> {
    const playlistId = extractPlaylistId(url);
    if (!playlistId) return null;

    if (!checkYtdlp()) return null;

    try {
      // yt-dlp with --flat-playlist just gets metadata, then we resolve each
      const output = execSync(
        `yt-dlp --flat-playlist --dump-json --no-download --no-warnings "https://www.youtube.com/playlist?list=${playlistId}"`,
        { stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 50 * 1024 * 1024 }
      );

      const lines = output.toString().trim().split('\n');
      const entries: Array<{ id: string; title: string; uploader?: string; duration?: number; url: string }> = [];
      for (const line of lines) {
        try { entries.push(JSON.parse(line)); } catch { /* skip bad lines */ }
      }

      if (entries.length === 0) return null;

      // Resolve each video to get streaming URLs
      const videos: VideoInfo[] = [];
      for (const entry of entries) {
        try {
          const info = await this.getVideoInfo(`https://www.youtube.com/watch?v=${entry.id}`);
          videos.push(info);
        } catch { /* skip unavailable */ }
      }

      if (videos.length === 0) return null;

      return {
        id: playlistId,
        name: entries[0]?.title?.includes(entries[0]?.uploader ?? '')
          ? 'YouTube Playlist'
          : entries[0]?.title ?? 'YouTube Playlist',
        desc: '',
        videoCount: videos.length,
        videos,
      };
    } catch {
      return null;
    }
  }
}
