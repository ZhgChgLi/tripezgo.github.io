import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, render } from '../../tools/gen-share.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('the three share pages are up to date with the template, the strings and the homepages (run node tools/gen-share.mjs)', () => {
  for (const page of PAGES) assert.equal(readFileSync(join(root, page.out), 'utf8'), render(page), page.out);
});

test('each share page carries its homepage\'s own header and footer', () => {
  for (const page of PAGES) {
    const html = readFileSync(join(root, page.out), 'utf8');
    const home = readFileSync(join(root, page.home.slice(1), 'index.html'), 'utf8');
    const footer = home.slice(home.indexOf('<footer class="site-footer">'), home.indexOf('</footer>') + 9);
    assert.ok(html.includes(footer), page.out + ' footer');
    assert.match(html, new RegExp(`<html lang="${page.htmlLang}">`), page.out);
  }
});

test('the language buttons in the header move between share pages, not back to the homepages', () => {
  for (const page of PAGES) {
    const html = readFileSync(join(root, page.out), 'utf8');
    const header = html.slice(html.indexOf('<header class="site-header">'), html.indexOf('</header>'));
    const langLinks = [...header.matchAll(/class="lang" href="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(langLinks.length, 2, page.out);
    for (const href of langLinks) assert.match(href, /^\/(en\/|ja\/)?share\/$/, page.out);
  }
});
