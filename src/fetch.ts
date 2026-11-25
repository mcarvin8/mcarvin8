// Reads every number the cards show from public sources: GitHub GraphQL, the npm registry and crates.io.
import { execSync } from 'node:child_process';
import type { Profile } from './profile.js';

const UA = 'profile-readme-builder';

export type Day = { date: string; count: number };
export type NpmPkg = { name: string; version: string; month: number; year: number; weekly: number[] };
export type Crate = { name: string; version: string; downloads: number; month: number; weekly: number[] };

export type Data = {
  today: string;
  github: { followers: number; publicRepos: number; stars: number; starsByRepo: Record<string, number>; total: number; days: Day[] };
  npm: NpmPkg[];
  crates: Crate[];
  fetched: { github: string; npm: string; crates: string };
};

export type Source = 'github' | 'npm' | 'crates';

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...init.headers } });
    if (res.ok) return (await res.json()) as T;
    if (attempt >= 3 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    await sleep(1500 * attempt);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 864e5));

/** Sums the last 84 days into 12 weekly totals, oldest first. */
function weekly(byDay: Map<string, number>): number[] {
  const out: number[] = [];
  for (let w = 11; w >= 0; w--) {
    let sum = 0;
    for (let d = 0; d < 7; d++) sum += byDay.get(daysAgo(w * 7 + d + 1)) ?? 0;
    out.push(sum);
  }
  return out;
}

function githubToken(): string {
  const env = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (env) return env;
  try {
    return execSync('gh auth token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new Error('GitHub needs a token: set GITHUB_TOKEN, or log in with `gh auth login`.');
  }
}

export async function fetchGithub(p: Profile): Promise<Data['github']> {
  const query = `query($login: String!) {
    user(login: $login) {
      followers { totalCount }
      contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
      repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount nodes { name stargazerCount }
      }
    }
  }`;
  type Res = {
    data?: { user: {
      followers: { totalCount: number };
      contributionsCollection: { contributionCalendar: { totalContributions: number; weeks: { contributionDays: { date: string; contributionCount: number }[] }[] } };
      repositories: { totalCount: number; nodes: { name: string; stargazerCount: number }[] };
    } };
    errors?: { message: string }[];
  };
  const res = await getJson<Res>('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${githubToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: p.user } }),
  });
  if (!res.data) throw new Error(`GitHub GraphQL: ${res.errors?.map((e) => e.message).join('; ')}`);
  const u = res.data.user;
  const cal = u.contributionsCollection.contributionCalendar;
  const starsByRepo = Object.fromEntries(u.repositories.nodes.map((n) => [n.name, n.stargazerCount]));
  return {
    followers: u.followers.totalCount,
    publicRepos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((a, n) => a + n.stargazerCount, 0),
    starsByRepo,
    total: cal.totalContributions,
    days: cal.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))),
  };
}

export async function fetchNpm(p: Profile): Promise<NpmPkg[]> {
  type Search = { objects: { package: { name: string; version: string } }[] };
  const search = await getJson<Search>(
    `https://registry.npmjs.org/-/v1/search?text=maintainer:${encodeURIComponent(p.npm.maintainer)}&size=250`,
  );
  const exclude = p.npm.exclude.map((s) => new RegExp(s));
  const wanted = new Set(p.featured.flatMap((f) => f.npm ?? []));
  const pkgs = search.objects.map((o) => o.package).filter((pk) => wanted.has(pk.name) || !exclude.some((re) => re.test(pk.name)));
  const range = `${daysAgo(365)}:${daysAgo(1)}`;
  const out: NpmPkg[] = [];
  for (const pk of pkgs) {
    type Range = { downloads: { day: string; downloads: number }[] };
    const r = await getJson<Range>(`https://api.npmjs.org/downloads/range/${range}/${pk.name}`);
    const byDay = new Map(r.downloads.map((d) => [d.day, d.downloads]));
    const last = (n: number) => r.downloads.slice(-n).reduce((a, d) => a + d.downloads, 0);
    out.push({ name: pk.name, version: pk.version, month: last(30), year: last(365), weekly: weekly(byDay) });
  }
  return out.sort((a, b) => b.year - a.year);
}

export async function fetchCrates(p: Profile): Promise<Crate[]> {
  type List = { crates: { name: string; max_stable_version: string | null; max_version: string; downloads: number; recent_downloads: number }[] };
  type Dl = { version_downloads: { date: string; downloads: number }[]; meta: { extra_downloads: { date: string; downloads: number }[] } };
  const list = await getJson<List>(`https://crates.io/api/v1/crates?user_id=${p.crates.userId}&per_page=100`);
  const out: Crate[] = [];
  for (const c of list.crates) {
    await sleep(1000); // crates.io asks crawlers for at most one request a second
    const dl = await getJson<Dl>(`https://crates.io/api/v1/crates/${c.name}/downloads`);
    const byDay = new Map<string, number>();
    for (const d of [...dl.version_downloads, ...dl.meta.extra_downloads]) byDay.set(d.date, (byDay.get(d.date) ?? 0) + d.downloads);
    out.push({
      name: c.name,
      version: c.max_stable_version ?? c.max_version,
      downloads: c.downloads,
      month: [...Array(30).keys()].reduce((a, i) => a + (byDay.get(daysAgo(i + 1)) ?? 0), 0),
      weekly: weekly(byDay),
    });
  }
  return out.sort((a, b) => b.downloads - a.downloads);
}

export const fetchers: Record<Source, (p: Profile) => Promise<unknown>> = { github: fetchGithub, npm: fetchNpm, crates: fetchCrates };
