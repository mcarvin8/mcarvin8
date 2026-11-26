// Small helpers for writing SVG by hand: themes, escaping, rough text measuring and wrapping.
// GitHub shows README images through its image proxy with no web fonts, so every card uses system font stacks
// and leaves room for the widest of them.

export type ThemeName = 'light' | 'dark';
export const THEMES: ThemeName[] = ['light', 'dark'];

export type Theme = {
  name: ThemeName;
  card: string;
  panel: string;
  border: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  term: { bg: string; border: string; fg: string; muted: string; prompt: string; ok: string };
  chipAlpha: number;
  tones: Record<string, string>;
};

const LIGHT: Theme = {
  name: 'light',
  card: '#ffffff',
  panel: '#f6f8fa',
  border: '#d0d7de',
  fg: '#1f2328',
  muted: '#59636e',
  accent: '#0176d3',
  accent2: '#00a1e0',
  term: { bg: '#0f1623', border: '#0f1623', fg: '#e6edf3', muted: '#8b949e', prompt: '#4fb6f0', ok: '#56d364' },
  chipAlpha: 0.1,
  tones: {
    fg: '#1f2328',
    muted: '#59636e',
    ts: '#2f6fb8',
    node: '#3f7f34',
    rust: '#a0522d',
    py: '#2b5b84',
    bash: '#2f6f2a',
    sf: '#0176d3',
    gitlab: '#c4501b',
    gha: '#1f6feb',
    prom: '#c2401a',
    ai: '#7c3aed',
    npm: '#c12127',
    pypi: '#2f6aa3',
    docker: '#1d63ed',
  },
};

const DARK: Theme = {
  name: 'dark',
  card: '#0d1117',
  panel: '#161b22',
  border: '#30363d',
  fg: '#e6edf3',
  muted: '#9198a1',
  accent: '#4fb6f0',
  accent2: '#2f8ee0',
  term: { bg: '#010409', border: '#30363d', fg: '#e6edf3', muted: '#8b949e', prompt: '#4fb6f0', ok: '#56d364' },
  chipAlpha: 0.16,
  tones: {
    fg: '#e6edf3',
    muted: '#9198a1',
    ts: '#6ea8ff',
    node: '#7cc36e',
    rust: '#e8a87c',
    py: '#79aee0',
    bash: '#8ccf7e',
    sf: '#4fb6f0',
    gitlab: '#fc8d5a',
    gha: '#6aa5ff',
    prom: '#f07a52',
    ai: '#b392f0',
    npm: '#f26b6f',
    pypi: '#ffd43b',
    docker: '#5b9bff',
  },
};

export const theme = (name: ThemeName): Theme => (name === 'light' ? LIGHT : DARK);

export const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
export const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Rough width in px. Errs wide so text never runs past its box in any of the font stacks. */
export function textWidth(s: string, size: number, opts: { mono?: boolean; bold?: boolean } = {}): number {
  const per = opts.mono ? 0.61 : opts.bold ? 0.6 : 0.54;
  return [...s].length * size * per;
}

export function wrap(s: string, maxWidth: number, size: number, maxLines = Infinity): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return kept;
  }
  return lines;
}

/** 6,333 -> "6.3k", 1,250,000 -> "1.3M". */
export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

export const commas = (n: number): string => n.toLocaleString('en-US');

export function doc(w: number, h: number, title: string, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">` +
    `<title>${esc(title)}</title>` +
    `<style>.s{font-family:${SANS}}.m{font-family:${MONO}}</style>` +
    body +
    `</svg>\n`
  );
}

export function text(
  x: number,
  y: number,
  s: string,
  o: { size: number; fill: string; mono?: boolean; weight?: number; anchor?: 'start' | 'middle' | 'end'; opacity?: number },
): string {
  const attrs = [
    `x="${r(x)}"`,
    `y="${r(y)}"`,
    `class="${o.mono ? 'm' : 's'}"`,
    `font-size="${o.size}"`,
    `fill="${o.fill}"`,
    o.weight ? `font-weight="${o.weight}"` : '',
    o.anchor && o.anchor !== 'start' ? `text-anchor="${o.anchor}"` : '',
    o.opacity !== undefined ? `opacity="${o.opacity}"` : '',
  ];
  return `<text ${attrs.filter(Boolean).join(' ')}>${esc(s)}</text>`;
}

export const r = (n: number): string => String(Math.round(n * 10) / 10);

/** A rounded tag with tinted background. Returns its markup and width. */
export function chip(t: Theme, x: number, y: number, label: string, tone: string, size = 12): { svg: string; w: number } {
  const color = t.tones[tone] ?? t.muted;
  const padX = 10;
  const w = textWidth(label, size, { mono: true }) + padX * 2;
  const h = size + 12;
  const svg =
    `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${h}" rx="${h / 2}" fill="${color}" fill-opacity="${tone === 'muted' ? t.chipAlpha * 0.8 : t.chipAlpha}" stroke="${color}" stroke-opacity="0.35"/>` +
    text(x + padX, y + h / 2 + size * 0.36, label, { size, fill: color, mono: true, weight: 500 });
  return { svg, w };
}

/** Lays chips left to right, wrapping at maxX. Returns markup and the bottom y. */
export function chipRow(t: Theme, x: number, y: number, maxX: number, items: [string, string][], size = 12, gap = 8) {
  let cx = x;
  let cy = y;
  const h = size + 12;
  let svg = '';
  for (const [label, tone] of items) {
    const w = textWidth(label, size, { mono: true }) + 20;
    if (cx + w > maxX && cx > x) {
      cx = x;
      cy += h + gap;
    }
    svg += chip(t, cx, cy, label, tone, size).svg;
    cx += w + gap;
  }
  return { svg, bottom: cy + h };
}

/** Line chart with soft area fill. */
export function sparkline(values: number[], x: number, y: number, w: number, h: number, color: string): string {
  if (values.length < 2) return '';
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [x + i * step, y + h - (v / max) * h] as const);
  const line = pts.map(([px, py]) => `${r(px)},${r(py)}`).join(' ');
  const area = `${r(x)},${r(y + h)} ${line} ${r(x + w)},${r(y + h)}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    `<polygon points="${area}" fill="${color}" fill-opacity="0.14"/>` +
    `<polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="${r(lx)}" cy="${r(ly)}" r="3" fill="${color}"/>`
  );
}
