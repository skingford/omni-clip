## Context

Omni-clip is a greenfield TypeScript project. There is no existing code — this is the first feature being built. The project aims to be a multi-platform video downloading tool, starting with Douyin (抖音).

Douyin's web interface serves video content through a combination of:
1. Share links (short URLs like `v.douyin.com/xxx`) that redirect to full page URLs
2. Server-rendered pages that embed video metadata in `<script>` tags (typically as `RENDER_DATA` or similar JSON blobs)
3. Video CDN URLs that serve the actual MP4 files

The tool runs locally as a Node.js CLI application.

## Goals / Non-Goals

**Goals:**
- Accept any Douyin video URL format (share link, short link, full URL) and download the video
- Extract video metadata (title, author, cover) alongside the download
- Establish a clean adapter pattern so adding new platforms (Bilibili, Kuaishou) later is straightforward
- Provide both a CLI interface and a programmatic TypeScript API
- Download watermark-free video when possible

**Non-Goals:**
- GUI / web interface (CLI only for now)
- Batch downloading / playlist support
- User authentication / login to Douyin
- Video format conversion or transcoding
- Downloading comments, likes, or other social data
- Real-time monitoring of new videos from an account

## Decisions

### 1. TypeScript + Node.js runtime
**Choice**: TypeScript with Node.js (ESM modules)
**Why**: TypeScript provides type safety for complex API response parsing. Node.js has excellent HTTP/stream support for downloading. ESM for modern module syntax.
**Alternatives**: Python (popular for scraping, but this project is TypeScript-focused), Go (fast but less convenient for rapid API parsing iteration).

### 2. Adapter pattern for platform support
**Choice**: Each platform (Douyin, future Bilibili, etc.) implements a `PlatformAdapter` interface with methods: `canHandle(url)`, `resolve(url)`, and `getVideoInfo(url)`.
**Why**: Clean separation of concerns. Adding a new platform = adding a new adapter file. The resolver iterates adapters and delegates to the first one that `canHandle` the URL.
**Alternatives**: Monolithic parser with switch statements (doesn't scale), plugin system (overengineered for current scope).

### 3. HTTP client: Node.js built-in `fetch` + `node:stream`
**Choice**: Use Node.js built-in `fetch` for API requests and `node:stream` for file downloads.
**Why**: Zero external dependencies for HTTP. Node 18+ has stable `fetch`. Stream-based download handles large files without memory issues.
**Alternatives**: `axios` (unnecessary dependency), `undici` (Node's fetch is built on undici already), `got` (overkill).

### 4. Short link resolution via HTTP redirect following
**Choice**: Follow redirects from `v.douyin.com` short links to obtain the canonical URL, then parse the video ID from it.
**Why**: Simple and reliable. Douyin short links are standard HTTP 302 redirects.
**Alternatives**: Regex parsing of short link IDs (fragile, depends on URL format).

### 5. Video info extraction via Douyin web API
**Choice**: Fetch the Douyin video page and extract the embedded JSON data (e.g., `RENDER_DATA` or `__NEXT_DATA__`) that contains video metadata and CDN URLs.
**Why**: The web page embeds all necessary data in server-rendered JSON. No need for complex API authentication.
**Alternatives**: Mobile API (requires device fingerprinting), scraping HTML (fragile), third-party APIs (dependency risk).

### 6. Project structure
```
src/
  index.ts           # Public API exports
  cli.ts             # CLI entry point
  types.ts           # Shared types and interfaces
  resolver/
    index.ts         # URL resolver — delegates to adapters
  adapters/
    base.ts          # PlatformAdapter interface
    douyin.ts        # Douyin implementation
  downloader/
    index.ts         # File download with progress
  utils/
    url.ts           # URL parsing utilities
    filename.ts      # Safe filename generation
```

## Risks / Trade-offs

- **[Douyin API instability]** → Douyin frequently changes their web API structure. Mitigation: isolate all Douyin-specific parsing in the adapter; make the JSON extraction path configurable or easy to update.
- **[Anti-scraping measures]** → Douyin may block requests without proper headers. Mitigation: use realistic User-Agent and Referer headers; add cookie support if needed later.
- **[Watermark-free URL availability]** → The watermark-free video URL may not always be available in the page data. Mitigation: fall back to the standard (watermarked) URL with a warning.
- **[Large file downloads]** → Videos can be hundreds of MB. Mitigation: stream-based download with progress reporting; don't buffer in memory.
- **[Legal concerns]** → Downloading videos may violate ToS. Mitigation: clearly document that the tool is for personal use only; add disclaimer.
