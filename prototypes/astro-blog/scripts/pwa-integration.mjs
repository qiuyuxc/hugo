import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export default function pwaIntegration() {
  return {
    name: 'kukie-reading-pwa',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const output = fileURLToPath(dir);
        const assets = (await readdir(join(output, '_astro'))).filter(name => /\.(js|css)$/.test(name)).map(name => `/_astro/${name}`);
        const pages = [];
        async function walk(directory, prefix = '') {
          for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (['_astro', 'fonts', 'vendor', 'mouse', 'katex'].includes(entry.name)) continue;
            if (entry.isDirectory()) await walk(join(directory, entry.name), `${prefix}/${entry.name}`);
            else if (entry.name === 'index.html') pages.push(`${prefix}/`);
          }
        }
        await walk(output);
        const core = [...assets, '/offline/', '/manifest.webmanifest', '/app-icon-192.png', '/app-icon-512.png'];
        const hash = createHash('sha256');
        for (const path of [...core, ...pages].sort()) {
          hash.update(path);
          hash.update(await readFile(join(output, path.endsWith('/') ? `${path}index.html` : path)));
        }
        const source = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
        hash.update(source);
        const prelude = `const VERSION = ${JSON.stringify(hash.digest('hex').slice(0, 16))};\nconst CORE = ${JSON.stringify(core)};\nconst PAGES = new Set(${JSON.stringify(pages)});\n`;
        await writeFile(join(output, 'kukie-sw.js'), prelude + source);
      }
    }
  };
}
