// Every card the README shows. Each function returns one finished SVG document for one theme.
import type { Data, Day, Oss } from './fetch.js';
import type { Contribution, Featured, Listing, Profile, Tag } from './profile.js';
import { chip, chipRow, commas, compact, doc, esc, r, sparkline, text, textWidth, theme, wrap, type ThemeName } from './svg.js';

const W = 840;

const frame = (t: ReturnType<typeof theme>, w: number, h: number) =>
  `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="${t.card}" stroke="${t.border}"/>`;

// ---------- numbers ----------

export type Summary = {
  npmYear: number;
  npmMonth: number;
  cratesAll: number;
  packages: number;
  contributions: number;
  streak: number;
  bestStreak: number;
  stars: number;
  publicRepos: number;
};

export function streaks(days: Day[]): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  // Today still counts as part of the streak while it has no contributions yet.
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  let current = 0;
  for (; i >= 0 && days[i].count > 0; i--) current++;
  return { current, best };
}

export function summarize(d: Data): Summary {
  const s = streaks(d.github.days);
  return {
    npmYear: d.npm.reduce((a, p) => a + p.year, 0),
    npmMonth: d.npm.reduce((a, p) => a + p.month, 0),
    cratesAll: d.crates.reduce((a, c) => a + c.downloads, 0),
    packages: d.npm.length + d.crates.length + d.pypi.length + d.docker.length,
    contributions: d.github.total,
    streak: s.current,
    bestStreak: s.best,
    stars: d.github.stars,
    publicRepos: d.github.publicRepos,
  };
}

/** `month` and `weekly` sum npm, crates.io and PyPI downloads; `pulls` is the all-time Docker Hub count. */
export type ProjectStats = { version?: string; month: number; pulls: number; stars: number; weekly: number[]; registry: string };

export function projectStats(f: Listing, d: Data): ProjectStats {
  const npm = d.npm.filter((p) => f.npm?.includes(p.name));
  const crates = d.crates.filter((c) => f.crates?.includes(c.name));
  const pypi = (d.pypi ?? []).filter((p) => f.pypi?.includes(p.name));
  const docker = (d.docker ?? []).filter((x) => f.docker?.includes(x.name));
  const pkgs = [...npm, ...crates, ...pypi];
  const weekly = Array.from({ length: 12 }, (_, i) => pkgs.reduce((a, x) => a + (x.weekly[i] ?? 0), 0));
  return {
    version: crates[0]?.version ?? npm[0]?.version ?? pypi[0]?.version,
    month: pkgs.reduce((a, p) => a + p.month, 0),
    pulls: docker.reduce((a, x) => a + x.pulls, 0),
    stars: d.github.starsByRepo[f.repo] ?? 0,
    weekly,
    registry: [crates.length ? 'crates.io' : '', npm.length ? 'npm' : ''].filter(Boolean).join(' + '),
  };
}

// ---------- hero ----------

