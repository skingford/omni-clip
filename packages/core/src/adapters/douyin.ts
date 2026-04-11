import type { PlatformAdapter, VideoInfo, CollectionInfo } from '../types';
import { isDouyinUrl, isDouyinShortLink, extractVideoId, isMixUrl, extractMixId } from '../utils/url';

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': MOBILE_UA,
  Referer: 'https://www.douyin.com/',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

const DESKTOP_HEADERS: Record<string, string> = {
  'User-Agent': DESKTOP_UA,
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
    // If this is a mix/collection URL, fetch the first video from it
    if (isMixUrl(url)) {
      const collection = await this.getCollectionByMixUrl(url);
      if (collection && collection.videos.length > 0) {
        return collection.videos[0];
      }
      throw new Error('Could not extract videos from this collection');
    }

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
    const playAddr = item?.video?.play_addr;
    const videoUri = playAddr?.uri;

    // Collect all candidate URLs: url_list from API + constructed play URL
    const urlList: string[] = Array.isArray(playAddr?.url_list) ? [...playAddr.url_list] : [];
    const constructedUrl = videoUri
      ? `https://www.douyin.com/aweme/v1/play/?video_id=${videoUri}`
      : '';

    // Primary URL: prefer url_list entries (direct CDN), fall back to constructed
    const videoUrl = urlList[0] || constructedUrl;
    // All fallback URLs for retry
    const videoUrls = [...new Set([...urlList, constructedUrl].filter(Boolean))];

    return {
      id: item.aweme_id ?? '',
      title: item.desc ?? 'Untitled',
      author: item.author?.nickname ?? 'Unknown',
      description: item.desc ?? '',
      videoUrl,
      videoUrls: videoUrls.length > 1 ? videoUrls : undefined,
      coverUrl: item.video?.cover?.url_list?.[0] ?? '',
      duration: item.video?.duration ? Math.round(item.video.duration / 1000) : undefined,
      hasWatermark: false,
      platform: 'douyin',
    };
  }

  private async getCollectionByMixUrl(url: string): Promise<CollectionInfo | null> {
    const mixId = extractMixId(url);
    if (!mixId) return null;
    return this.fetchMixVideos(mixId);
  }

  private async fetchMixVideos(mixId: string): Promise<CollectionInfo | null> {
    // Use iesdouyin.com API — works without auth, returns JSON directly
    const videos: VideoInfo[] = [];
    let cursor = 0;
    let hasMore = true;
    let collectionName = 'Collection';

    while (hasMore) {
      const apiUrl = `https://www.iesdouyin.com/web/api/mix/item/list/?mix_id=${mixId}&count=20&cursor=${cursor}`;
      try {
        const response = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
        if (!response.ok) break;

        const data = await response.json();
        if (data.status_code !== 0) break;

        const awemeList = data.aweme_list;
        if (!Array.isArray(awemeList) || awemeList.length === 0) break;

        // Use first video's mix_info for the collection name
        if (videos.length === 0 && awemeList[0]?.mix_info?.mix_name) {
          collectionName = awemeList[0].mix_info.mix_name;
        }

        for (const item of awemeList) {
          const info = this.itemToVideoInfo(item);
          if (info.videoUrl) {
            videos.push(info);
          }
        }

        hasMore = data.has_more === true || data.has_more === 1;
        cursor = data.cursor ?? cursor + 20;
      } catch {
        break;
      }
    }

    if (videos.length === 0) return null;

    return {
      id: mixId,
      name: collectionName,
      desc: '',
      videoCount: videos.length,
      videos,
    };
  }

  async getCollectionInfo(url: string): Promise<CollectionInfo | null> {
    // Direct mix/collection URL
    if (isMixUrl(url)) {
      return this.getCollectionByMixUrl(url);
    }

    const videoId = extractVideoId(url);
    if (!videoId) return null;

    // Fetch desktop page — collection data is NOT on the mobile share page
    const desktopUrl = `https://www.douyin.com/video/${videoId}`;
    const response = await fetch(desktopUrl, { headers: DESKTOP_HEADERS });
    if (!response.ok) return null;

    const html = await response.text();

    // Try _ROUTER_DATA first
    let mixInfo: any = null;
    let mixAwemes: any[] = [];

    const routerMatch = html.match(/window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*<\/script>/s);
    if (routerMatch) {
      try {
        const routerData = JSON.parse(routerMatch[1]);
        const loaderData = routerData?.loaderData;
        if (loaderData) {
          const pageData = loaderData[`video_(id)/page`]
            ?? loaderData[`video_${videoId}/page`]
            ?? this.findVideoPageData(loaderData);
          if (pageData) {
            mixInfo = pageData?.videoInfoRes?.mix_info;
            mixAwemes = pageData?.videoInfoRes?.mix_awemes ?? [];
          }
        }
      } catch { /* ignore parse errors */ }
    }

    // Also try _RENDER_DATA (URL-encoded JSON used on some desktop pages)
    if (!mixInfo) {
      const renderMatch = html.match(/window\._RENDER_DATA\s*=\s*'(.+?)'\s*<\/script>/s);
      if (renderMatch) {
        try {
          const decoded = decodeURIComponent(renderMatch[1]);
          const renderData = JSON.parse(decoded);
          // Search all top-level keys for video data with mix_info
          for (const key of Object.keys(renderData)) {
            const section = renderData[key];
            if (section?.videoInfoRes?.mix_info) {
              mixInfo = section.videoInfoRes.mix_info;
              mixAwemes = section.videoInfoRes.mix_awemes ?? [];
              break;
            }
            if (section?.awemeDetail?.mix_info) {
              mixInfo = section.awemeDetail.mix_info;
              break;
            }
          }
        } catch { /* ignore */ }
      }
    }

    if (!mixInfo?.mix_id) return null;

    // Use the proven iesdouyin API to fetch all videos
    return this.fetchMixVideos(mixInfo.mix_id);
  }
}
