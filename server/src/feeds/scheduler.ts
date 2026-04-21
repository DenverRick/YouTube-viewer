import cron from 'node-cron';
import { db, type Channel } from '../db.js';
import { fetchChannelFeed, backfillAllMissingDurations } from './fetcher.js';

const CONCURRENCY = 4;
let running = false;

const dueChannels = db.prepare<[number]>(`
  SELECT * FROM channels
  WHERE last_fetched_at IS NULL OR (last_fetched_at + poll_interval_seconds) <= ?
  ORDER BY last_fetched_at IS NULL DESC, last_fetched_at ASC
`);

async function tick() {
  if (running) return;
  running = true;
  try {
    const now = Math.floor(Date.now() / 1000);
    const due = dueChannels.all(now) as Channel[];
    if (due.length === 0) return;

    const queue = [...due];
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const ch = queue.shift()!;
          const r = await fetchChannelFeed(ch);
          console.log(`[fetch] ${ch.title || ch.yt_channel_id}: ${r.status}${r.newVideos ? ` (+${r.newVideos})` : ''}${r.error ? ` err=${r.error}` : ''}`);
        }
      })());
    }
    await Promise.all(workers);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  cron.schedule('* * * * *', () => { tick().catch(console.error); });
  setTimeout(() => tick().catch(console.error), 2000);
  // Backfill missing durations (for rows imported before the Shorts filter shipped).
  setTimeout(() => backfillAllMissingDurations().catch(console.error), 5000);
}

export async function refreshChannel(channelId: number) {
  const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as Channel | undefined;
  if (!ch) throw new Error('Channel not found');
  return fetchChannelFeed(ch);
}
