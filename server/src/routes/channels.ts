import type { FastifyInstance } from 'fastify';
import { db, type Channel } from '../db.js';
import { resolveChannel } from '../feeds/resolver.js';
import { refreshChannel } from '../feeds/scheduler.js';

export async function channelsRoutes(app: FastifyInstance) {
  app.get('/api/channels', async () => {
    return db.prepare('SELECT * FROM channels ORDER BY title COLLATE NOCASE').all();
  });

  app.post<{ Body: { input: string; category_id?: number | null; poll_interval_seconds?: number } }>(
    '/api/channels',
    async (req) => {
      const { input, category_id = null, poll_interval_seconds = 3600 } = req.body;
      if (!input?.trim()) throw new Error('input required');
      const resolved = await resolveChannel(input);
      const now = Math.floor(Date.now() / 1000);
      const existing = db.prepare('SELECT * FROM channels WHERE yt_channel_id = ?').get(resolved.channelId) as Channel | undefined;
      let id: number;
      if (existing) {
        db.prepare('UPDATE channels SET category_id = ?, poll_interval_seconds = ? WHERE id = ?').run(category_id, poll_interval_seconds, existing.id);
        id = existing.id;
      } else {
        const info = db.prepare(`
          INSERT INTO channels (yt_channel_id, title, thumbnail_url, category_id, poll_interval_seconds, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(resolved.channelId, resolved.title ?? resolved.channelId, resolved.thumbnail ?? null, category_id, poll_interval_seconds, now);
        id = Number(info.lastInsertRowid);
      }
      const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as Channel;
      refreshChannel(id).catch(() => {});
      return channel;
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<Channel> }>('/api/channels/:id', async (req) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as Channel | undefined;
    if (!current) throw new Error('Not found');
    const { category_id, poll_interval_seconds, title } = req.body;
    db.prepare('UPDATE channels SET category_id = ?, poll_interval_seconds = ?, title = ? WHERE id = ?').run(
      category_id === undefined ? current.category_id : category_id,
      poll_interval_seconds ?? current.poll_interval_seconds,
      title ?? current.title,
      id,
    );
    return db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  });

  app.delete<{ Params: { id: string } }>('/api/channels/:id', async (req) => {
    db.prepare('DELETE FROM channels WHERE id = ?').run(Number(req.params.id));
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/channels/:id/refresh', async (req) => {
    const result = await refreshChannel(Number(req.params.id));
    return result;
  });
}
