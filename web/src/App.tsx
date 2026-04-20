import { useState } from 'react';
import { CategoryTree } from './components/CategoryTree';
import { VideoGrid } from './components/VideoGrid';
import { PlayerModal } from './components/PlayerModal';
import { ChannelEditor } from './components/ChannelEditor';
import { OpmlPanel } from './components/OpmlPanel';
import type { Video } from './api';

type Selection = { type: 'all' | 'unwatched' | 'category' | 'channel'; id?: number } | null;

export default function App() {
  const [selection, setSelection] = useState<Selection>({ type: 'all' });
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState<Video | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className="h-full flex">
      <aside className="w-64 shrink-0 border-r border-neutral-800 overflow-y-auto bg-neutral-925">
        <div className="p-3 border-b border-neutral-800 font-semibold">YT Subscriptions</div>
        <CategoryTree selected={selection} onSelect={setSelection} />
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 p-3 border-b border-neutral-800">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
            className="flex-1 bg-neutral-800 px-3 py-1.5 rounded text-sm"
          />
          <OpmlPanel />
          <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm" onClick={() => setShowEditor(true)}>
            Manage channels
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          <VideoGrid selection={selection} search={search} onPlay={setPlaying} />
        </div>
      </main>
      {playing && <PlayerModal video={playing} onClose={() => setPlaying(null)} />}
      {showEditor && <ChannelEditor onClose={() => setShowEditor(false)} />}
    </div>
  );
}
