// Writes README.md: the drawn cards as <picture> tags that follow the viewer's light or dark theme,
// with plain Markdown for the parts that need clickable links.
import type { Data } from './fetch.js';
import type { Profile } from './profile.js';
import { ossAlt, prLabel, projectStats, statsTiles, summarize } from './cards.js';
import { commas, esc } from './svg.js';

const pic = (file: string, alt: string, attrs = 'width="100%"') =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${file}-dark.svg"><img src="assets/${file}-light.svg" ${attrs} alt="${esc(alt)}"></picture>`;

const link = (url: string, inner: string, title?: string) =>
  `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}>${inner}</a>`;

export function readme(p: Profile, d: Data): string {
  const s = summarize(d);
  const gh = `https://github.com/${p.user}`;
  const out: string[] = [];

  out.push(link(gh, pic('hero', `${p.hero.title} ${p.hero.tagline}`)));
  out.push(
    `<p align="center">\n${p.links
      .map((l) => {
        const attrs = l.title ? `height="44" title="${esc(l.title)}"` : 'height="44"';
        return link(l.url, pic(`badge-${l.id}`, l.title ?? `${l.label} ${l.handle}`, attrs), l.title);
      })
      .join('\n')}\n</p>`,
  );
  out.push(pic('label-projects', 'Featured projects'));
  out.push(
    `<p align="center">\n${p.featured
      .map((f) => {
        const ps = projectStats(f, d);
        const facts = [ps.version && `v${ps.version}`, ps.month && `${commas(ps.month)} downloads in the last 30 days`, ps.stars && `${ps.stars} stars`];
        return link(`${gh}/${f.repo}`, pic(`project-${f.id}`, `${f.id}: ${f.line} ${facts.filter(Boolean).join(', ')}.`, 'width="49%"'));
      })
      .join('\n')}\n</p>`,
  );

  out.push(
    `<details>\n<summary><b>More projects</b></summary>\n\n${p.more.map(([repo, line]) => `- [**${repo}**](${gh}/${repo}): ${line}`).join('\n')}\n\n</details>`,
  );

  out.push(pic('toolbox', `Toolbox: ${p.toolbox.map(([l]) => l).join(', ')}`));

  const prs = d.oss.reduce((a, o) => a + o.prs, 0);
  out.push(pic('label-oss', `Open-source contributions: ${prLabel(prs)} upstream`));
  out.push(
    `<p align="center">\n${p.contributions
      .flatMap((c) => {
        const o = d.oss.find((x) => x.repo === c.repo);
        return o ? [link(`https://github.com/${c.repo}`, pic(`oss-${c.repo.replace('/', '-')}`, ossAlt(c, o), 'width="49%"'))] : [];
      })
      .join('\n')}\n</p>`,
  );

  out.push(pic('stats', statsTiles(s).map((x) => `${x.value} ${x.label}`).join(', ')));

  out.push(
    `<p align="center"><sub>Cards drawn by <a href="${gh}/${p.user}/tree/main/src">src/</a> in this repo · numbers redrawn every night by a GitHub Action</sub></p>`,
  );
  return out.join('\n\n') + '\n';
}
