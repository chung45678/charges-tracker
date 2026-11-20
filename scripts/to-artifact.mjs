// Turns the single-file Vite build into a body-only HTML fragment for hosting as a claude.ai Artifact.
// Usage: npm run build:single && node scripts/to-artifact.mjs dist-single/index.html out.html
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input = 'dist-single/index.html', output = 'dist-single/artifact.html'] = process.argv;
const html = readFileSync(input, 'utf8');

const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>Snip</title>';
const links = pick(/<link\s+rel="(?:preconnect|stylesheet)"[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script type="module"[^>]*>[\s\S]*?<\/script>/g);

const out = [
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...links,
  ...styles,
  '<div id="root"></div>',
  ...scripts,
].join('\n');

writeFileSync(output, out);
console.log(`wrote ${output} (${(out.length / 1024).toFixed(0)} kB)`);
