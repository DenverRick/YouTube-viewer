import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Video } from '../api';

type Props = {
  selection: { type: 'all' | 'unwatched' | 'category' | 'channel'; id?: number } | null;
  search: string;
  onPlay: (video: Video) => void;
};

export function VideoGrid({ selection, search, onPlay }: Props) {
  const qc = useQueryClient();
  const params = {
    category_id: selection?.type === 'category' ? selection.id ?? null : null,
    channel_id: selection?.type === 'channel' ? selection.id : undefined,
    unwatched: selection?.type === 'unwatched',
    search,
    limit: 100,
  };
  const { data, isLoading } = useQuery({
    queryKey: ['videos', params],
    queryFn: () => api.videos(params),
  });

  async function toggleWatched(v: Video) {
    await api.setWatched(v.id, !v.watched);
    qc.invalidateQueries({ queryKey: ['videos'] });
  }

  if (isLoading) return <div className="p-6 text-neutral-400">Loading…</div>;
  if (!data?.length) return <div className="p-6 text-neutral-400">No videos yet. Add a channel to get started.</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {data.map((v) => (
        <div key={v.id} className={`group cursor-pointer ${v.watched ? 'opacity-60' : ''}`}>
          <div className="relative aspect-video bg-neutral-800 rounded overflow-hidden" onClick={() => onPlay(v)}>
            {v.thumbnail_url && <img src={v.thumbnail_url} className="w-full h-full object-cover" loading="lazy" />}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition">
              <span className="opacity-0 group-hover:opacity-100 text-4xl">▶</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="font-medium text-sm line-clamp-2" title={v.title}>{v.title}</div>
            <div className="text-xs text-neutral-400 flex items-center justify-between mt-1">
              <span className="truncate">{v.channel_title}</span>
              <button
                className="ml-2 text-neutral-500 hover:text-neutral-200"
                title={v.watched ? 'Mark unwatched' : 'Mark watched'}
                onClick={(e) => { e.stopPropagation(); toggleWatched(v); }}
              >{v.watched ? '◉' : '○'}</button>
            </div>
            <div className="text-xs text-neutral-500">{new Date(v.published_at * 1000).toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