export function hero(name: ThemeName, p: Profile): string {
  const t = theme(name);
  const H = 250;
  const h = p.hero;
  const left = 40;
  const colW = 420;

  const titleSize = Math.min(34, colW / ([...h.title].length * 0.6));
  const tag = wrap(h.tagline, colW, 16, 3);

  const tx = 488;
  const ty = 36;
  const tw = 316;
  const longest = Math.max(...h.terminal.map(([, l]) => [...l].length + 2));
  const ts = Math.min(13, (tw - 36) / (longest * 0.61));
  const th = 52 + h.terminal.length * 26 + 8;

  let term =
    `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="10" fill="${t.term.bg}" stroke="${t.term.border}"/>` +
    ['#ff5f57', '#febc2e', '#28c840'].map((c, i) => `<circle cx="${tx + 20 + i * 16}" cy="${ty + 18}" r="5" fill="${c}"/>`).join('') +
    text(tx + tw / 2, ty + 22, 'zsh', { size: 11, fill: t.term.muted, mono: true, anchor: 'middle' });
  h.terminal.forEach(([kind, line], i) => {
    const y = ty + 56 + i * 26;
    if (kind === 'cmd') {
      term += `<text x="${tx + 18}" y="${y}" class="m" font-size="${r(ts)}"><tspan fill="${t.term.prompt}">$ </tspan><tspan fill="${t.term.fg}">${esc(line)}</tspan></text>`;
    } else {
      term += text(tx + 18, y, line, { size: ts, fill: kind === 'ok' ? t.term.ok : t.term.muted, mono: true });
    }
    if (i === h.terminal.length - 1) {
      const cx = tx + 18 + ([...line].length + (kind === 'cmd' ? 3 : 1)) * ts * 0.6;
      term += `<rect x="${r(cx)}" y="${r(y - ts * 0.85)}" width="${r(ts * 0.55)}" height="${r(ts * 1.05)}" fill="${t.term.fg}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1.1s" repeatCount="indefinite"/></rect>`;
    }
  });

  let chips = '';
  let cx = left;
  for (const [label, tone] of h.chips) {
    const c = chip(t, cx, 204, label, tone, 12);
    chips += c.svg;
    cx += c.w + 8;
  }

  const body =
    `<defs><clipPath id="c"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14"/></clipPath>` +
    `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>` +
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${t.accent}" stop-opacity="${name === 'dark' ? 0.22 : 0.14}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient></defs>` +
    frame(t, W, H) +
    `<g clip-path="url(#c)"><rect x="0" y="0" width="${W}" height="5" fill="url(#g)"/>` +
    `<ellipse cx="${tx + tw / 2}" cy="${ty + th / 2}" rx="260" ry="170" fill="url(#glow)"/></g>` +
    text(left, 60, h.kicker, { size: 13, fill: t.accent, mono: true, weight: 500 }) +
    text(left, 104, h.title, { size: Math.round(titleSize * 10) / 10, fill: t.fg, weight: 700 }) +
    tag.map((l, i) => text(left, 138 + i * 22, l, { size: 16, fill: t.muted })).join('') +
    chips +
    term;
  return doc(W, H, `${h.title} ${h.tagline}`, body);
}

// ---------- link badges ----------

const BADGE_ICON: Record<string, string> = { gh: 'gh', npm: 'npm', crates: 'rs', pypi: 'py', docker: 'dh', hi: 'hi' };

export function badge(name: ThemeName, l: Profile['links'][number]): string {
  const t = theme(name);
  const H = 44;
  const tone = t.tones[l.tone] ?? t.fg;
  // Badges sit side by side, so measure tighter than the safe default to keep the gaps even.
  const lw = textWidth(l.label, 14, { bold: true }) * 0.9;
  const hw = textWidth(l.handle, 12, { mono: true }) * 0.92;
  const w = Math.ceil(48 + lw + 10 + hw + 18);
  const icon = BADGE_ICON[l.id] ?? l.label.slice(0, 2).toLowerCase();
  const body =
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${H - 1}" rx="${H / 2}" fill="${t.card}" stroke="${t.border}"/>` +
    `<circle cx="22" cy="22" r="15" fill="${tone}" fill-opacity="${t.chipAlpha + 0.06}"/>` +
    text(22, 26, icon, { size: icon.length > 2 ? 9.5 : 11.5, fill: tone, mono: true, weight: 700, anchor: 'middle' }) +
    text(48, 27, l.label, { size: 14, fill: t.fg, weight: 600 }) +
    text(48 + lw + 10, 27, l.handle, { size: 12, fill: t.muted, mono: true });
  return doc(w, H, `${l.label} ${l.handle}`, body);
}

// ---------- by the numbers ----------

export function statsTiles(s: Summary): { value: string; label: string }[] {
  return [
    { value: compact(s.npmYear), label: 'npm downloads · last 12 months' },
    { value: compact(s.cratesAll), label: 'crates.io downloads · all time' },
    { value: String(s.packages), label: 'packages · npm, crates, PyPI, Docker' },
    { value: commas(s.contributions), label: 'contributions · last 12 months' },
    { value: `${s.streak} ${s.streak === 1 ? 'day' : 'days'}`, label: `current streak · best ${s.bestStreak}` },
    { value: String(s.stars), label: `stars across ${s.publicRepos} public repos` },
  ];
}

export function stats(name: ThemeName, s: Summary, today: string): string {
  const t = theme(name);
  const H = 244;
  const pad = 24;
  const gap = 12;
  const tw = (W - pad * 2 - gap * 2) / 3;
  const th = 76;
  const tiles = statsTiles(s);
  const tones = [t.tones.npm, t.tones.rust, t.accent, t.accent, t.tones.node, '#e3b341'];
  let body = frame(t, W, H) + text(pad, 40, 'By the numbers', { size: 18, fill: t.fg, weight: 700 });
  body += text(W - pad, 40, `updated ${fmtDate(today)}`, { size: 12, fill: t.muted, mono: true, anchor: 'end' });
  tiles.forEach((tile, i) => {
    const x = pad + (i % 3) * (tw + gap);
    const y = 60 + Math.floor(i / 3) * (th + gap);
    body +=
      `<rect x="${r(x)}" y="${y}" width="${r(tw)}" height="${th}" rx="10" fill="${t.panel}" stroke="${t.border}" stroke-opacity="0.6"/>` +
      `<rect x="${r(x)}" y="${y + 18}" width="3" height="${th - 36}" rx="1.5" fill="${tones[i]}"/>` +
      text(x + 20, y + 38, tile.value, { size: 26, fill: t.fg, weight: 700 }) +
      text(x + 20, y + 60, tile.label, { size: 12.5, fill: t.muted });
  });
  const alt = tiles.map((x) => `${x.value} ${x.label}`).join(', ');
  return doc(W, H, `By the numbers: ${alt}`, body);
}

