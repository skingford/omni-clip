const DOUYIN_URL_PATTERN = /https?:\/\/(?:www\.)?(?:v\.)?(?:ies)?douyin\.com\/[^\s]+/;
const YOUTUBE_URL_PATTERN = /https?:\/\/(?:(?:www\.|m\.)?youtube\.com|youtu\.be)\/[^\s]+/;
const TENCENT_URL_PATTERN = /https?:\/\/(?:m\.)?v\.qq\.com\/[^\s]+/;

export function extractUrlFromText(text: string): string | null {
  const douyinMatch = text.match(DOUYIN_URL_PATTERN);
  if (douyinMatch) return douyinMatch[0].replace(/[）)]+$/, '');

  const youtubeMatch = text.match(YOUTUBE_URL_PATTERN);
  if (youtubeMatch) return youtubeMatch[0].replace(/[）)]+$/, '');

  const tencentMatch = text.match(TENCENT_URL_PATTERN);
  if (tencentMatch) return tencentMatch[0].replace(/[）)]+$/, '');

  return null;
}

export function isDouyinUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('douyin.com') || parsed.hostname.endsWith('iesdouyin.com');
  } catch {
    return false;
  }
}

export function isDouyinShortLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'v.douyin.com';
  } catch {
    return false;
  }
}

export function extractVideoId(url: string): string | null {
  // Match /video/ID path pattern
  const pathMatch = url.match(/\/video\/(\d+)/);
  if (pathMatch) return pathMatch[1];

  // Match modal_id query parameter (e.g. user profile page with video modal)
  try {
    const parsed = new URL(url);
    const modalId = parsed.searchParams.get('modal_id');
    if (modalId && /^\d+$/.test(modalId)) return modalId;
  } catch {
    // not a valid URL, fall through
  }

  return null;
}

export function isMixUrl(url: string): boolean {
  return /\/mix\/detail\/\d+/.test(url) || /\/collection\/\d+/.test(url);
}

export function extractMixId(url: string): string | null {
  // Match /mix/detail/ID or /collection/ID path patterns
  const pathMatch = url.match(/\/(?:mix\/detail|collection)\/(\d+)/);
  if (pathMatch) return pathMatch[1];

  // Match object_id query parameter
  try {
    const parsed = new URL(url);
    const objectId = parsed.searchParams.get('object_id');
    if (objectId && /^\d+$/.test(objectId)) return objectId;
  } catch {
    // fall through
  }

  return null;
}

export function normalizeUrl(input: string): string {
  const extracted = extractUrlFromText(input);
  return extracted ?? input.trim();
}

// ── Tencent Video (v.qq.com) ──

export function isTencentVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'v.qq.com' || parsed.hostname === 'm.v.qq.com';
  } catch {
    return false;
  }
}

/**
 * Extract vid from Tencent Video URL.
 * Supports:
 *   /x/page/<vid>.html
 *   /x/cover/<cid>/<vid>.html
 */
export function extractTencentVid(url: string): string | null {
  // /x/page/<vid>.html
  const pageMatch = url.match(/\/x\/page\/([a-zA-Z0-9]+)\.html/);
  if (pageMatch) return pageMatch[1];

  // /x/cover/<cid>/<vid>.html — vid is the second path segment
  const coverMatch = url.match(/\/x\/cover\/[a-zA-Z0-9]+\/([a-zA-Z0-9]+)\.html/);
  if (coverMatch) return coverMatch[1];

  // Query param: ?vid=xxx
  try {
    const parsed = new URL(url);
    const vid = parsed.searchParams.get('vid');
    if (vid && /^[a-zA-Z0-9]+$/.test(vid)) return vid;
  } catch { /* fall through */ }

  return null;
}

/**
 * Extract cover/series ID from Tencent Video URL.
 * Matches /x/cover/<cid>.html or /x/cover/<cid>/<vid>.html
 */
export function extractTencentCoverId(url: string): string | null {
  const match = url.match(/\/x\/cover\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Detect if this is a Tencent Video series/playlist page (cover page without vid).
 * /x/cover/<cid>.html — series listing
 * /x/cover/<cid>/<vid>.html — NOT series (specific episode)
 */
export function isTencentSeriesUrl(url: string): boolean {
  return /\/x\/cover\/[a-zA-Z0-9]+\.html/.test(url) && !extractTencentVid(url);
}
