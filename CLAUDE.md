# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# Install (Bun workspaces)
bun install

# CLI
bun run packages/core/src/cli.ts          # Run CLI directly
bun run --filter @omni-clip/core start     # Via workspace script

# Web (apps/web)
bun run dev                                # Next.js dev server on :3000
bun run --filter @omni-clip/web build      # Production build
bun run --filter @omni-clip/web start      # Production server

# Type check
cd packages/core && bunx tsc --noEmit
cd apps/web && bunx tsc --noEmit
```

Both type checks must pass. Always verify both after changes to `packages/core/src/`.

## Architecture

Bun Workspaces monorepo with two packages:

- **`packages/core/`** (`@omni-clip/core`) — Core library. TypeScript, ESM, zero production dependencies. Exports via `package.json` `exports` map.
- **`apps/web/`** (`@omni-clip/web`) — Next.js 15 (App Router) frontend. Imports `@omni-clip/core` as a workspace dependency.

### Adapter Pattern

`PlatformAdapter` interface in `packages/core/src/types.ts` defines how platforms are added. `VideoResolver` is a registry that routes URLs to the first matching adapter.

Current adapters: `DouyinAdapter`, `YouTubeAdapter`. To add a new platform: create `packages/core/src/adapters/<name>.ts` implementing `PlatformAdapter`, register in `packages/core/src/cli.ts` and `apps/web/lib/bridge.ts`.

### Web ↔ Core Code Sharing

`apps/web/lib/bridge.ts` wraps `VideoResolver` + `DouyinAdapter` for server-side use in API routes. `@omni-clip/core` is a Bun workspace dependency — `next.config.ts` uses `transpilePackages` to compile the raw `.ts` source.

### Token Store

Video URLs are never exposed to the client. `apps/web/lib/store.ts` maps UUID tokens to `VideoInfo` with 5-minute TTL. `/api/resolve` returns tokens; `/api/download` proxy-streams video using the stored URL.

### Collection/Batch Downloads

`PlatformAdapter.getCollectionInfo?()` returns `CollectionInfo` with all videos. `/api/resolve` attempts collection detection alongside single video resolve. `storeBatch()` generates per-video tokens. `CollectionView` component handles batch UI.

## Key Conventions

- **Extensionless imports**: All imports use extensionless specifiers (`import from './types'`). Bun resolves `.ts` natively.
- **ES2022 target**: Both tsconfigs target ES2022 (required for regex dotAll flag in Douyin adapter).
- **CSS Modules + CSS Variables**: No Tailwind. Design system tokens in `apps/web/app/globals.css`, component styles co-located in `.module.css` files.
- **Design system**: Apple-inspired (`DESIGN.md`). Single accent color `#0071e3`, alternating black/`#f5f5f7` sections, system-ui font stack.
- **Component organization**: Feature-based directories under `apps/web/components/` — `layout/`, `hero/`, `video/`, `collection/`. Shared types in `components/types.ts`. Custom hooks in `hooks/`.
- **Server/Client boundary**: `page.tsx` is a Server Component. Client interactivity is encapsulated in `VideoResolverClient` (`'use client'`). `Navigation` and `Footer` remain server-rendered.
- **Package exports**: `@omni-clip/core` exposes subpath exports (e.g., `@omni-clip/core/utils/filename`). Barrel export in `packages/core/src/index.ts` for main types/classes.

## YouTube Adapter Notes

- **Requires `yt-dlp` installed** (`brew install yt-dlp`) — YouTube's PoToken requirement makes zero-dep extraction impossible
- Video metadata (title, author, thumbnail, duration) extracted from watch page HTML (`ytInitialPlayerResponse`)
- Streaming URLs obtained via `yt-dlp --dump-json` with format `best[ext=mp4][protocol=https]`
- Playlist support via `yt-dlp --flat-playlist`
- URL patterns: `youtube.com/watch`, `youtu.be/`, `/shorts/`, `/embed/`, `m.youtube.com`
- Adapter gracefully errors with install instructions if yt-dlp is missing

## Douyin Adapter Notes

- `iesdouyin.com/share/video/ID/` — used for single video info (simpler, no auth)
- `www.douyin.com/video/ID` — desktop page, used for collection/mix metadata only
- Mobile UA for video resolution, desktop UA for collection detection
- `extractVideoId()` handles both `/video/ID` paths and `?modal_id=ID` query params
- Video CDN URLs are time-limited signed URLs; token store TTL reflects this
