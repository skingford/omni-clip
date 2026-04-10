## ADDED Requirements

### Requirement: Download video to local file
The downloader SHALL download a video from a given URL and save it to a specified local directory. The file SHALL be written using streams to avoid buffering the entire file in memory.

#### Scenario: Successful download
- **WHEN** a valid video URL and output directory are provided
- **THEN** the system SHALL download the video and save it as an MP4 file in the specified directory

#### Scenario: Output directory does not exist
- **WHEN** the output directory does not exist
- **THEN** the system SHALL create the directory recursively before downloading

### Requirement: Generate meaningful filenames
The downloader SHALL generate filenames based on the video title and author, sanitized for filesystem compatibility. The format SHALL be `{author}-{title}.mp4` with special characters replaced.

#### Scenario: Filename generation from metadata
- **WHEN** a video has author "张三" and title "美丽的风景"
- **THEN** the saved filename SHALL be `张三-美丽的风景.mp4`

#### Scenario: Filename with special characters
- **WHEN** a video title contains filesystem-unsafe characters like `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`
- **THEN** those characters SHALL be replaced with underscores

#### Scenario: Duplicate filename
- **WHEN** a file with the same name already exists in the output directory
- **THEN** the system SHALL append a numeric suffix (e.g., `张三-美丽的风景_1.mp4`)

### Requirement: Download progress reporting
The downloader SHALL report download progress via a callback function, providing bytes downloaded and total bytes (when available from Content-Length header).

#### Scenario: Progress callback is invoked during download
- **WHEN** a progress callback is provided
- **THEN** the callback SHALL be called periodically with `{ downloaded: number, total: number | null, percentage: number | null }`

### Requirement: Error handling for failed downloads
The downloader SHALL handle network errors gracefully and provide descriptive error messages.

#### Scenario: Network error during download
- **WHEN** the network connection is lost during download
- **THEN** the system SHALL throw an error and clean up any partially downloaded file

#### Scenario: HTTP error response
- **WHEN** the video URL returns a 403 or 404 HTTP status
- **THEN** the system SHALL throw an error indicating the video URL is invalid or expired
