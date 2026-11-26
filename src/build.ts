// Entry point. `npm run build` fetches fresh numbers, draws every SVG into assets/ and writes README.md.
// `--offline` draws from the last saved data in data/state.json without touching the network.
// A source that fails falls back to its saved copy; the build only fails when a source has no copy at all
// or its copy is more than 3 days old (so a stale profile turns the nightly run red).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cards from './cards.js';
import { fetchers, type Data, type Source } from './fetch.js';
import { loadProfile } from './profile.js';
import { readme } from './readme.js';
import { THEMES } from './svg.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE = join(ROOT, 'data', 'state.json');
const ASSETS = join(ROOT, 'assets');
const STALE_DAYS = 3;

async function gather(offline: boolean, p: ReturnType<typeof loadProfile>): Promise<{ data: Data; problems: string[] }> {
  const saved: Partial<Data> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  if (offline) {
    if ((Object.keys(fetchers) as Source[]).some((src) => !saved[src])) throw new Error('No saved data yet: run `npm run build` once online.');
    return { data: saved as Data, problems: [] };
  }
  const now = new Date().toISOString();
  const data = { ...saved, fetched: { ...(saved.fetched ?? {}) } } as Data;
  const problems: string[] = [];
  for (const src of Object.keys(fetchers) as Source[]) {
    try {
      (data as Record<Source, unknown>)[src] = await fetchers[src](p);
      data.fetched[src] = now;
      console.log(`  ✓ ${src}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!saved[src]) throw new Error(`${src} failed and there is no saved copy: ${msg}`);
      const age = (Date.now() - Date.parse(saved.fetched?.[src] ?? '1970-01-01')) / 864e5;
      console.warn(`  ! ${src} failed, using copy from ${age.toFixed(1)} days ago: ${msg}`);
      if (age > STALE_DAYS) problems.push(`${src} has not been fetched for ${age.toFixed(1)} days`);
    }
  }
  data.today = data.github.days.at(-1)?.date ?? now.slice(0, 10);
  return { data, problems };
}

function draw(p: ReturnType<typeof loadProfile>, d: Data): Record<string, string> {
  const s = cards.summarize(d);
  const out: Record<string, string> = {};
  for (const t of THEMES) {
    out[`hero-${t}.svg`] = cards.hero(t, p);
    for (const l of p.links) out[`badge-${l.id}-${t}.svg`] = cards.badge(t, l);
    out[`stats-${t}.svg`] = cards.stats(t, s, d.today);
    out[`label-projects-${t}.svg`] = cards.label(t, 'Featured projects', 'live from npm · crates.io · GitHub');
    const prs = d.oss.reduce((a, o) => a + o.prs, 0);
    out[`label-oss-${t}.svg`] = cards.label(t, 'Open-source contributions', `${cards.prLabel(prs)} upstream`, 'node');
    for (const c of p.contributions) {
      const o = d.oss.find((x) => x.repo === c.repo);
      if (o) out[`oss-${c.repo.replace('/', '-')}-${t}.svg`] = cards.ossCard(t, c, o);
    }
    out[`label-contact-${t}.svg`] = cards.label(t, 'Get in touch', 'issues are open', 'ai');
    for (const f of p.featured) out[`project-${f.id}-${t}.svg`] = cards.project(t, f, cards.projectStats(f, d));
    out[`toolbox-${t}.svg`] = cards.toolbox(t, p.toolbox);
  }
  return out;
}

async function main() {
  const offline = process.argv.includes('--offline');
  const p = loadProfile(join(ROOT, 'profile.json'));
  console.log(offline ? 'Building from saved data' : 'Fetching');
  const { data, problems } = await gather(offline, p);

  // Draw everything in memory first so a drawing error never leaves half-written assets.
  const files = draw(p, data);
  const md = readme(p, data);

  mkdirSync(ASSETS, { recursive: true });
  for (const old of readdirSync(ASSETS)) if (old.endsWith('.svg') && !(old in files)) rmSync(join(ASSETS, old));
  for (const [name, svg] of Object.entries(files)) writeFileSync(join(ASSETS, name), svg);
  writeFileSync(join(ROOT, 'README.md'), md);
  if (!offline) {
    mkdirSync(dirname(STATE), { recursive: true });
    writeFileSync(STATE, JSON.stringify(data, null, 1) + '\n');
  }

  const s = cards.summarize(data);
  console.log(`Wrote ${Object.keys(files).length} SVGs and README.md`);
  console.table(cards.statsTiles(s).map(({ label, value }) => ({ label, value })));
  if (problems.length) {
    console.error(`Stale sources:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
