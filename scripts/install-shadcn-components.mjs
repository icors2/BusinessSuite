import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const root = 'apps/web/src';
const components = [
  'use-mobile',
  'separator',
  'sheet',
  'tooltip',
  'skeleton',
  'collapsible',
  'breadcrumb',
  'dropdown-menu',
  'avatar',
  'sidebar',
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(JSON.parse(data)));
      })
      .on('error', reject);
  });
}

function rewrite(content) {
  return content
    .replace(/^"use client"\r?\n\r?\n/m, '')
    .replace(/@\/registry\/new-york-v4\//g, '@/')
    .replace(/@\/registry\/new-york\//g, '@/');
}

for (const name of components) {
  const url = `https://ui.shadcn.com/r/styles/new-york/${name}.json`;
  const item = await fetchJson(url);
  for (const file of item.files || []) {
    let rel = file.path
      .replace(/^registry\/new-york-v4\//, '')
      .replace(/^registry\/new-york\//, '')
      .replace(/^ui\//, 'components/ui/')
      .replace(/^hooks\//, 'hooks/');
    if (rel.startsWith('registry/')) continue;
    const out = path.join(root, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, rewrite(file.content));
    console.log('wrote', out);
  }
}
