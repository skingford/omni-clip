import type { PlatformAdapter, VideoInfo } from '../types';
import { normalizeUrl } from '../utils/url';

export class VideoResolver {
  private adapters: PlatformAdapter[] = [];

  register(adapter: PlatformAdapter): void {
    this.adapters.push(adapter);
  }

  private findAdapter(url: string): PlatformAdapter {
    const adapter = this.adapters.find((a) => a.canHandle(url));
    if (!adapter) {
      throw new Error(
        `Unsupported URL: no adapter found for "${url}". Supported platforms: ${this.adapters.map((a) => a.name).join(', ')}`
      );
    }
    return adapter;
  }

  async resolve(input: string): Promise<VideoInfo> {
    const url = normalizeUrl(input);
    const adapter = this.findAdapter(url);
    const canonicalUrl = await adapter.resolve(url);
    return adapter.getVideoInfo(canonicalUrl);
  }
}
