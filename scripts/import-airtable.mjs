#!/usr/bin/env node
// One-off importer: seeds channels + categories from the Ideas Airtable base.
// Run the server first (npm run dev or docker compose up), then: node scripts/import-airtable.mjs

const API = process.env.API ?? 'http://127.0.0.1:8787';

// Extracted from Airtable base "Ideas" → table IDEAS (videos with URLs only).
// Each entry: [categoryName, channelName (for logging), videoURL]
const ROWS = [
  ['Senior Geeks Presentation', 'PRO ROBOTS', 'https://youtu.be/D7kaRcZvhuQ'],
  ['Senior Geeks Presentation', 'Blazing Zebra', 'https://youtu.be/Dk6lGJJH_Ts'],
  ['Tools', 'Austin Davenport', 'https://youtu.be/ycIXwsDvHeA'],
  ['Tools', 'Samin Yasar', 'https://youtu.be/6lxC487hYdI'],
  ['Tools', 'Lon.TV', 'https://youtu.be/TO2NL_CcykA'],
  ['Web App Development', 'Nate Herk | AI Automation', 'https://youtu.be/_qZvORxGqI0'],
  ['Senior Geeks Presentation', 'Dr. Know-it-all Knows it all', 'https://youtu.be/cEQYA9X9TJ4'],
  ['Tools', 'Skill Leap AI', 'https://youtu.be/-dUE11ZyCwA'],
  ['Web App Development', 'Wanderloots', 'https://youtu.be/Os2CIHAS2RQ'],
  ['Tools', 'Nate Herk | AI Automation', 'https://youtu.be/HJ-dwefABss'],
  ['Tools', 'The Quantified Scientist', 'https://youtu.be/UTBcMUln4Yk'],
  ['Senior Geeks Presentation', 'CU Anschutz', 'https://youtu.be/qbPUoyzdT24'],
  ['Web App Development', 'ICOR with Tom', 'https://youtu.be/uw4NTr8V56Y'],
  ['Tools', 'Blazing Zebra', 'https://youtu.be/Rn5uLqAi3TI'],
  ['Web App Development', 'AI and Tech for Education', 'https://youtu.be/rRY-vQh1RkA'],
  ['Tools', 'Eliot Prince', 'https://youtu.be/U3OkuRYgzM8'],
  ['Senior Geeks Presentation', 'Anton Petrov', 'https://youtu.be/NK-4TViTilU'],
  ['Tools', 'Nick Saraev', 'https://youtu.be/NF10evwkefM'],
  ['Tools', 'Nate Herk | AI Automation', 'https://youtu.be/Qt3zMBH-FNg'],
  ['Senior Geeks Presentation', 'Ben AI', 'https://youtu.be/HTu1OGWAn5w'],
  ['Web App Development', 'Mark Kashef', 'https://youtu.be/9Svv-n11Ysk'],
  ['Senior Geeks Presentation', 'The Calm Analyst', 'https://youtu.be/M1z3SuHb21U'],
  ['Tools', 'DPCcars', 'https://youtu.be/bvg4zdOeFMk'],
  ['Web App Development', 'Nate Herk | AI Automation', 'https://youtu.be/86HM0RUWhCk'],
];

async function j(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${init?.method ?? 'GET'} ${url} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function ensureCategory(name, cache) {
  if (cache.has(name)) return cache.get(name);
  const existing = (await j(`${API}/api/categories`)).find((c) => c.name === name && c.parent_id === null);
  if (existing) { cache.set(name, existing.id); return existing.id; }
  const created = await j(`${API}/api/categories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, parent_id: null }),
  });
  cache.set(name, created.id);
  console.log(`+ category: ${name}`);
  return created.id;
}

async function main() {
  const catCache = new Map();
  let ok = 0;
  let fail = 0;
  const channelToCats = new Map(); // track channel → set of categories seen

  for (const [cat, ch, url] of ROWS) {
    const set = channelToCats.get(ch) ?? new Set();
    set.add(cat);
    channelToCats.set(ch, set);
  }

  for (const [cat, channelName, url] of ROWS) {
    try {
      const category_id = await ensureCategory(cat, catCache);
      const created = await j(`${API}/api/channels`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: url, category_id, poll_interval_seconds: 3600 }),
      });
      console.log(`✓ ${channelName.padEnd(32)} → ${cat} (${created.yt_channel_id})`);
      ok++;
    } catch (e) {
      console.error(`✗ ${channelName} (${url}) — ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail}`);

  const multi = [...channelToCats.entries()].filter(([, s]) => s.size > 1);
  if (multi.length) {
    console.log('\nChannels appearing under multiple Airtable categories (last one wins in DB):');
    for (const [ch, s] of multi) console.log(`  ${ch}: ${[...s].join(', ')}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
