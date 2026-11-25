// Renders README.md into preview/light.html, preview/dark.html and preview/index.html (both side by side),
// styled close to a GitHub profile page. Open preview/index.html in a browser. Nothing here is committed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'preview');

const md = readFileSync(join(ROOT, 'README.md'), 'utf8').replaceAll('assets/', '../assets/');
const html = await marked.parse(md);

const css = {
  light: { bg: '#ffffff', fg: '#1f2328', border: '#d0d7de', link: '#0969da', page: '#f6f8fa' },
  dark: { bg: '#0d1117', fg: '#e6edf3', border: '#30363d', link: '#4493f8', page: '#010409' },
};

function page(t: 'light' | 'dark'): string {
  const c = css[t];
  // A browser picks <source> by its own color scheme, so force the wanted theme's image instead.
  const body =
    t === 'dark'
      ? html.replace(/<picture><source[^>]*srcset="([^"]+)"[^>]*><img src="[^"]+"/g, '<picture><img src="$1"')
      : html.replace(/<source[^>]*>/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Profile preview · ${t}</title><style>
body{margin:0;background:${c.page};color:${c.fg};font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif}
.box{max-width:880px;margin:24px auto;background:${c.bg};border:1px solid ${c.border};border-radius:6px;padding:24px}
.head{font-size:12px;font-family:ui-monospace,Consolas,monospace;opacity:.7;margin-bottom:16px}
a{color:${c.link};text-decoration:none} img{max-width:100%} p{margin:0 0 16px} ul{padding-left:2em}
summary{cursor:pointer} details{margin-bottom:16px}
</style></head><body><div class="box"><div class="head">mcarvin8 / README.md · ${t}</div>${body}</div></body></html>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'light.html'), page('light'));
writeFileSync(join(OUT, 'dark.html'), page('dark'));
writeFileSync(
  join(OUT, 'index.html'),
  `<!doctype html><html><head><meta charset="utf-8"><title>Profile preview</title><style>body{margin:0;display:flex;height:100vh}iframe{flex:1;border:0}</style></head>` +
    `<body><iframe src="light.html"></iframe><iframe src="dark.html"></iframe></body></html>`,
);
console.log(`Preview: ${pathToFileURL(join(OUT, 'index.html')).href}`);
