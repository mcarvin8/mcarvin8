import { readFileSync } from 'node:fs';

export type Tag = [label: string, tone: string];

export type Featured = { id: string; repo: string; npm?: string[]; crates?: string[]; line: string; chips: Tag[] };

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
  contributions: [repo: string, line: string][];
};

export function loadProfile(path: string): Profile {
  return JSON.parse(readFileSync(path, 'utf8')) as Profile;
}
