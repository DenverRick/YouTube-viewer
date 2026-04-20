import { useEffect } from 'react';
import type { Video } from '../api';

export function PlayerModal({ video, onClose }: { video: Video; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${video.yt_video_id}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="font-medium">{video.title}</div>
            <div className="text-sm text-neutral-400">{video.channel_title}</div>
          </div>
          <button className="px-3 py-1 bg-neutral-800 rounded" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
