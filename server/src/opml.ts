import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { db, type Category, type Channel } from './db.js';
import { resolveChannel } from './feeds/resolver.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
});

const RSS_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

type OutlineNode = {
  '@_text': string;
  '@_title'?: string;
  '@_type'?: string;
  '@_xmlUrl'?: string;
  outline?: OutlineNode | OutlineNode[];
};

export function exportOpml(): string {
  const cats = db.prepare('SELECT * FROM categories ORDER BY parent_id, sort_order, name').all() as Category[];
  const channels = db.prepare('SELECT * FROM channels').all() as Channel[];

  const childrenOf = new Map<number | null, Category[]>();
  for (const c of cats) {
    const arr = childrenOf.get(c.parent_id) ?? [];
    arr.push(c);
    childrenOf.set(c.parent_id, arr);
  }
  const channelsBy = new Map<number | null, Channel[]>();
  for (const ch of channels) {
    const arr = channelsBy.get(ch.category_id) ?? [];
    arr.push(ch);
    channelsBy.set(ch.category_id, arr);
  }

  function buildNode(cat: Category): OutlineNode {
    const subCats = (childrenOf.get(cat.id) ?? []).map(buildNode);
    const subChans = (channelsBy.get(cat.id) ?? []).map(channelOutline);
    const children = [...subCats, ...subChans];
    const node: OutlineNode = { '@_text': cat.name, '@_title': cat.name };
    if (children.length) node.outline = children;
    return node;
  }
  function channelOutline(ch: Channel): OutlineNode {
    return {
      '@_text': ch.title,
      '@_title': ch.title,
      '@_type': 'rss',
      '@_xmlUrl': `${RSS_BASE}${ch.yt_channel_id}`,
    };
  }

  const rootCats = (childrenOf.get(null) ?? []).map(buildNode);
  const uncategorized = (channelsBy.get(null) ?? []).map(channelOutline);
  const body = [...rootCats, ...uncategorized];

  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    opml: {
      '@_version': '2.0',
      head: { title: 'YouTube Subscriptions' },
      body: { outline: body },
    },
  };
  return builder.build(doc);
}

const insertCategory = db.prepare(
  'INSERT INTO categories (parent_id, name, sort_order) VALUES (?, ?, 0) RETURNING id'
);
const insertChannel = db.prepare(`
  INSERT INTO channels (yt_channel_id, title, thumbnail_url, category_id, poll_interval_seconds, created_at)
  VALUES (?, ?, NULL, ?, 3600, ?)
  ON CONFLICT(yt_channel_id) DO UPDATE SET
    category_id = excluded.category_id,
    title = excluded.title
`);

export async function importOpml(xml: string): Promise<{ categories: number; channels: number }> {
  const parsed = parser.parse(xml);
  const body = parsed?.opml?.body;
  if (!body) throw new Error('Invalid OPML');
  const top = body.outline;
  const items = Array.isArray(top) ? top : top ? [top] : [];

  let cats = 0;
  let chans = 0;
  const now = Math.floor(Date.now() / 1000);

  async function walk(node: OutlineNode, parentId: number | null) {
    const xmlUrl = node['@_xmlUrl'];
    if (xmlUrl) {
      const m = xmlUrl.match(/channel_id=(UC[\w-]{22})/);
      let channelId = m?.[1];
      let title = node['@_title'] || node['@_text'] || '';
      if (!channelId) {
        try {
          const r = await resolveChannel(xmlUrl);
          channelId = r.channelId;
          if (!title && r.title) title = r.title;
        } catch { return; }
      }
      insertChannel.run(channelId, title || channelId, parentId, now);
      chans++;
      return;
    }
    const name = node['@_title'] || node['@_text'];
    if (!name) return;
    const { id } = insertCategory.get(parentId, name) as { id: number };
    cats++;
    const children = node.outline;
    const childArr = Array.isArray(children) ? children : children ? [children] : [];
    for (const child of childArr) await walk(child, id);
  }

  for (const item of items) await walk(item, null);
  return { categories: cats, channels: chans };
}
