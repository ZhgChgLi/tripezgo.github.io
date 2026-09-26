/* Universal Link 認領哪些網址（.well-known/apple-app-site-association）。
 *
 * **Apple 登入導回來的那一條不可以被 App 接走**（使用者回報 2026-09-26）：作者在網頁上按「管理分享連結」→
 * Apple 登入 → 導回 `https://tripezgo.com/trip/?ckWebAuthToken=…`。那是從 idmsa.apple.com 跳過來的、
 * 另一個網域，而 `/trip/` 是 App 認領的路徑——iOS 於是直接打開 App，網頁上的登入永遠接不回來。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const aasa = JSON.parse(readFileSync(new URL('../../.well-known/apple-app-site-association', import.meta.url), 'utf8'));
const components = aasa.applinks.details[0].components;

/** iOS 的比對：由上往下，第一個對上的決定；exclude 的就不開 App。只實作這個檔案用到的語法。 */
function opensTheApp(path, query) {
  const glob = (pattern, text) => new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.?+^$()[\]{}|\\]/g, '\\$&')).join('.*') + '$').test(text);
  for (const c of components) {
    if (!glob(c['/'], path)) continue;
    if (c['?'] && !Object.entries(c['?']).every(([k, v]) => k in query && glob(v, query[k]))) continue;
    return !c.exclude;
  }
  return false;
}

test('Apple 登入導回公開頁（帶 ckWebAuthToken）：不開 App，留在網頁', () => {
  assert.equal(opensTheApp('/trip/', { ckWebAuthToken: 'abc+/=' }), false);
  assert.equal(opensTheApp('/trip', { ckWebAuthToken: 'abc' }), false);
});

test('一般的公開連結與「在 TripEZGo 建立這個旅程」照樣開 App', () => {
  assert.equal(opensTheApp('/trip/', {}), true);
  assert.equal(opensTheApp('/trip/', { open: '1' }), true);
  assert.equal(opensTheApp('/join/', {}), true);
});

test('其他頁不開 App', () => {
  assert.equal(opensTheApp('/', {}), false);
  assert.equal(opensTheApp('/open/', {}), false);
});
