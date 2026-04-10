## ADDED Requirements

### Requirement: Douyin adapter can identify Douyin URLs
The Douyin adapter SHALL return `true` from `canHandle(url)` for any URL containing `douyin.com` in the hostname.

#### Scenario: Recognize douyin.com URLs
- **WHEN** `canHandle` is called with `https://www.douyin.com/video/123456`
- **THEN** it SHALL return `true`

#### Scenario: Recognize v.douyin.com short links
- **WHEN** `canHandle` is called with `https://v.douyin.com/iRNBho5m/`
- **THEN** it SHALL return `true`

#### Scenario: Reject non-Douyin URLs
- **WHEN** `canHandle` is called with `https://www.bilibili.com/video/BV1xx411c7mD`
- **THEN** it SHALL return `false`

### Requirement: Fetch and parse video metadata
The Douyin adapter SHALL fetch the video page and extract embedded JSON data to obtain video metadata including: title, author name, author avatar URL, video description, cover image URL, and video duration.

#### Scenario: Successfully parse video metadata
- **WHEN** the adapter fetches a valid Douyin video page
- **THEN** it SHALL return a `VideoInfo` object containing at minimum: `title`, `author`, `videoUrl`, and `coverUrl`

#### Scenario: Handle unavailable video
- **WHEN** the adapter fetches a Douyin page for a deleted or private video
- **THEN** it SHALL throw a descriptive error indicating the video is unavailable

### Requirement: Extract watermark-free video URL
The Douyin adapter SHALL attempt to extract the watermark-free (original quality) video download URL from the page data. If the watermark-free URL is not available, it SHALL fall back to the standard video URL.

#### Scenario: Watermark-free URL available
- **WHEN** the page data contains a watermark-free video URL
- **THEN** the adapter SHALL return this URL as the primary `videoUrl`

#### Scenario: Watermark-free URL not available
- **WHEN** the page data does not contain a watermark-free video URL
- **THEN** the adapter SHALL return the standard video URL and set `hasWatermark: true` in the response

### Requirement: Use appropriate HTTP headers
The Douyin adapter SHALL send requests with realistic browser headers including User-Agent, Referer, and Cookie headers to avoid being blocked by anti-scraping measures.

#### Scenario: Requests include required headers
- **WHEN** the adapter makes an HTTP request to Douyin
- **THEN** the request SHALL include a Chrome-like User-Agent header and a Referer header set to `https://www.douyin.com/`
