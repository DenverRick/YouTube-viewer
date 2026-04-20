import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Category, type Channel } from '../api';

type Props = {
  selected: { type: 'all' | 'unwatched' | 'category' | 'channel'; id?: number } | null;
  onSelect: (sel: Props['selected']) => void;
};

export function CategoryTree({ selected, onSelect }: Props) {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const chans = useQuery({ queryKey: ['channels'], queryFn: api.channels });
  const [addingUnder, setAddingUnder] = useState<number | null | 'root'>(null);
  const [newName, setNewName] = useState('');

  const createCat = useMutation({
    mutationFn: ({ name, parent_id }: { name: string; parent_id: number | null }) => api.createCategory(name, parent_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
  const deleteCat = useMutation({
    mutationFn: (id: number) => api.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const { tree, channelsBy } = useMemo(() => {
    const all = cats.data ?? [];
    const byParent = new Map<number | null, Category[]>();
    for (const c of all) {
      const arr = byParent.get(c.parent_id) ?? [];
      arr.push(c);
      byParent.set(c.parent_id, arr);
    }
    const cb = new Map<number | null, Channel[]>();
    for (const ch of chans.data ?? []) {
      const arr = cb.get(ch.category_id) ?? [];
      arr.push(ch);
      cb.set(ch.category_id, arr);
    }
    return { tree: byParent, channelsBy: cb };
  }, [cats.data, chans.data]);

  function submitAdd(parent: number | null) {
    if (!newName.trim()) return;
    createCat.mutate({ name: newName.trim(), parent_id: parent });
    setNewName('');
    setAddingUnder(null);
  }

  function renderCategory(cat: Category, depth: number) {
    const childCats = tree.get(cat.id) ?? [];
    const childChans = channelsBy.get(cat.id) ?? [];
    const isSel = selected?.type === 'category' && selected.id === cat.id;
    return (
      <li key={cat.id}>
        <div
          className={`flex items-center group px-2 py-1 rounded cursor-pointer text-sm ${isSel ? 'bg-neutral-700' : 'hover:bg-neutral-800'}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => onSelect({ type: 'category', id: cat.id })}
        >
          <span className="flex-1 truncate">📁 {cat.name}</span>
          <button
            className="opacity-0 group-hover:opacity-100 text-xs px-1"
            title="Add sub-category"
            onClick={(e) => { e.stopPropagation(); setAddingUnder(cat.id); }}
          >+</button>
          <button
            className="opacity-0 group-hover:opacity-100 text-xs px-1"
            title="Delete category"
            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete category "${cat.name}"?`)) deleteCat.mutate(cat.id); }}
          >🗑</button>
        </div>
        {addingUnder === cat.id && (
          <div className="flex gap-1 mt-1" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
            <input
              autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(cat.id); if (e.key === 'Escape') setAddingUnder(null); }}
              className="flex-1 bg-neutral-800 text-sm px-2 py-0.5 rounded"
              placeholder="Sub-category name"
            />
            <button className="text-xs px-2" onClick={() => submitAdd(cat.id)}>OK</button>
          </div>
        )}
        <ul>
          {childCats.map((c) => renderCategory(c, depth + 1))}
          {childChans.map((ch) => renderChannel(ch, depth + 1))}
        </ul>
      </li>
    );
  }

  function renderChannel(ch: Channel, depth: number) {
    const isSel = selected?.type === 'channel' && selected.id === ch.id;
    return (
      <li key={`ch-${ch.id}`}>
        <div
          className={`flex items-center px-2 py-1 rounded cursor-pointer text-sm ${isSel ? 'bg-neutral-700' : 'hover:bg-neutral-800'}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => onSelect({ type: 'channel', id: ch.id })}
        >
          {ch.thumbnail_url ? (
            <img src={ch.thumbnail_url} className="w-4 h-4 rounded-full mr-2" />
          ) : <span className="mr-2">📺</span>}
          <span className="flex-1 truncate">{ch.title}</span>
        </div>
      </li>
    );
  }

  const rootCats = tree.get(null) ?? [];
  const uncat = channelsBy.get(null) ?? [];

  return (
    <div className="flex flex-col gap-1 p-2 text-sm">
      <button
        className={`text-left px-2 py-1 rounded ${selected?.type === 'all' ? 'bg-neutral-700' : 'hover:bg-neutral-800'}`}
        onClick={() => onSelect({ type: 'all' })}
      >🏠 All videos</button>
      <button
        className={`text-left px-2 py-1 rounded ${selected?.type === 'unwatched' ? 'bg-neutral-700' : 'hover:bg-neutral-800'}`}
        onClick={() => onSelect({ type: 'unwatched' })}
      >✨ Unwatched</button>
      <div className="mt-2 flex items-center justify-between px-2">
        <span className="text-xs uppercase text-neutral-400">Categories</span>
        <button className="text-xs" onClick={() => setAddingUnder('root')}>+ New</button>
      </div>
      {addingUnder === 'root' && (
        <div className="flex gap-1 px-2">
          <input
            autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(null); if (e.key === 'Escape') setAddingUnder(null); }}
            className="flex-1 bg-neutral-800 text-sm px-2 py-0.5 rounded"
            placeholder="Category name"
          />
          <button className="text-xs px-2" onClick={() => submitAdd(null)}>OK</button>
        </div>
      )}
      <ul>
        {rootCats.map((c) => renderCategory(c, 0))}
        {uncat.length > 0 && (
          <li>
            <div className="px-2 py-1 text-xs uppercase text-neutral-500 mt-2">Uncategorized</div>
            <ul>{uncat.map((ch) => renderChannel(ch, 0))}</ul>
          </li>
        )}
      </ul>
    </div>
  );
}
