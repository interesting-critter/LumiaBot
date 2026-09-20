import { createHash, randomBytes } from 'node:crypto';
import { config } from '../utils/config';

export interface NavidromeNowPlayingEntry {
  id: string;
  title: string;
  artist: string;
  album: string;
  username: string;
  minutesAgo: number;
  duration?: number;
  coverArt?: string;
}

export class NavidromeService {
  private get baseUrl(): string {
    return (config.navidrome.url || '').replace(/\/+$/, '');
  }

  isAvailable(): boolean {
    return Boolean(config.navidrome.url && config.navidrome.user && config.navidrome.password);
  }

  /**
   * Generates Subsonic auth query parameters using MD5 token + salt.
   */
  private getAuthParams(): URLSearchParams {
    const salt = randomBytes(8).toString('hex');
    const token = createHash('md5')
      .update(config.navidrome.password + salt)
      .digest('hex');

    return new URLSearchParams({
      u: config.navidrome.user,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'LumiaBot',
      f: 'json',
    });
  }

  /**
   * Fetch currently playing or recently played tracks from Navidrome
   */
  async getNowPlaying(): Promise<NavidromeNowPlayingEntry[]> {
    if (!this.isAvailable()) {
      throw new Error('Navidrome is not configured. Set NAVIDROME_URL, NAVIDROME_USER, and NAVIDROME_PASSWORD.');
    }

    const params = this.getAuthParams();
    const url = `${this.baseUrl}/rest/getNowPlaying.view?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Navidrome HTTP error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const response = json?.['subsonic-response'];

    if (!response || response.status !== 'ok') {
      const errorMsg = response?.error?.message || 'Unknown Subsonic API error';
      throw new Error(`Navidrome API error: ${errorMsg}`);
    }

    const entries = response.nowPlaying?.entry;
    if (!entries) {
      return [];
    }

    const list = Array.isArray(entries) ? entries : [entries];

    return list.map((item: any) => ({
      id: item.id,
      title: item.title || 'Unknown Title',
      artist: item.artist || 'Unknown Artist',
      album: item.album || 'Unknown Album',
      username: item.username || 'Unknown User',
      minutesAgo: item.minutesAgo ?? 0,
      duration: item.duration,
      coverArt: item.coverArt || undefined,
    }));
  }
  async getCoverArtBuffer(coverArtId: string): Promise<Buffer | null> {
    if (!this.isAvailable()) return null;

    try {
      const params = this.getAuthParams();
      const url = `${this.baseUrl}/rest/getCoverArt.view?${params.toString()}&id=${encodeURIComponent(coverArtId)}`;

      const res = await fetch(url);
      if (!res.ok) return null;

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      console.error('❌ [NAVIDROME] Failed to fetch cover art buffer:', err);
      return null;
    }
  }
}

export const navidromeService = new NavidromeService();
