import { execSync } from 'node:child_process';
import type { PlatformAdapter, VideoInfo, CollectionInfo } from '../types';
import {
  isTencentVideoUrl,
  extractTencentVid,
  extractTencentCoverId,
  isTencentSeriesUrl,
} from '../utils/url';

// ============================================================
// Constants
// ============================================================

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

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
  creator?: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  series?: string;
}

function ytdlpGetInfo(url: string): YtdlpVideoJson {
  if (!checkYtdlp()) {
    throw new Error(
      'yt-dlp is required for Tencent Video downloads. Install it: https://github.com/yt-dlp/yt-dlp#installation'
    );
  }

  try {
    const output = execSync(
      `yt-dlp --dump-json --no-download --no-warnings --skip-download "${url}"`,
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );
    return JSON.parse(output.toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('is not recognized') || msg.includes('not found')) {
      throw new Error(
        'yt-dlp is required for Tencent Video downloads. Install it: https://github.com/yt-dlp/yt-dlp#installation'
      );
    }
    if (msg.includes('This content is not available in your area')) {
      throw new Error('This Tencent Video is not available in your region due to copyright restrictions');
    }
    if (msg.includes('VIP') || msg.includes('付费')) {
      throw new Error(
        'This video requires Tencent VIP. Try passing cookies: install browser cookies, then run with --cookies-from-browser'
      );
    }
    throw new Error(`yt-dlp failed: ${msg.slice(0, 200)}`);
  }
}

// ============================================================
// Page Metadata Extraction (fallback for basic info)
// ============================================================

async function fetchPageMetadata(url: string): Promise<Partial<VideoInfo>> {
  try {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    if (!res.ok) return {};

    const html = await res.text();

    const title = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1]
      ?? html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/[-_]腾讯视频$/, '').trim()
      ?? '';

    const description = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)?.[1] ?? '';
    const coverUrl = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1] ?? '';

    // Try to extract author/site info from page
    const author = html.match(/<meta[^>]+property="og:video:actor"[^>]+content="([^"]+)"/)?.[1]
      ?? html.match(/<meta[^>]+name="author"[^>]+content="([^"]+)"/)?.[1]
      ?? html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/)?.[1]
      ?? '';

    return { title, description, coverUrl, author };
  } catch {
    return {};
  }
}

// ============================================================
// TencentAdapter
// ============================================================

export class TencentAdapter implements PlatformAdapter {
  readonly name = 'tencent';

  canHandle(url: string): boolean {
    return isTencentVideoUrl(url);
  }

  async resolve(url: string): Promise<string> {
    try {
      const parsed = new URL(url);
      // Normalize mobile URLs to desktop
      if (parsed.hostname === 'm.v.qq.com') {
        parsed.hostname = 'v.qq.com';
        return parsed.toString();
      }
    } catch { /* fall through */ }
    return url;
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    const vid = extractTencentVid(url);
    if (!vid) throw new Error(`Could not extract video ID from URL: ${url}`);

    const canonicalUrl = url.includes('/x/page/')
      ? `https://v.qq.com/x/page/${vid}.html`
      : url;

    // Try yt-dlp first for rich metadata; fall back to page scraping so the
    // video card still renders and the "Play Online" button works even when
    // yt-dlp's Tencent extractor is broken or the video is VIP-only.
    let ytdlpInfo: YtdlpVideoJson | null = null;
    try {
      ytdlpInfo = ytdlpGetInfo(canonicalUrl);
    } catch {
      // yt-dlp failed — fall through to page metadata
    }

    // Supplement / replace with page metadata when needed
    const needsPageMeta = !ytdlpInfo || !ytdlpInfo.title || !ytdlpInfo.thumbnail
      || (!ytdlpInfo.uploader && !ytdlpInfo.channel && !ytdlpInfo.creator);
    const pageMeta = needsPageMeta ? await fetchPageMetadata(canonicalUrl) : {};

    // If both yt-dlp and page metadata fail, we can't proceed
    if (!ytdlpInfo && !pageMeta.title) {
      throw new Error('Could not retrieve video information. The video may be unavailable or region-restricted.');
    }

    const author = ytdlpInfo?.uploader ?? ytdlpInfo?.channel ?? ytdlpInfo?.creator
      ?? ytdlpInfo?.series ?? pageMeta.author ?? 'Tencent Video';

    return {
      id: vid,
      title: ytdlpInfo?.title ?? pageMeta.title ?? 'Untitled',
      author,
      description: ytdlpInfo?.description ?? pageMeta.description ?? '',
      // Store the page URL — yt-dlp will use this to download the HLS stream
      videoUrl: canonicalUrl,
      coverUrl: ytdlpInfo?.thumbnail ?? pageMeta.coverUrl ?? '',
      duration: ytdlpInfo?.duration,
      hasWatermark: false,
      platform: 'tencent',
    };
  }

  async getCollectionInfo(url: string): Promise<CollectionInfo | null> {
    const coverId = extractTencentCoverId(url);
    if (!coverId) return null;

    // Only treat pure cover pages as series; episode URLs should resolve as single video
    if (!isTencentSeriesUrl(url)) return null;

    if (!checkYtdlp()) return null;

    try {
      const seriesUrl = `https://v.qq.com/x/cover/${coverId}.html`;
      const output = execSync(
        `yt-dlp --flat-playlist --dump-json --no-download --no-warnings "${seriesUrl}"`,
        { stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 50 * 1024 * 1024 }
      );

      const lines = output.toString().trim().split('\n');
      const entries: Array<{ id: string; title: string; uploader?: string; duration?: number; url: string }> = [];
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch { /* skip bad lines */ }
      }

      if (entries.length === 0) return null;

      // Resolve each episode to get metadata
      const videos: VideoInfo[] = [];
      for (const entry of entries) {
        try {
          const episodeUrl = `https://v.qq.com/x/cover/${coverId}/${entry.id}.html`;
          const info = await this.getVideoInfo(episodeUrl);
          videos.push(info);
        } catch { /* skip unavailable */ }
      }

      if (videos.length === 0) return null;

      return {
        id: coverId,
        name: videos[0]?.title?.split(/[第EP]/)?.[0]?.trim() || 'Tencent Video Series',
        desc: '',
        videoCount: videos.length,
        videos,
      };
    } catch {
      return null;
    }
  }
}
