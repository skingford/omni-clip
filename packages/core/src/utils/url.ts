const DOUYIN_URL_PATTERN = /https?:\/\/(?:www\.)?(?:v\.)?(?:ies)?douyin\.com\/[^\s]+/;
const YOUTUBE_URL_PATTERN = /https?:\/\/(?:(?:www\.|m\.)?youtube\.com|youtu\.be)\/[^\s]+/;

export function extractUrlFromText(text: string): string | null {
  const douyinMatch = text.match(DOUYIN_URL_PATTERN);
  if (douyinMatch) return douyinMatch[0].replace(/[）)]+$/, '');

  const youtubeMatch = text.match(YOUTUBE_URL_PATTERN);
  if (youtubeMatch) return youtubeMatch[0].replace(/[）)]+$/, '');

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
