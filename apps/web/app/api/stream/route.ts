import { NextRequest, NextResponse } from 'next/server';
import { getStream } from '@/lib/stream-store';

const PROXY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** Resolve a URL that may be relative to a base URL. */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) {
    const origin = new URL(baseUrl).origin;
    return origin + url;
  }
  return baseUrl + url;
}

/** Rewrite URLs inside an m3u8 manifest to route through our proxy. */
function rewriteM3u8(content: string, baseUrl: string, token: string): string {
  return content.split('\n').map((line) => {
    const trimmed = line.trim();
    // Skip empty lines and comment/tag lines (except URI= inside tags)
    if (!trimmed || trimmed.startsWith('#')) {
      // Handle URI="..." inside EXT-X tags (e.g., EXT-X-KEY, EXT-X-MAP)
      return trimmed.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        const absolute = resolveUrl(uri, baseUrl);
        const encoded = Buffer.from(absolute).toString('base64url');
        return `URI="/api/stream?token=${token}&url=${encoded}"`;
      });
    }
    // This is a segment or sub-manifest URL
    const absolute = resolveUrl(trimmed, baseUrl);
    const encoded = Buffer.from(absolute).toString('base64url');
    return `/api/stream?token=${token}&url=${encoded}`;
  }).join('\n');
}

function isM3u8(url: string, contentType?: string | null): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('mpegurl') || ct.includes('m3u')) return true;
  }
  const path = url.split('?')[0].toLowerCase();
  return path.endsWith('.m3u8') || path.endsWith('.m3u');
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const entry = getStream(token);
  if (!entry) {
    return NextResponse.json({ error: 'Stream expired or not found' }, { status: 404 });
  }

  const segmentUrl = searchParams.get('url');

  // If no url param, serve the root m3u8 manifest
  const targetUrl = segmentUrl
    ? Buffer.from(segmentUrl, 'base64url').toString()
    : entry.streamUrl;

  const targetBase = (() => {
    const lastSlash = targetUrl.lastIndexOf('/');
    return lastSlash > 0 ? targetUrl.substring(0, lastSlash + 1) : entry.baseUrl;
  })();

  try {
    // Forward Range header for MP4 seeking support
    const rangeHeader = request.headers.get('range');
    const fetchHeaders: Record<string, string> = {
      'User-Agent': PROXY_UA,
      Referer: 'https://v.qq.com/',
      Origin: 'https://v.qq.com',
    };
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const res = await fetch(targetUrl, { headers: fetchHeaders });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get('content-type');

    // If this is an m3u8, rewrite URLs
    if (isM3u8(targetUrl, contentType)) {
      const text = await res.text();
      const rewritten = rewriteM3u8(text, targetBase, token);
      return new NextResponse(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Otherwise, proxy the binary content (ts segments, mp4, etc.)
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType ?? 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
    };
    // Forward range-related headers for MP4 seeking
    const contentRange = res.headers.get('content-range');
    const contentLength = res.headers.get('content-length');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    return new NextResponse(res.body, {
      status: res.status, // Preserves 206 Partial Content
      headers: responseHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Proxy fetch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
