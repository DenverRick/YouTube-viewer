import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Category, type Channel } from '../api';

function categoryPath(cats: Category[], id: number | null): string {
  if (id === null) return 'Uncategorized';
  const byId = new Map(cats.map((c) => [c.id, c] as const));
  const parts: string[] = [];
  let cur = byId.get(id);
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parent_id == null ? undefined : byId.get(cur.parent_id);
  }
  return parts.join(' / ');
}

export function ChannelEditor({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const chans = useQuery({ queryKey: ['channels'], queryFn: api.channels });

  const [input, setInput] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createChannel(input, categoryId, intervalMinutes * 60),
    onSuccess: () => {
      setInput('');
      setError(null);
      qc.invalidateQueries({ queryKey: ['channels'] });
      qc.invalidateQueries({ queryKey: ['videos'] });
    },
    onError: (e: any) => setError(e.message ?? 'Failed'),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Channel> }) => api.updateChannel(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteChannel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] });
      qc.invalidateQueries({ queryKey: ['videos'] });
    },
  });
  const refresh = useMutation({
    mutationFn: (id: number) => api.refreshChannel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['videos'] }),
  });

  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex justify-end" onClick={onClose}>
      <div className="bg-neutral-900 w-full max-w-lg h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Manage channels</h2>
          <button onClick={onClose} className="text-neutral-400">✕</button>
        </div>

        <div className="bg-neutral-800 rounded p-3 mb-4 space-y-2">
          <div className="text-sm font-medium">Add channel</div>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Channel URL, @handle, or UC... id"
            className="w-full bg-neutral-950 px-2 py-1 rounded text-sm"
          />
          <div className="flex gap-2">
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 bg-neutral-950 px-2 py-1 rounded text-sm"
            >
              <option value="">Uncategorized</option>
              {(cats.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{categoryPath(cats.data ?? [], c.id)}</option>
              ))}
            </select>
            <input
              type="number" min={1} value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              className="w-24 bg-neutral-950 px-2 py-1 rounded text-sm"
              title="Poll interval (minutes)"
            />
            <button
              className="bg-blue-600 hover:bg-blue-500 px-3 rounded text-sm disabled:opacity-50"
              disabled={!input.trim() || create.isPending}
              onClick={() => create.mutate()}
            >Add</button>
          </div>
          {error && <div className="text-red-400 text-xs">{error}</div>}
        </div>

        <div className="space-y-2">
          {(chans.data ?? []).map((ch) => (
            <div key={ch.id} className="bg-neutral-800 rounded p-3">
              <div className="flex items-center gap-2">
                {ch.thumbnail_url && <img src={ch.thumbnail_url} className="w-8 h-8 rounded-full" />}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-sm">{ch.title}</div>
                  <div className="text-xs text-neutral-500 truncate">{ch.yt_channel_id}</div>
                </div>
                <button className="text-xs px-2 py-1 bg-neutral-700 rounded" onClick={() => refresh.mutate(ch.id)}>Refresh</button>
                <button className="text-xs px-2 py-1 bg-red-800 rounded"
                  onClick={() => { if (confirm(`Delete ${ch.title}?`)) remove.mutate(ch.id); }}>Delete</button>
              </div>
              <div className="flex gap-2 mt-2">
                <select
                  value={ch.category_id ?? ''}
                  onChange={(e) => update.mutate({ id: ch.id, body: { category_id: e.target.value ? Number(e.target.value) : null } })}
                  className="flex-1 bg-neutral-950 px-2 py-1 rounded text-sm"
                >
                  <option value="">Uncategorized</option>
                  {(cats.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{categoryPath(cats.data ?? [], c.id)}</option>
                  ))}
                </select>
                <input
                  type="number" min={1}
                  defaultValue={Math.round(ch.poll_interval_seconds / 60)}
                  onBlur={(e) => {
                    const mins = Number(e.target.value);
                    if (mins > 0 && mins * 60 !== ch.poll_interval_seconds) {
                      update.mutate({ id: ch.id, body: { poll_interval_seconds: mins * 60 } });
                    }
                  }}
                  className="w-24 bg-neutral-950 px-2 py-1 rounded text-sm"
                  title="Poll interval (minutes)"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
