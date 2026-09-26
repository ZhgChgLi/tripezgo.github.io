/* 公開頁的 JS 每一支都帶內容雜湊（2026-09-26：Cloudflare 把 JS 快取 4 小時而 HTML 只 10 分鐘，
 * 使用者拿到新的 HTML 配舊的 config.js——token 已經填了，他還是看不到地圖）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stampedHtml, MODULES } from '../../tools/stamp-trip.mjs';

test('trip/index.html 的雜湊跟每一支 JS 現在的內容對得上（改了 JS 要跑 node tools/stamp-trip.mjs）', () => {
  const html = readFileSync(new URL('../../trip/index.html', import.meta.url), 'utf8');
  assert.equal(html, stampedHtml(html));
});

test('每一支模組都在 import map 裡，入口帶同一種雜湊', () => {
  const html = readFileSync(new URL('../../trip/index.html', import.meta.url), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  for (const path of MODULES) {
    assert.match(map.imports[path], new RegExp('^' + path.replace(/[.]/g, '\\.') + '\\?v=[0-9a-f]{10}$'));
  }
  assert.match(html, /<link rel="stylesheet" href="\/assets\/css\/chrome\.css\?v=[0-9a-f]{10}"/);
  const entry = html.match(/<script type="module" src="([^"]+)"><\/script>/)[1];
  assert.equal(entry, map.imports['/trip/app.js']);
});
