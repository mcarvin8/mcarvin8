// Reads every number the cards show from public sources: GitHub GraphQL, npm, crates.io, PyPI and Docker Hub.
import { execSync } from 'node:child_process';
import type { Profile } from './profile.js';

const UA = 'profile-readme-builder';

export type Day = { date: string; count: number };
export type NpmPkg = { name: string; version: string; month: number; year: number; weekly: number[] };
export type PypiPkg = { name: string; version: string; month: number; weekly: number[] };
/** Docker Hub only reports an all-time pull count, so there is no monthly figure or history. */
export type DockerImage = { name: string; pulls: number };
export type Crate = { name: string; version: string; downloads: number; month: number; weekly: number[] };

/** One upstream repo I contribute to. `avatar` is the owner's avatar as a data URI, since README images can't load remote files. */
export type Oss = {
  repo: string;
  /** The repo's GitHub description, or its npm package's when GitHub has none. */
  description: string;
  avatar: string;
  stars: number;
  prs: number;
  npm?: { name: string; version: string; month: number; weekly: number[] };
};

/** GitHub's description and main language for one of my repos. */
export type RepoMeta = { description: string; language: string | null };

export type Data = {
  today: string;
  github: { followers: number; publicRepos: number; stars: number; starsByRepo: Record<string, number>; repoMeta: Record<string, RepoMeta>; total: number; days: Day[] };
  npm: NpmPkg[];
  crates: Crate[];
  oss: Oss[];
  pypi: PypiPkg[];
  docker: DockerImage[];
  fetched: Record<Source, string>;
};

export type Source = 'github' | 'npm' | 'crates' | 'oss' | 'pypi' | 'docker';

// npm rate-limits bursts (a nightly run makes ~30 calls), so space calls to its hosts out a little.
const MIN_GAP_MS: Record<string, number> = { 'registry.npmjs.org': 300, 'api.npmjs.org': 1000 };
const lastCall = new Map<string, number>();

async function throttle(host: string): Promise<void> {
  const gap = MIN_GAP_MS[host];
  if (!gap) return;
  const wait = (lastCall.get(host) ?? 0) + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall.set(host, Date.now());
}

/** How long to wait before retrying: the server's Retry-After when it sends one, else 2s, 4s, 8s, 16s. */
function retryDelay(res: Response, attempt: number): number {
  const header = res.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(ms)) return Math.min(Math.max(ms, 1000), 60_000);
  }
  return Math.min(2000 * 2 ** (attempt - 1), 30_000);
}

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const host = new URL(url).host;
  for (let attempt = 1; ; attempt++) {
    await throttle(host);
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...init.headers } });
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (attempt >= 5 || !retryable) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const delay = retryDelay(res, attempt);
    console.warn(`    ${res.status} from ${host}, retrying in ${Math.round(delay / 1000)}s`);
    await sleep(delay);
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

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await getJson<{ data?: T; errors?: { message: string }[] }>('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${githubToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.data || res.errors?.length) throw new Error(`GitHub GraphQL: ${res.errors?.map((e) => e.message).join('; ')}`);
  return res.data;
}

