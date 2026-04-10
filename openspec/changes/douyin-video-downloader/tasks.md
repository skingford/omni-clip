## 1. Project Setup

- [x] 1.1 Initialize Node.js project with package.json (type: module, TypeScript)
- [x] 1.2 Configure TypeScript (tsconfig.json with ESM, strict mode, output to dist/)
- [x] 1.3 Create project directory structure (src/resolver, src/adapters, src/downloader, src/utils)

## 2. Types & Interfaces

- [x] 2.1 Define shared types in src/types.ts (VideoInfo, PlatformAdapter interface, DownloadOptions, DownloadProgress)

## 3. Utility Functions

- [x] 3.1 Implement URL parsing utilities in src/utils/url.ts (extractUrlFromText, isDouyinUrl)
- [x] 3.2 Implement filename sanitization in src/utils/filename.ts (sanitizeFilename, generateVideoFilename, handleDuplicate)

## 4. URL Resolver

- [x] 4.1 Implement resolver in src/resolver/index.ts (register adapters, iterate canHandle, delegate to matching adapter)

## 5. Douyin Adapter

- [x] 5.1 Implement Douyin adapter in src/adapters/douyin.ts (canHandle, resolve short links, fetch page data, parse video info)

## 6. Video Downloader

- [x] 6.1 Implement downloader in src/downloader/index.ts (stream-based download, progress callback, error handling, partial file cleanup)

## 7. CLI Interface

- [x] 7.1 Implement CLI entry point in src/cli.ts (parse args, call resolver + downloader, display progress, output result)

## 8. Public API & Entry Point

- [x] 8.1 Create src/index.ts with public API exports (download function that combines resolver + downloader)

## 9. Build & Test

- [x] 9.1 Add build script and verify TypeScript compilation
- [x] 9.2 Add bin entry in package.json for CLI usage
