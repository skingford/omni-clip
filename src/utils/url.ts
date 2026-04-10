const DOUYIN_URL_PATTERN = /https?:\/\/(?:www\.)?(?:v\.)?douyin\.com\/[^\s]+/;

export function extractUrlFromText(text: string): string | null {
  const match = text.match(DOUYIN_URL_PATTERN);
  return match ? match[0].replace(/[）)]+$/, '') : null;
}

export function isDouyinUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('douyin.com');
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
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

export function normalizeUrl(input: string): string {
  const extracted = extractUrlFromText(input);
  return extracted ?? input.trim();
}
