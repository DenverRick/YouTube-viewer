import { request } from 'undici';

const UC_RE = /^UC[\w-]{22}$/;

export type ResolvedChannel = {
  channelId: string;
  title?: string;
  thumbnail?: string;
};

export async function resolveChannel(input: string): Promise<ResolvedChannel> {
  const trimmed = input.trim();

  if (UC_RE.test(trimmed)) return { channelId: trimmed };

  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (channelMatch) return { channelId: channelMatch[1] };

  let url = trimmed;
  if (!url.startsWith('http')) {
    if (url.startsWith('@')) url = `https://www.youtube.com/${url}`;
    else url = `https://www.youtube.com/@${url}`;
  }

  const res = await request(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; YT-RSS-Reader/0.1)' },
    maxRedirections: 5,
  });
  if (res.statusCode >= 400) {
    throw new Error(`Failed to fetch channel page: ${res.statusCode}`);
  }
  const html = await res.body.text();

  const idMatch = html.match(/"channelId":"(UC[\w-]{22})"/) ??
    html.match(/<meta itemprop="channelId" content="(UC[\w-]{22})">/) ??
    html.match(/channel\/(UC[\w-]{22})/);
  if (!idMatch) throw new Error('Could not extract channelId from page');

  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

  return {
    channelId: idMatch[1],
    title: titleMatch?.[1],
    thumbnail: thumbMatch?.[1],
  };
}
