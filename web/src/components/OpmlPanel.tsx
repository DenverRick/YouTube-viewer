import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function OpmlPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);

  async function onImport(file: File) {
    setStatus('Importing…');
    try {
      const xml = await file.text();
      const res = await api.importOpml(xml);
      setStatus(`Imported ${res.channels} channels in ${res.categories} categories`);
      qc.invalidateQueries();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <a href="/api/opml/export" className="px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700">Export OPML</a>
      <button className="px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700" onClick={() => fileRef.current?.click()}>
        Import OPML
      </button>
      <input
        ref={fileRef} type="file" accept=".opml,.xml,application/xml,text/xml"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}
      />
      {status && <span className="text-xs text-neutral-400">{status}</span>}
    </div>
  );
}
