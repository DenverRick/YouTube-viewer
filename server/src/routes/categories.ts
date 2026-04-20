import type { FastifyInstance } from 'fastify';
import { db, type Category } from '../db.js';

export async function categoriesRoutes(app: FastifyInstance) {
  app.get('/api/categories', async () => {
    return db.prepare('SELECT * FROM categories ORDER BY parent_id, sort_order, name').all();
  });

  app.post<{ Body: { name: string; parent_id?: number | null } }>('/api/categories', async (req) => {
    const { name, parent_id = null } = req.body;
    if (!name?.trim()) throw new Error('name required');
    const info = db.prepare('INSERT INTO categories (parent_id, name) VALUES (?, ?)').run(parent_id, name.trim());
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) as Category;
  });

  app.patch<{ Params: { id: string }; Body: Partial<Category> }>('/api/categories/:id', async (req) => {
    const id = Number(req.params.id);
    const { name, parent_id, sort_order } = req.body;
    const current = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
    if (!current) throw new Error('Not found');
    db.prepare('UPDATE categories SET name = ?, parent_id = ?, sort_order = ? WHERE id = ?').run(
      name ?? current.name,
      parent_id === undefined ? current.parent_id : parent_id,
      sort_order ?? current.sort_order,
      id,
    );
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  });

  app.delete<{ Params: { id: string } }>('/api/categories/:id', async (req) => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
    return { ok: true };
  });
}
