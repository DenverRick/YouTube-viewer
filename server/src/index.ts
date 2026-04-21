import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { categoriesRoutes } from './routes/categories.js';
import { channelsRoutes } from './routes/channels.js';
import { videosRoutes } from './routes/videos.js';
import { opmlRoutes } from './routes/opml.js';
import { startScheduler } from './feeds/scheduler.js';

const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

app.addContentTypeParser(['text/xml', 'application/xml', 'text/x-opml'], { parseAs: 'string' }, (_req, body, done) => {
  done(null, { xml: body });
});

const APP_USER = process.env.APP_USER;
const APP_PASS = process.env.APP_PASS;
if (APP_USER && APP_PASS) {
  const expected = 'Basic ' + Buffer.from(`${APP_USER}:${APP_PASS}`).toString('base64');
  app.addHook('onRequest', async (req, reply) => {
    const header = req.headers.authorization ?? '';
    if (header !== expected) {
      reply.header('WWW-Authenticate', 'Basic realm="yt-subscriptions"');
      reply.code(401).send('Authentication required');
    }
  });
  app.log.info('HTTP Basic Auth enabled');
} else {
  app.log.warn('APP_USER/APP_PASS not set — running without auth');
}

await app.register(categoriesRoutes);
await app.register(channelsRoutes);
await app.register(videosRoutes);
await app.register(opmlRoutes);

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDist = resolve(__dirname, '../../web/dist');
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api')) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    reply.sendFile('index.html');
  });
} else {
  app.log.info('web/dist not found — running API-only (dev mode uses Vite proxy)');
}

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  startScheduler();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
