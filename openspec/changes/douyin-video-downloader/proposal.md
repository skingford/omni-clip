## Why

Omni-clip needs a core video acquisition capability to fulfill its mission as a multi-source video tool. Douyin (抖音) is one of the most popular short video platforms in China with massive content volume. Users need a simple way to paste a Douyin share link and get the original video downloaded locally — without watermarks, without manual steps. Starting with Douyin establishes the foundational architecture that future platform adapters (Bilibili, Kuaishou, etc.) will extend.

## What Changes

- Add a CLI tool / module that accepts a Douyin video URL (share link or short link)
- Automatically resolve short links (e.g., `v.douyin.com/xxx`) to full video pages
- Extract video metadata (title, author, description, cover image URL)
- Parse and obtain the watermark-free video download URL
- Download the video file to a local directory with a meaningful filename
- Provide a clean TypeScript API that future platform adapters can follow

## Capabilities

### New Capabilities
- `video-resolver`: Core URL resolution engine — handles short link expansion, redirect following, and platform detection. Establishes the adapter pattern for multi-platform support.
- `douyin-adapter`: Douyin-specific video parsing — extracts video metadata and watermark-free download URL from Douyin pages using their web API.
- `video-downloader`: Downloads video files from resolved URLs to local storage with progress tracking and meaningful filenames.

### Modified Capabilities
<!-- None — this is the first feature -->

## Impact

- **New dependencies**: HTTP client library (e.g., `undici` or `node-fetch`), possibly a progress bar library
- **New directories**: `src/resolvers/`, `src/adapters/`, `src/downloader/`
- **External APIs**: Douyin web API (unofficial, reverse-engineered endpoints)
- **Network**: Requires internet access to resolve links and download videos
- **Legal**: Users are responsible for copyright compliance; tool is for personal use
