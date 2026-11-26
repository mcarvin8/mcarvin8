import { readFileSync } from 'node:fs';

export type Tag = [label: string, tone: string];

export type Featured = { id: string; repo: string; npm?: string[]; crates?: string[]; line: string; chips: Tag[] };

/** An upstream project I contribute to. `repo` is owner/name; `npm` is its package, when it has one. */
export type Contribution = { repo: string; npm?: string; line: string };

export type Profile = {
  user: string;
  name: string;
  hero: { kicker: string; title: string; tagline: string; chips: Tag[]; terminal: [kind: 'cmd' | 'ok' | 'out', line: string][] };
  links: { id: string; label: string; handle: string; url: string; tone: string }[];
  npm: { maintainer: string; exclude: string[] };
  crates: { userId: number };
  featured: Featured[];
  toolbox: Tag[];
  more: [repo: string, line: string][];
  contributions: Contribution[];
};

export function loadProfile(path: string): Profile {
  return JSON.parse(readFileSync(path, 'utf8')) as Profile;
}
