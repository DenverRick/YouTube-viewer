import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH ?? 'data/app.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY,
  yt_channel_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  poll_interval_seconds INTEGER NOT NULL DEFAULT 3600,
  last_fetched_at INTEGER,
  last_etag TEXT,
  last_modified TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY,
  yt_video_id TEXT UNIQUE NOT NULL,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  thumbnail_url TEXT,
  description TEXT,
  watched INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_videos_channel_published ON videos(channel_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_at DESC);
`);

export type Category = {
  id: number;
  parent_id: number | null;
  name: string;
  sort_order: number;
};

export type Channel = {
  id: number;
  yt_channel_id: string;
  title: string;
  thumbnail_url: string | null;
  category_id: number | null;
  poll_interval_seconds: number;
  last_fetched_at: number | null;
  last_etag: string | null;
  last_modified: string | null;
  created_at: number;
};

export type Video = {
  id: number;
  yt_video_id: string;
  channel_id: number;
  title: string;
  published_at: number;
  thumbnail_url: string | null;
  description: string | null;
  watched: number;
};
