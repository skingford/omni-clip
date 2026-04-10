import type { PlatformAdapter, VideoInfo, CollectionInfo } from '../types.js';
import { isDouyinUrl, isDouyinShortLink, extractVideoId } from '../utils/url.js';

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': MOBILE_UA,
  Referer: 'https://www.douyin.com/',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

export class DouyinAdapter implements PlatformAdapter {
  readonly name = 'douyin';

  canHandle(url: string): boolean {
    return isDouyinUrl(url);
  }

  async resolve(url: string): Promise<string> {
    if (!isDouyinShortLink(url)) {
      return url;
    }

    // Follow redirects from short link to get canonical URL
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: 'manual',
    });

    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`Failed to resolve short link: ${url} — no redirect location`);
    }

    // The redirect might be another redirect, follow it
    if (isDouyinShortLink(location)) {
      return this.resolve(location);
    }

    return location;
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error(`Could not extract video ID from URL: ${url}`);
    }

    // Use iesdouyin.com share page — simpler, no cookies needed
    const shareUrl = `https://www.iesdouyin.com/share/video/${videoId}/`;
    const response = await fetch(shareUrl, {
      headers: DEFAULT_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video page: HTTP ${response.status}`);
    }

    const html = await response.text();
    return this.parseRouterData(html, videoId);
  }

  private parseRouterData(html: string, videoId: string): VideoInfo {
    // Extract _ROUTER_DATA from the page
    const match = html.match(/window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*<\/script>/s);
    if (!match) {
      throw new Error('Could not find _ROUTER_DATA in page — Douyin may have changed their page structure');
    }

    let routerData: any;
    try {
      routerData = JSON.parse(match[1]);
    } catch {
      throw new Error('Failed to parse _ROUTER_DATA JSON');
    }

    // Find the video data in loaderData
    const loaderData = routerData?.loaderData;
    if (!loaderData) {
      throw new Error('No loaderData found in _ROUTER_DATA');
    }

    // Try different key patterns
    const pageData =
      loaderData[`video_(id)/page`] ??
      loaderData[`video_${videoId}/page`] ??
      this.findVideoPageData(loaderData);

    if (!pageData) {
      throw new Error('Could not find video page data in loaderData');
    }

    const itemList = pageData?.videoInfoRes?.item_list;
    if (!itemList || itemList.length === 0) {
      throw new Error('Video is unavailable — it may have been deleted or set to private');
    }

    const item = itemList[0];
    const info = this.itemToVideoInfo(item);
    if (!info.videoUrl) {
      throw new Error('Could not extract video URI from page data');
    }
    if (!info.id) info.id = videoId;
    return info;
  }

  private findVideoPageData(loaderData: Record<string, any>): any {
    // Iterate keys to find one matching video page pattern
    for (const key of Object.keys(loaderData)) {
      if (key.startsWith('video_') || key.includes('video')) {
        const data = loaderData[key];
        if (data?.videoInfoRes?.item_list) {
          return data;
        }
      }
    }
    return null;
  }

  private itemToVideoInfo(item: any): VideoInfo {
    const videoUri = item?.video?.play_addr?.uri;
    const videoUrl = videoUri
      ? `https://www.douyin.com/aweme/v1/play/?video_id=${videoUri}`
      : '';

    return {
      id: item.aweme_id ?? '',
      title: item.desc ?? 'Untitled',
      author: item.author?.nickname ?? 'Unknown',
      description: item.desc ?? '',
      videoUrl,
      coverUrl: item.video?.cover?.url_list?.[0] ?? '',
      duration: item.video?.duration ? Math.round(item.video.duration / 1000) : undefined,
      hasWatermark: false,
      platform: 'douyin',
    };
  }

  async getCollectionInfo(url: string): Promise<CollectionInfo | null> {
    const videoId = extractVideoId(url);
    if (!videoId) return null;

    const shareUrl = `https://www.iesdouyin.com/share/video/${videoId}/`;
    const response = await fetch(shareUrl, { headers: DEFAULT_HEADERS });
    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(/window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*<\/script>/s);
    if (!match) return null;

    let routerData: any;
    try {
      routerData = JSON.parse(match[1]);
    } catch {
      return null;
    }

    const loaderData = routerData?.loaderData;
    if (!loaderData) return null;

    const pageData = loaderData[`video_(id)/page`]
      ?? loaderData[`video_${videoId}/page`]
      ?? this.findVideoPageData(loaderData);
    if (!pageData) return null;

    // Check for collection/mix data
    const mixInfo = pageData?.videoInfoRes?.mix_info;
    if (!mixInfo?.mix_id) return null;

    const mixId = mixInfo.mix_id;
    const name = mixInfo.mix_name ?? mixInfo.desc ?? 'Unknown Collection';
    const desc = mixInfo.desc ?? '';
    const stc = mixInfo.statis?.play_vv ?? 0;

    // Fetch all videos in the collection via Douyin mix API
    const videos: VideoInfo[] = [];
    let cursor = 0;
    let hasMore = true;

    while (hasMore) {
      const mixUrl = `https://www.douyin.com/aweme/v1/web/mix/aweme/?mix_id=${mixId}&count=20&cursor=${cursor}`;
      try {
        const mixResponse = await fetch(mixUrl, { headers: DEFAULT_HEADERS });
        if (!mixResponse.ok) break;

        const mixData = await mixResponse.json();
        const awemeList = mixData?.aweme_list;
        if (!Array.isArray(awemeList) || awemeList.length === 0) break;

        for (const item of awemeList) {
          const info = this.itemToVideoInfo(item);
          if (info.videoUrl) {
            videos.push(info);
          }
        }

        hasMore = mixData.has_more === 1 || mixData.has_more === true;
        cursor = mixData.cursor ?? cursor + 20;
      } catch {
        break;
      }
    }

    // Fallback: if API returned nothing, try mix_awemes from page data
    if (videos.length === 0) {
      const mixAwemes = pageData?.videoInfoRes?.mix_awemes;
      if (Array.isArray(mixAwemes)) {
        for (const item of mixAwemes) {
          const info = this.itemToVideoInfo(item);
          if (info.videoUrl) {
            videos.push(info);
          }
        }
      }
    }

    if (videos.length === 0) return null;

    return {
      id: mixId,
      name,
      desc,
      videoCount: videos.length,
      videos,
    };
  }
}
