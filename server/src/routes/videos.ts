import type { FastifyInstance } from 'fastify';
import { db, type Category } from '../db.js';

function descendantCategoryIds(rootId: number): number[] {
  const all = db.prepare('SELECT id, parent_id FROM categories').all() as Category[];
  const children = new Map<number | null, number[]>();
  for (const c of all) {
    const arr = children.get(c.parent_id) ?? [];
    arr.push(c.id);
    children.set(c.parent_id, arr);
  }
  const out: number[] = [rootId];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const cid of children.get(id) ?? []) {
      out.push(cid);
      stack.push(cid);
    }
  }
  return out;
}

export async function videosRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { category_id?: string; unwatched?: string; search?: string; limit?: string; offset?: string; channel_id?: string } }>(
    '/api/videos',
    async (req) => {
      const { category_id, unwatched, search, channel_id } = req.query;
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Number(req.query.offset ?? 0);

      // Hide Shorts (duration 0-59s). NULL = not yet backfilled. -1 = unknown
      // (rate-limited / deleted / consent wall) — keep both visible so we only
      // hide *definitively* known Shorts.
      const where: string[] = ['(v.duration_seconds IS NULL OR v.duration_seconds < 0 OR v.duration_seconds >= 60)'];
      const params: any[] = [];

      if (category_id) {
        const ids = descendantCategoryIds(Number(category_id));
        where.push(`c.category_id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
      if (channel_id) {
        where.push('c.id = ?');
        params.push(Number(channel_id));
      }
      if (unwatched === '1' || unwatched === 'true') {
        where.push('v.watched = 0');
      }
      if (search?.trim()) {
        where.push('v.title LIKE ?');
        params.push(`%${search.trim()}%`);
      }

      const sql = `
        SELECT v.*, c.title AS channel_title, c.yt_channel_id AS yt_channel_id, c.thumbnail_url AS channel_thumbnail
        FROM videos v JOIN channels c ON c.id = v.channel_id
        WHERE ${where.join(' AND ')}
        ORDER BY v.published_at DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
      return db.prepare(sql).all(...params);
    },
  );

  app.post<{ Params: { id: string }; Body: { watched: boolean } }>('/api/videos/:id/watched', async (req) => {
    const id = Number(req.params.id);
    db.prepare('UPDATE videos SET watched = ? WHERE id = ?').run(req.body.watched ? 1 : 0, id);
    return { ok: true };
  });
}