export async function fetchGithub(p: Profile): Promise<Data['github']> {
  const query = `query($login: String!) {
    user(login: $login) {
      followers { totalCount }
      contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
      repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount nodes { name stargazerCount description primaryLanguage { name } }
      }
    }
  }`;
  type Res = {
    user: {
      followers: { totalCount: number };
      contributionsCollection: { contributionCalendar: { totalContributions: number; weeks: { contributionDays: { date: string; contributionCount: number }[] }[] } };
      repositories: { totalCount: number; nodes: { name: string; stargazerCount: number; description: string | null; primaryLanguage: { name: string } | null }[] };
    };
  };
  const u = (await gql<Res>(query, { login: p.user })).user;
  const cal = u.contributionsCollection.contributionCalendar;
  const starsByRepo = Object.fromEntries(u.repositories.nodes.map((n) => [n.name, n.stargazerCount]));
  return {
    followers: u.followers.totalCount,
    publicRepos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((a, n) => a + n.stargazerCount, 0),
    starsByRepo,
    repoMeta: Object.fromEntries(
      u.repositories.nodes.map((n) => [n.name, { description: n.description?.trim() ?? '', language: n.primaryLanguage?.name ?? null }]),
    ),
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

/** Stars, my merged PR count and npm numbers for each upstream repo in profile.contributions. */
export async function fetchOss(p: Profile): Promise<Oss[]> {
  // One GraphQL call for every repo: r0/s0, r1/s1, … are aliases for each repo and its PR search.
  const parts = p.contributions.map((c, i) => {
    const [owner, name] = c.repo.split('/');
    const q = `repo:${c.repo} author:${p.user} is:pr is:merged`;
    return (
      `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { description stargazerCount owner { avatarUrl(size: 72) } }\n` +
      `s${i}: search(query: ${JSON.stringify(q)}, type: ISSUE, first: 1) { issueCount }`
    );
  });
  type Repo = { description: string | null; stargazerCount: number; owner: { avatarUrl: string } };
  const res = await gql<Record<string, Repo & { issueCount: number }>>(`{ ${parts.join('\n')} }`);

  const out: Oss[] = [];
  for (const [i, c] of p.contributions.entries()) {
    const repo = res[`r${i}`];
    if (!repo) throw new Error(`GitHub has no repo ${c.repo}`);
    const img = await fetch(repo.owner.avatarUrl, { headers: { 'User-Agent': UA } });
    if (!img.ok) throw new Error(`${img.status} for the ${c.repo} owner avatar`);
    const type = img.headers.get('content-type') ?? 'image/png';
    const avatar = `data:${type};base64,${Buffer.from(await img.arrayBuffer()).toString('base64')}`;

    let npm: Oss['npm'];
    let npmDescription = '';
    if (c.npm) {
      const latest = await getJson<{ version: string; description?: string }>(`https://registry.npmjs.org/${c.npm}/latest`);
      type Range = { downloads: { day: string; downloads: number }[] };
      const r = await getJson<Range>(`https://api.npmjs.org/downloads/range/${daysAgo(84)}:${daysAgo(1)}/${c.npm}`);
      const byDay = new Map(r.downloads.map((d) => [d.day, d.downloads]));
      const month = r.downloads.slice(-30).reduce((a, d) => a + d.downloads, 0);
      npm = { name: c.npm, version: latest.version, month, weekly: weekly(byDay) };
      npmDescription = latest.description?.trim() ?? '';
    }
    // Some repos have no GitHub description; their npm package usually does.
    const description = repo.description?.trim() || npmDescription;
    out.push({ repo: c.repo, description, avatar, stars: repo.stargazerCount, prs: res[`s${i}`].issueCount, npm });
  }
  return out;
}

/** Every registry name of one kind listed anywhere in profile.json. */
const listed = (p: Profile, key: 'pypi' | 'docker') => [...new Set([...p.featured, ...p.more].flatMap((l) => l[key] ?? []))];

/** PyPI version from pypi.org; daily downloads, without mirror traffic, from pypistats.org. */
export async function fetchPypi(p: Profile): Promise<PypiPkg[]> {
  const out: PypiPkg[] = [];
  for (const name of listed(p, 'pypi')) {
    const info = await getJson<{ info: { version: string } }>(`https://pypi.org/pypi/${name}/json`);
    type Overall = { data: { category: string; date: string; downloads: number }[] };
    const stats = await getJson<Overall>(`https://pypistats.org/api/packages/${name}/overall?mirrors=false`);
    const byDay = new Map<string, number>();
    for (const d of stats.data) if (d.category === 'without_mirrors') byDay.set(d.date, (byDay.get(d.date) ?? 0) + d.downloads);
    const month = [...Array(30).keys()].reduce((a, i) => a + (byDay.get(daysAgo(i + 1)) ?? 0), 0);
    out.push({ name, version: info.info.version, month, weekly: weekly(byDay) });
    await sleep(500); // pypistats.org is a small free service
  }
  return out;
}

export async function fetchDocker(p: Profile): Promise<DockerImage[]> {
  const out: DockerImage[] = [];
  for (const name of listed(p, 'docker')) {
    const r = await getJson<{ pull_count: number }>(`https://hub.docker.com/v2/repositories/${name}/`);
    out.push({ name, pulls: r.pull_count });
  }
  return out;
}

export const fetchers: Record<Source, (p: Profile) => Promise<unknown>> = {
  github: fetchGithub,
  npm: fetchNpm,
  crates: fetchCrates,
  oss: fetchOss,
  pypi: fetchPypi,
  docker: fetchDocker,
};
