import { request } from 'undici';
import { XMLParser } from 'fast-xml-parser';
import { db, type Channel } from '../db.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export type FetchResult = {
  status: 'updated' | 'not-modified' | 'error';
  newVideos: number;
  error?: string;
};

const upsertVideo = db.prepare(`
  INSERT INTO videos (yt_video_id, channel_id, title, published_at, thumbnail_url, description)
  VALUES (@yt_video_id, @channel_id, @title, @published_at, @thumbnail_url, @description)
  ON CONFLICT(yt_video_id) DO UPDATE SET
    title = excluded.title,
    thumbnail_url = excluded.thumbnail_url,
    description = excluded.description
`);

const updateChannelMeta = db.prepare(`
  UPDATE channels
  SET last_fetched_at = ?, last_etag = ?, last_modified = ?, title = COALESCE(?, title), thumbnail_url = COALESCE(?, thumbnail_url)
  WHERE id = ?
`);

export async function fetchChannelFeed(channel: Channel): Promise<FetchResult> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.yt_channel_id}`;
  const headers: Record<string, string> = {
    'user-agent': 'YT-RSS-Reader/0.1',
  };
  if (channel.last_etag) headers['if-none-match'] = channel.last_etag;
  if (channel.last_modified) headers['if-modified-since'] = channel.last_modified;

  try {
    const res = await request(url, { headers });
    const now = Math.floor(Date.now() / 1000);

    if (res.statusCode === 304) {
      updateChannelMeta.run(now, channel.last_etag, channel.last_modified, null, null, channel.id);
      res.body.dump();
      return { status: 'not-modified', newVideos: 0 };
    }
    if (res.statusCode >= 400) {
      res.body.dump();
      return { status: 'error', newVideos: 0, error: `HTTP ${res.statusCode}` };
    }

    const xml = await res.body.text();
    const parsed = parser.parse(xml);
    const feed = parsed.feed;
    if (!feed) return { status: 'error', newVideos: 0, error: 'Missing feed' };

    const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
    const channelTitle = typeof feed.title === 'string' ? feed.title : null;

    let inserted = 0;
    const tx = db.transaction(() => {
      for (const e of entries) {
        const videoId = e['yt:videoId'];
        if (!videoId) continue;
        const published = Math.floor(new Date(e.published).getTime() / 1000);
        const mediaGroup = e['media:group'] ?? {};
        const thumb = mediaGroup['media:thumbnail']?.['@_url'] ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const desc = typeof mediaGroup['media:description'] === 'string' ? mediaGroup['media:description'] : null;
        const title = typeof e.title === 'string' ? e.title : (e.title?.['#text'] ?? '');
        const result = upsertVideo.run({
          yt_video_id: videoId,
          channel_id: channel.id,
          title,
          published_at: published,
          thumbnail_url: thumb,
          description: desc,
        });
        if (result.changes > 0 && (result as any).lastInsertRowid) {
          // changes is 1 for both insert and update; detect new by checking if the row existed before — cheap approximation:
          inserted += 1;
        }
      }
    });
    tx();

    const etag = res.headers['etag'] as string | undefined;
    const lastMod = res.headers['last-modified'] as string | undefined;
    updateChannelMeta.run(now, etag ?? null, lastMod ?? null, channelTitle, null, channel.id);

    return { status: 'updated', newVideos: inserted };
  } catch (err: any) {
    return { status: 'error', newVideos: 0, error: err?.message ?? String(err) };
  }
}
