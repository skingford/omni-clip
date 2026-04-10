# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# CLI (root)
npm run build          # tsc → dist/
npm run dev            # tsc --watch
npm run start          # node dist/cli.js

# Web (web/)
cd web
npm run dev            # Next.js dev server on :3000
npm run build          # Production build
npm run start          # Production server
```

Both `tsc --noEmit` (root) and `next build` (web/) must pass. Always verify both after changes to `src/`.

## Architecture

Monorepo with two entry points sharing core code:

- **`src/`** — CLI library. TypeScript, ESM (`"type": "module"`), zero production dependencies. Outputs to `dist/`.
- **`web/`** — Next.js 15 (App Router) frontend. Imports `src/` via `@omni-clip/*` webpack alias.

### Adapter Pattern

`PlatformAdapter` interface in `src/types.ts` defines how platforms are added. `VideoResolver` is a registry that routes URLs to the first matching adapter.

To add a new platform: create `src/adapters/<name>.ts` implementing `PlatformAdapter`, register in `src/cli.ts` and `web/lib/bridge.ts`.

### Web ↔ CLI Code Sharing

`web/lib/bridge.ts` wraps `VideoResolver` + `DouyinAdapter` for server-side use in API routes. Webpack config in `next.config.ts` handles:
- `@omni-clip` alias → `../src`
- `extensionAlias`: `.js` → `['.ts', '.js']` (ESM convention)
- Parent `src/` added to webpack `resolve.modules` and rule `include` paths

### Token Store

Video URLs are never exposed to the client. `web/lib/store.ts` maps UUID tokens to `VideoInfo` with 5-minute TTL. `/api/resolve` returns tokens; `/api/download` proxy-streams video using the stored URL.

### Collection/Batch Downloads

`PlatformAdapter.getCollectionInfo?()` returns `CollectionInfo` with all videos. `/api/resolve` attempts collection detection alongside single video resolve. `storeBatch()` generates per-video tokens. `CollectionView` component handles batch UI.

## Key Conventions

- **ESM `.js` extensions**: All imports in `src/` use `.js` extensions (`import from './types.js'`). Web's webpack resolves these to `.ts`.
- **ES2022 target**: Both root and web tsconfigs target ES2022 (required for regex dotAll flag in Douyin adapter).
- **CSS Modules + CSS Variables**: No Tailwind. Design system tokens in `web/app/globals.css`, component styles in `.module.css` files.
- **Design system**: Apple-inspired (`DESIGN.md`). Single accent color `#0071e3`, alternating black/`#f5f5f7` sections, system-ui font stack.

## Douyin Adapter Notes

- `iesdouyin.com/share/video/ID/` — used for single video info (simpler, no auth)
- `www.douyin.com/video/ID` — desktop page, used for collection/mix metadata only
- Mobile UA for video resolution, desktop UA for collection detection
- `extractVideoId()` handles both `/video/ID` paths and `?modal_id=ID` query params
- Video CDN URLs are time-limited signed URLs; token store TTL reflects this
