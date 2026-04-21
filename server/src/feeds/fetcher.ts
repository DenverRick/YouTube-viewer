import { request } from 'undici';
import { XMLParser } from 'fast-xml-parser';
import { db, type Channel } from '../db.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export type FetchResult = {
  status: 'updated' | 'not-modified' | 'error';
  newVideos: number;
  error?: string;
};

const videoExists = db.prepare('SELECT 1 FROM videos WHERE yt_video_id = ?');
const upsertVideo = db.prepare(`
  INSERT INTO videos (yt_video_id, channel_id, title, published_at, thumbnail_url, description)
  VALUES (@yt_video_id, @channel_id, @title, @published_at, @thumbnail_url, @description)
  ON CONFLICT(yt_video_id) DO UPDATE SET
    title = excluded.title,
    thumbnail_url = excluded.thumbnail_url,
    description = excluded.description
`);
const setDuration = db.prepare('UPDATE videos SET duration_seconds = ? WHERE yt_video_id = ?');

const updateChannelMeta = db.prepare(`
  UPDATE channels
  SET last_fetched_at = ?, last_etag = ?, last_modified = ?, title = COALESCE(?, title), thumbnail_url = COALESCE(?, thumbnail_url)
  WHERE id = ?
`);

/**
 * Fetch a video's duration by scraping its watch page.
 * Returns seconds, or null if the request itself failed (network error / 5xx).
 * Returns 'unknown' if the page loaded but didn't expose a length (rate-limit
 * redirect to /sorry, consent wall, deleted/private video, etc.) — caller
 * should record this as a sentinel so we don't retry forever.
 */
export async function fetchVideoDuration(videoId: string): Promise<number | 'unknown' | null> {
  try {
    const res = await request(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      maxRedirections: 3,
    });
    if (res.statusCode >= 500) { res.body.dump(); return null; }
    const html = await res.body.text();
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    if (!m) return 'unknown';
    return Number(m[1]);
  } catch {
    return null;
  }
}

/**
 * Backfill with single-worker + pacing. Google rate-limits the watch-page
 * endpoint hard from a single IP — we saw 429/redirect-to-sorry after
 * ~250 concurrent-ish requests. Sequential + 600ms gap keeps us under the line.
 */
async function backfillDurations(videoIds: string[]) {
  for (const id of videoIds) {
    const d = await fetchVideoDuration(id);
    if (typeof d === 'number') setDuration.run(d, id);
    else if (d === 'unknown') setDuration.run(-1, id); // sentinel: don't retry
    // d === null (network error): leave NULL, will retry on next startup
    await new Promise((r) => setTimeout(r, 600));
  }
}

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

    const newVideoIds: string[] = [];
    const tx = db.transaction(() => {
      for (const e of entries) {
        const videoId = e['yt:videoId'];
        if (!videoId) continue;
        const isNew = !videoExists.get(videoId);
        const published = Math.floor(new Date(e.published).getTime() / 1000);
        const mediaGroup = e['media:group'] ?? {};
        const thumb = mediaGroup['media:thumbnail']?.['@_url'] ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const desc = typeof mediaGroup['media:description'] === 'string' ? mediaGroup['media:description'] : null;
        const title = typeof e.title === 'string' ? e.title : (e.title?.['#text'] ?? '');
        upsertVideo.run({
          yt_video_id: videoId,
          channel_id: channel.id,
          title,
          published_at: published,
          thumbnail_url: thumb,
          description: desc,
        });
        if (isNew) newVideoIds.push(videoId);
      }
    });
    tx();

    const etag = res.headers['etag'] as string | undefined;
    const lastMod = res.headers['last-modified'] as string | undefined;
    updateChannelMeta.run(now, etag ?? null, lastMod ?? null, channelTitle, null, channel.id);

    // Fetch durations for new videos in the background (non-blocking).
    if (newVideoIds.length) backfillDurations(newVideoIds).catch(() => {});

    return { status: 'updated', newVideos: newVideoIds.length };
  } catch (err: any) {
    return { status: 'error', newVideos: 0, error: err?.message ?? String(err) };
  }
}

/**
 * One-shot: populate duration_seconds for any existing videos that have NULL.
 * Called at server startup so Shorts filtering works for historic rows.
 */
export async function backfillAllMissingDurations() {
  const rows = db.prepare('SELECT yt_video_id FROM videos WHERE duration_seconds IS NULL').all() as { yt_video_id: string }[];
  if (!rows.length) return;
  console.log(`[backfill] fetching duration for ${rows.length} videos…`);
  await backfillDurations(rows.map((r) => r.yt_video_id));
  console.log(`[backfill] done`);
}
