export type Category = { id: number; parent_id: number | null; name: string; sort_order: number };
export type Channel = {
  id: number;
  yt_channel_id: string;
  title: string;
  thumbnail_url: string | null;
  category_id: number | null;
  poll_interval_seconds: number;
  last_fetched_at: number | null;
};
export type Video = {
  id: number;
  yt_video_id: string;
  channel_id: number;
  channel_title: string;
  yt_channel_id: string;
  channel_thumbnail: string | null;
  title: string;
  published_at: number;
  thumbnail_url: string | null;
  description: string | null;
  watched: number;
};

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  categories: () => fetch('/api/categories').then(j<Category[]>),
  createCategory: (name: string, parent_id: number | null = null) =>
    fetch('/api/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, parent_id }) }).then(j<Category>),
  deleteCategory: (id: number) => fetch(`/api/categories/${id}`, { method: 'DELETE' }).then(j),
  updateCategory: (id: number, body: Partial<Category>) =>
    fetch(`/api/categories/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j<Category>),

  channels: () => fetch('/api/channels').then(j<Channel[]>),
  createChannel: (input: string, category_id: number | null, poll_interval_seconds: number) =>
    fetch('/api/channels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input, category_id, poll_interval_seconds }) }).then(j<Channel>),
  updateChannel: (id: number, body: Partial<Channel>) =>
    fetch(`/api/channels/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j<Channel>),
  deleteChannel: (id: number) => fetch(`/api/channels/${id}`, { method: 'DELETE' }).then(j),
  refreshChannel: (id: number) => fetch(`/api/channels/${id}/refresh`, { method: 'POST' }).then(j),

  videos: (params: { category_id?: number | null; channel_id?: number; unwatched?: boolean; search?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params.category_id) q.set('category_id', String(params.category_id));
    if (params.channel_id) q.set('channel_id', String(params.channel_id));
    if (params.unwatched) q.set('unwatched', '1');
    if (params.search) q.set('search', params.search);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    return fetch(`/api/videos?${q}`).then(j<Video[]>);
  },
  setWatched: (id: number, watched: boolean) =>
    fetch(`/api/videos/${id}/watched`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ watched }) }).then(j),

  importOpml: (xml: string) =>
    fetch('/api/opml/import', { method: 'POST', headers: { 'content-type': 'application/xml' }, body: xml }).then(j<{ categories: number; channels: number }>),
};
