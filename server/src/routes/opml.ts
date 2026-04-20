import type { FastifyInstance } from 'fastify';
import { exportOpml, importOpml } from '../opml.js';

export async function opmlRoutes(app: FastifyInstance) {
  app.get('/api/opml/export', async (_req, reply) => {
    reply.header('content-type', 'text/x-opml; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="subscriptions.opml"');
    return exportOpml();
  });

  app.post<{ Body: { xml: string } }>('/api/opml/import', async (req) => {
    const xml = typeof req.body === 'string' ? req.body : req.body?.xml;
    if (!xml) throw new Error('Missing OPML body');
    return await importOpml(xml);
  });
}
