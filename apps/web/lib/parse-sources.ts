export interface ParseResult {
  streamUrl: string;
  type: 'hls' | 'mp4';
}

const FETCH_TIMEOUT = 15_000;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ============================================================
// Native Tencent Video API parser (primary)
// ============================================================

interface TencentGetInfoResponse {
  em: number;
  vl?: {
    vi?: Array<{
      fn: string;
      fvkey: string;
      ti: string;
      td: number;
      ul?: {
        ui?: Array<{ url: string }>;
      };
    }>;
  };
  fl?: {
    fi?: Array<{ id: number; name: string }>;
  };
}

/**
 * Extract video ID from a Tencent Video page URL.
 * Supports: /x/page/<vid>.html, /x/cover/<cid>/<vid>.html, ?vid=xxx
 */
function extractVidFromUrl(url: string): string | null {
  const pageMatch = url.match(/\/x\/page\/([a-zA-Z0-9]+)\.html/);
  if (pageMatch) return pageMatch[1];

  const coverMatch = url.match(/\/x\/cover\/[a-zA-Z0-9]+\/([a-zA-Z0-9]+)\.html/);
  if (coverMatch) return coverMatch[1];

  try {
    const parsed = new URL(url);
    const vid = parsed.searchParams.get('vid');
    if (vid) return vid;
  } catch { /* not a valid URL */ }

  return null;
}

/**
 * Parse a Tencent Video URL using Tencent's own getinfo API.
 * Returns a direct MP4 URL for non-VIP content.
 */
async function parseTencentNative(videoPageUrl: string): Promise<ParseResult | null> {
  const vid = extractVidFromUrl(videoPageUrl);
  if (!vid) return null;

  try {
    const apiUrl = `http://vv.video.qq.com/getinfo?vid=${vid}&platform=11&otype=json&defn=shd&defnpayver=1&appver=3.2.19.333`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const raw = await res.text();
    // Response is JSONP: QZOutputJson={...};
    const jsonStr = raw.replace(/^QZOutputJson=/, '').replace(/;$/, '');
    const data: TencentGetInfoResponse = JSON.parse(jsonStr);

    if (data.em !== 0) {
      console.log(`[parse:tencent-native] API error em=${data.em}`);
      return null;
    }

    const vi = data.vl?.vi?.[0];
    if (!vi || !vi.fvkey || !vi.ul?.ui?.length) {
      console.log('[parse:tencent-native] No video info in response');
      return null;
    }

    const cdnBase = vi.ul.ui[0].url;
    const filename = vi.fn;
    const fvkey = vi.fvkey;

    const streamUrl = `${cdnBase}${filename}?vkey=${fvkey}`;

    // Verify the URL works (HEAD request)
    const check = await fetch(streamUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
    });

    if (!check.ok) {
      console.log(`[parse:tencent-native] URL check failed: ${check.status}`);
      return null;
    }

    console.log(`[parse:tencent-native] Success: ${filename}`);
    return { streamUrl, type: 'mp4' };
  } catch (e) {
    console.log(`[parse:tencent-native] Failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ============================================================
// Third-party parse sources (fallback)
// ============================================================

export interface ParseSource {
  name: string;
  api: string;
  extract: (body: string) => ParseResult | null;
}

function extractFromHtmlPlayer(html: string): ParseResult | null {
  // Pattern 1: var url = "https://...m3u8"
  const urlMatch = html.match(
    /(?:var|let|const)\s+(?:url|video_url|videoUrl|vUrl|playUrl|src)\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
  );
  if (urlMatch) return { streamUrl: urlMatch[1], type: 'hls' };

  // Pattern 2: url: "https://...m3u8" (JSON config)
  const jsonUrlMatch = html.match(
    /['"]?(?:url|video|src)['"]?\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
  );
  if (jsonUrlMatch) return { streamUrl: jsonUrlMatch[1], type: 'hls' };

  // Pattern 3: <source src="...">
  const sourceMatch = html.match(/<source[^>]+src=['"]([^'"]+\.(?:mp4|m3u8)[^'"]*)['"]/i);
  if (sourceMatch) {
    const url = sourceMatch[1];
    return { streamUrl: url, type: url.includes('.m3u8') ? 'hls' : 'mp4' };
  }

  // Pattern 4: Any m3u8 URL
  const m3u8Match = html.match(/['"]?(https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*)/i);
  if (m3u8Match) return { streamUrl: m3u8Match[1], type: 'hls' };

  // Pattern 5: Any mp4 URL
  const mp4Match = html.match(/['"]?(https?:\/\/[^\s'"<>]+\.mp4[^\s'"<>]*)/i);
  if (mp4Match) return { streamUrl: mp4Match[1], type: 'mp4' };

  return null;
}

function extractFromJson(text: string): ParseResult | null {
  try {
    const data = JSON.parse(text);
    const url = data.url || data.data?.url || data.data?.video_url || data.video_url;
    if (url && typeof url === 'string') {
      return { streamUrl: url, type: url.includes('.m3u8') ? 'hls' : 'mp4' } as ParseResult;
    }
  } catch { /* not JSON */ }
  return null;
}

const thirdPartySources: ParseSource[] = [
  { name: 'xmflv', api: 'https://jx.xmflv.com/?url={url}', extract: extractFromHtmlPlayer },
  { name: 'aidouer', api: 'https://jx.aidouer.net/?url={url}', extract: extractFromHtmlPlayer },
  { name: 'playm3u8', api: 'https://jx.playerjy.com/?url={url}', extract: extractFromHtmlPlayer },
  { name: 'yemu', api: 'https://www.yemu.xyz/?url={url}', extract: extractFromHtmlPlayer },
];

function loadSources(): ParseSource[] {
  const envSources = process.env.PARSE_SOURCES;
  if (!envSources) return thirdPartySources;

  const custom: ParseSource[] = envSources.split(',').map((entry) => {
    const [name, api] = entry.trim().split('|');
    if (!name || !api) return null;
    return { name: name.trim(), api: api.trim(), extract: extractFromHtmlPlayer } as ParseSource;
  }).filter((s): s is ParseSource => s !== null);

  return custom.length > 0 ? custom : thirdPartySources;
}

// ============================================================
// Main parse function
// ============================================================

export async function parseVideoUrl(videoPageUrl: string): Promise<ParseResult> {
  // 1. Try native Tencent API first (most reliable for non-VIP content)
  const nativeResult = await parseTencentNative(videoPageUrl);
  if (nativeResult) return nativeResult;

  // 2. Fall back to third-party parsing services
  const sources = loadSources();
  const encodedUrl = encodeURIComponent(videoPageUrl);

  for (const source of sources) {
    const apiUrl = source.api.replace('{url}', encodedUrl);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': BROWSER_UA, Referer: apiUrl },
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const body = await res.text();
      const result = extractFromJson(body) ?? source.extract(body);
      if (result) {
        console.log(`[parse] Source "${source.name}" succeeded: ${result.type}`);
        return result;
      }
    } catch (e) {
      console.log(`[parse] Source "${source.name}" failed: ${e instanceof Error ? e.message : e}`);
      continue;
    }
  }

  throw new Error('Could not parse video for online playback. The video may require VIP access.');
}