export function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// ---------- section label ----------

export function label(name: ThemeName, title: string, sub: string, tone = 'sf'): string {
  const t = theme(name);
  const H = 52;
  const body =
    `<rect x="0" y="13" width="4" height="26" rx="2" fill="${t.tones[tone] ?? t.accent}"/>` +
    text(16, 34, title, { size: 20, fill: t.fg, weight: 700 }) +
    text(W, 34, sub, { size: 12, fill: t.muted, mono: true, anchor: 'end' });
  return doc(W, H, title, body);
}

// ---------- project card ----------

export const PW = 414;

export function project(name: ThemeName, f: Featured, ps: ProjectStats): string {
  const t = theme(name);
  const H = 214;
  const pad = 22;
  let body = frame(t, PW, H);

  let regW = 0;
  if (ps.registry) {
    regW = textWidth(ps.registry, 11, { mono: true }) + 20;
    body += chip(t, PW - pad - regW, 20, ps.registry, ps.registry.startsWith('crates') ? 'rust' : 'npm', 11).svg;
  }
  const nameAvail = PW - pad * 2 - regW - 10;
  const nameSize = Math.min(19, nameAvail / ([...f.id].length * 0.6));
  body += text(pad, 39, f.id, { size: Math.round(nameSize * 10) / 10, fill: t.fg, weight: 700 });

  wrap(f.line, PW - pad * 2, 13.5, 3).forEach((l, i) => {
    body += text(pad, 68 + i * 20, l, { size: 13.5, fill: t.muted });
  });

  body += chipRow(t, pad, 132, PW - pad, f.chips, 11).svg;
  body += `<line x1="${pad}" x2="${PW - pad}" y1="168.5" y2="168.5" stroke="${t.border}" stroke-opacity="0.7"/>`;

  const facts = shortFacts(ps, PW - pad * 2 - 116, 12.5);
  body += text(pad, 196, facts, { size: 12.5, fill: t.muted, mono: true });
  if (ps.weekly.some((v) => v > 0)) {
    body += sparkline(ps.weekly, PW - pad - 104, 178, 104, 24, t.accent);
  }
  const alt = `${f.id}: ${f.line} ${longFacts(ps).join(', ')}.`;
  return doc(PW, H, alt, body);
}

// ---------- upstream contribution card ----------

export const prLabel = (n: number) => `${n} ${n === 1 ? 'PR' : 'PRs'} merged`;

export function ossCard(name: ThemeName, c: Contribution, o: Oss): string {
  const t = theme(name);
  const H = 192;
  const pad = 22;
  const [owner, repo] = c.repo.split('/');
  let body =
    `<defs><clipPath id="av"><circle cx="${pad + 17}" cy="36" r="17"/></clipPath></defs>` +
    frame(t, PW, H) +
    `<image href="${o.avatar}" x="${pad}" y="19" width="34" height="34" clip-path="url(#av)"/>` +
    `<circle cx="${pad + 17}" cy="36" r="17" fill="none" stroke="${t.border}"/>`;

  const pr = prLabel(o.prs);
  const prW = textWidth(pr, 11, { mono: true }) + 20;
  body += chip(t, PW - pad - prW, 22, pr, 'node', 11).svg;

  const nx = pad + 46;
  const nameSize = Math.min(17, (PW - nx - pad - prW - 10) / ([...repo].length * 0.6));
  body +=
    text(nx, 31, `${owner} /`, { size: 12, fill: t.muted, mono: true }) +
    text(nx, 50, repo, { size: Math.round(nameSize * 10) / 10, fill: t.fg, weight: 700 });

  wrap(o.description, PW - pad * 2, 13.5, 3).forEach((l, i) => {
    body += text(pad, 84 + i * 20, l, { size: 13.5, fill: t.muted });
  });

  body += `<line x1="${pad}" x2="${PW - pad}" y1="146.5" y2="146.5" stroke="${t.border}" stroke-opacity="0.7"/>`;
  const facts = [o.stars && `★ ${compact(o.stars)}`, o.npm && `v${o.npm.version}`, o.npm && `${compact(o.npm.month)}/mo`].filter(Boolean).join('  ·  ');
  body += text(pad, 174, facts, { size: 12.5, fill: t.muted, mono: true });
  if (o.npm?.weekly.some((v) => v > 0)) body += sparkline(o.npm.weekly, PW - pad - 104, 156, 104, 24, t.tones.node);

  return doc(PW, H, ossAlt(c, o), body);
}

