/* 把公開頁每一支 JS 的網址蓋上內容雜湊：`node tools/stamp-trip.mjs`。
 *
 * ## 為什麼
 *
 * tripezgo.com 前面是 Cloudflare：HTML 快取 10 分鐘，JS 快取 **4 小時**，而且網址不帶版本。
 * 2026-09-26 填上 MapKit token 之後，先前開過頁面的人拿到新的 HTML、舊的 config.js——
 * token 是空的，地圖不出來。蓋上雜湊之後，換的只要是 HTML（10 分鐘內），它指到的整組 JS
 * 就一定是同一版。
 *
 * ## 怎麼做
 *
 * 入口 `<script type="module" src>` 直接帶 `?v=`；其他模組用 import map 把
 * `/trip/<名字>` 對到 `/trip/<名字>?v=`，所以 JS 裡的 `import './core.js'` 不用改。
 * `tests/unit/stamp.test.mjs` 守著：改了 JS 沒重蓋就紅。 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = new URL('../trip/', import.meta.url);
export const MODULES = ['app.js', 'cloudkit.js', 'config.js', 'core.js', 'icons.js', 'looks.js', 'strings.js'];
const START = '<!-- stamp-trip:start -->', END = '<!-- stamp-trip:end -->';

function versioned(name) {
  const hash = createHash('sha256').update(readFileSync(new URL(name, dir))).digest('hex').slice(0, 10);
  return '/trip/' + name + '?v=' + hash;
}

/** 回傳蓋好雜湊的 HTML；已經是最新的就原樣回傳。 */
export function stampedHtml(html) {
  const imports = Object.fromEntries(MODULES.map((m) => ['/trip/' + m, versioned(m)]));
  const block = START + '\n<script type="importmap">' + JSON.stringify({ imports }, null, 1) + '</script>\n'
    + '<script type="module" src="' + imports['/trip/app.js'] + '"></script>\n' + END;
  const i = html.indexOf(START), j = html.indexOf(END);
  if (i < 0 || j < 0) throw new Error('trip/index.html 裡找不到 ' + START + ' … ' + END);
  return html.slice(0, i) + block + html.slice(j + END.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL('index.html', dir);
  const before = readFileSync(file, 'utf8');
  const after = stampedHtml(before);
  if (after !== before) writeFileSync(file, after);
  console.log(after === before ? '已經是最新的' : '已更新 trip/index.html');
}
