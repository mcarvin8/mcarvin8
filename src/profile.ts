import { readFileSync } from 'node:fs';

export type Tag = [label: string, tone: string];

/** A repo of mine and the registries it publishes to. `docker` names are Docker Hub repos (owner/name). */
export type Listing = { repo: string; npm?: string[]; crates?: string[]; pypi?: string[]; docker?: string[] };

export type Featured = Listing & { id: string; line: string; chips: Tag[] };

/** An upstream project I contribute to. `repo` is owner/name; `npm` is its package, when it has one. Its description comes from GitHub, or npm when GitHub has none. */
export type Contribution = { repo: string; npm?: string };

export type Profile = {
  user: string;
  name: string;
  hero: { kicker: string; title: string; tagline: string; chips: Tag[]; terminal: [kind: 'cmd' | 'ok' | 'out', line: string][] };
  /** `title` is hover text shown on the badge (and read by screen readers). */
  links: { id: string; label: string; handle: string; url: string; tone: string; title?: string }[];
  npm: { maintainer: string; exclude: string[] };
  crates: { userId: number };
  featured: Featured[];
  toolbox: Tag[];
  /** Smaller tiles under the featured cards. Descriptions and languages come from GitHub. */
  more: Listing[];
  contributions: Contribution[];
};

export function loadProfile(path: string): Profile {
  return JSON.parse(readFileSync(path, 'utf8')) as Profile;
}
