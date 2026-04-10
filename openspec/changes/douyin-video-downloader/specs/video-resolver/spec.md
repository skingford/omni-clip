## ADDED Requirements

### Requirement: URL resolution accepts multiple Douyin URL formats
The system SHALL accept and resolve the following Douyin URL formats:
- Short share links: `https://v.douyin.com/xxxxx/`
- Full web URLs: `https://www.douyin.com/video/xxxxxxxxxxxxx`
- Mobile share text containing a URL (extract the URL from surrounding text)

#### Scenario: Resolve a Douyin short link
- **WHEN** user provides `https://v.douyin.com/iRNBho5m/`
- **THEN** the system SHALL follow redirects and return the canonical video page URL

#### Scenario: Accept a full Douyin video URL
- **WHEN** user provides `https://www.douyin.com/video/7356534653456345`
- **THEN** the system SHALL recognize it as a valid Douyin URL and pass it through without redirect resolution

#### Scenario: Extract URL from share text
- **WHEN** user provides text like `"4.36 February 复制打开抖音，看看【xxx的作品】... https://v.douyin.com/iRNBho5m/"`
- **THEN** the system SHALL extract the URL `https://v.douyin.com/iRNBho5m/` and resolve it

### Requirement: Platform adapter delegation
The system SHALL use an adapter pattern to delegate URL handling to the appropriate platform adapter. The resolver SHALL iterate registered adapters and use the first one whose `canHandle(url)` method returns `true`.

#### Scenario: Douyin URL is handled by Douyin adapter
- **WHEN** a URL matching `douyin.com` is provided
- **THEN** the system SHALL delegate to the Douyin adapter

#### Scenario: Unsupported URL is rejected
- **WHEN** a URL not matching any registered adapter is provided (e.g., `https://youtube.com/watch?v=xxx`)
- **THEN** the system SHALL throw an error indicating the platform is not supported

### Requirement: Video ID extraction
The system SHALL extract the Douyin video ID from the resolved canonical URL. The video ID is the numeric identifier in the URL path.

#### Scenario: Extract video ID from canonical URL
- **WHEN** the canonical URL is `https://www.douyin.com/video/7356534653456345`
- **THEN** the system SHALL extract `7356534653456345` as the video ID
