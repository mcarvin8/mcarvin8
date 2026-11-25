// Every card the README shows. Each function returns one finished SVG document for one theme.
import type { Data, Day } from './fetch.js';
import type { Featured, Profile, Tag } from './profile.js';
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
    packages: d.npm.length + d.crates.length,
    contributions: d.github.total,
    streak: s.current,
    bestStreak: s.best,
    stars: d.github.stars,
    publicRepos: d.github.publicRepos,
  };
}

export type ProjectStats = { version?: string; month: number; stars: number; weekly: number[]; registry: string };

export function projectStats(f: Featured, d: Data): ProjectStats {
  const npm = d.npm.filter((p) => f.npm?.includes(p.name));
  const crates = d.crates.filter((c) => f.crates?.includes(c.name));
  const weekly = Array.from({ length: 12 }, (_, i) =>
    [...npm, ...crates].reduce((a, x) => a + (x.weekly[i] ?? 0), 0),
  );
  return {
    version: crates[0]?.version ?? npm[0]?.version,
    month: npm.reduce((a, p) => a + p.month, 0) + crates.reduce((a, c) => a + c.month, 0),
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

const BADGE_ICON: Record<string, string> = { gh: 'gh', npm: 'npm', crates: 'rs', hi: 'hi' };

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
    { value: String(s.packages), label: 'npm packages & crates published' },
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

// ---------- contribution heatmap ----------

export function heatmap(name: ThemeName, d: Data): string {
  const t = theme(name);
  const H = 218;
  const cell = 11;
  const step = 14;
  const x0 = 58;
  const y0 = 82;
  const days = d.github.days;

  // Thresholds from the spread of non-zero days, so one huge day doesn't wash the rest out.
  const nz = days.map((x) => x.count).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (f: number) => nz[Math.min(nz.length - 1, Math.floor(nz.length * f))] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (c: number) => (c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4);

  const first = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  let cells = '';
  let months = '';
  let lastMonth = -1;
  let lastLabelCol = -10;
  days.forEach((day, i) => {
    const idx = i + first;
    const col = Math.floor(idx / 7);
    const row = idx % 7;
    cells += `<rect x="${x0 + col * step}" y="${y0 + row * step}" width="${cell}" height="${cell}" rx="2.5" fill="${t.heat[level(day.count)]}"/>`;
    const dt = new Date(`${day.date}T00:00:00Z`);
    if (row === 0 || i === 0) {
      const m = dt.getUTCMonth();
      if (m !== lastMonth) {
        if (col - lastLabelCol >= 3) {
          months += text(x0 + col * step, y0 - 10, dt.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), { size: 11.5, fill: t.muted });
          lastLabelCol = col;
        }
        lastMonth = m;
      }
    }
  });
  const dow = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']] as const;
  const dowSvg = dow.map(([row, l]) => text(x0 - 10, y0 + row * step + 9.5, l, { size: 11, fill: t.muted, anchor: 'end' })).join('');

  const legendX = W - 24 - 5 * step - 34;
  const legend =
    text(legendX - 8, H - 18, 'Less', { size: 11, fill: t.muted, anchor: 'end' }) +
    t.heat.map((c, i) => `<rect x="${legendX + i * step}" y="${H - 28}" width="${cell}" height="${cell}" rx="2.5" fill="${c}"/>`).join('') +
    text(legendX + 5 * step + 4, H - 18, 'More', { size: 11, fill: t.muted });

  const s = streaks(days);
  const title = `${commas(d.github.total)} contributions in the last year`;
  const body =
    frame(t, W, H) +
    text(24, 40, title, { size: 18, fill: t.fg, weight: 700 }) +
    text(W - 24, 40, `streak ${s.current} · best ${s.best}`, { size: 12, fill: t.muted, mono: true, anchor: 'end' }) +
    months +
    dowSvg +
    cells +
    legend;
  return doc(W, H, title, body);
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

  const facts = [ps.version ? `v${ps.version}` : '', ps.month ? `${compact(ps.month)}/mo` : '', `★ ${ps.stars}`].filter(Boolean).join('  ·  ');
  body += text(pad, 196, facts, { size: 12.5, fill: t.muted, mono: true });
  if (ps.weekly.some((v) => v > 0)) {
    body += sparkline(ps.weekly, PW - pad - 104, 178, 104, 24, t.accent);
  }
  const alt = `${f.id}: ${f.line} ${[ps.version && `v${ps.version}`, ps.month && `${commas(ps.month)} downloads in the last 30 days`, `${ps.stars} stars`].filter(Boolean).join(', ')}.`;
  return doc(PW, H, alt, body);
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