export function ossAlt(c: Contribution, o: Oss): string {
  const facts = [prLabel(o.prs) + ' by me', o.stars && `${commas(o.stars)} stars`, o.npm && `v${o.npm.version}`, o.npm && `${commas(o.npm.month)} npm downloads in the last 30 days`];
  return `${c.repo}: ${o.description} ${facts.filter(Boolean).join(', ')}.`;
}

// ---------- "more projects" tile ----------

export const TW = 272;

const LANG_TONE: Record<string, string> = { TypeScript: 'ts', JavaScript: 'node', Rust: 'rust', Python: 'py', Shell: 'bash' };

export type TileInfo = { name: string; description: string; language: string | null; ps: ProjectStats };

export function tileInfo(m: Profile['more'][number], d: Data): TileInfo {
  const meta = d.github.repoMeta[m.repo];
  return { name: m.repo, description: meta?.description ?? '', language: meta?.language ?? null, ps: projectStats(m, d) };
}

export function tile(name: ThemeName, info: TileInfo): string {
  const t = theme(name);
  const H = 150;
  const pad = 18;
  const { ps } = info;
  let body = frame(t, TW, H);

  // The name gets the full width; the language sits under it as a GitHub-style dot.
  const nameSize = Math.min(15, (TW - pad * 2) / ([...info.name].length * 0.6));
  body += text(pad, 32, info.name, { size: Math.round(nameSize * 10) / 10, fill: t.fg, weight: 700 });
  if (info.language) {
    const tone = t.tones[LANG_TONE[info.language] ?? 'muted'] ?? t.muted;
    body += `<circle cx="${pad + 4}" cy="47" r="4" fill="${tone}"/>` + text(pad + 13, 51, info.language, { size: 11, fill: t.muted, mono: true });
  }

  wrap(info.description, TW - pad * 2, 12.5, 3).forEach((l, i) => {
    body += text(pad, 74 + i * 18, l, { size: 12.5, fill: t.muted });
  });

  body += `<line x1="${pad}" x2="${TW - pad}" y1="120.5" y2="120.5" stroke="${t.border}" stroke-opacity="0.7"/>`;
  // Tiles are narrow: when the facts need the room, the facts win over the sparkline.
  const room = TW - pad * 2 - 64;
  const facts = shortFacts(ps, room, 11.5, ' · ');
  body += text(pad, 139, facts, { size: 11.5, fill: t.muted, mono: true });
  if (ps.weekly.some((v) => v > 0) && textWidth(facts, 11.5, { mono: true }) <= room) {
    body += sparkline(ps.weekly, TW - pad - 56, 125, 56, 16, t.accent);
  }
  return doc(TW, H, tileAlt(info), body);
}

/** The facts line under a card, e.g. "v4.1.0  ·  429/mo  ·  4.3k pulls  ·  ★ 2". Stars go first when it doesn't fit. */
export function shortFacts(ps: ProjectStats, maxWidth: number, size: number, sep = '  ·  '): string {
  const base = [ps.version && `v${ps.version}`, ps.month && `${compact(ps.month)}/mo`, ps.pulls && `${compact(ps.pulls)} pulls`].filter(Boolean) as string[];
  const withStars = ps.stars ? [...base, `★ ${ps.stars}`] : base;
  const line = (xs: string[]) => xs.join(sep);
  return textWidth(line(withStars), size, { mono: true }) <= maxWidth ? line(withStars) : line(base);
}

/** The same facts in words, for alt text. */
export function longFacts(ps: ProjectStats): string[] {
  return [
    ps.version && `v${ps.version}`,
    ps.month && `${commas(ps.month)} downloads in the last 30 days`,
    ps.pulls && `${commas(ps.pulls)} Docker pulls`,
    ps.stars && `${ps.stars} stars`,
  ].filter(Boolean) as string[];
}

export function tileAlt(info: TileInfo): string {
  const { ps } = info;
  return `${info.name}: ${info.description} ${[info.language, ...longFacts(ps)].filter(Boolean).join(', ')}.`;
}

// ---------- toolbox ----------

export function toolbox(name: ThemeName, items: Tag[]): string {
  const t = theme(name);
  const pad = 24;
  const row = chipRow(t, pad, 54, W - pad, items, 11.5);
  const H = row.bottom + 22;
  const body =
    frame(t, W, H) +
    text(pad, 38, 'Toolbox', { size: 18, fill: t.fg, weight: 700 }) +
    row.svg;
  return doc(W, H, `Toolbox: ${items.map(([l]) => l).join(', ')}`, body);
}
