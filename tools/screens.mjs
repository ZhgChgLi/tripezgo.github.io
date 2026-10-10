// 把 screens/*.html 渲染成截圖，或跟模擬器的基準圖比對。
//
//   node tools/screens.mjs render calendar "day=2" [--lang=en]   → screens/out/<lang>/calendar.png（1206×2622）
//   node tools/screens.mjs compare calendar "day=2"              → screens/out/compare-calendar.png
//                                                                    左：HTML　中：模擬器（screens/ref/zh/）　右：50% 疊圖
//   node tools/screens.mjs all                                     → 依 SHOTS 清單出三語全部截圖
//
// 基準圖要重拍：模擬器 iPhone 17 Pro、狀態列 9:41、日本時區啟動（SIMCTL_CHILD_TZ=Asia/Tokyo），
// 存成 screens/ref/<lang>/<name>.png。App 改了 UI 就重拍、重跑 compare，看哪幾張要跟著改。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screens = path.join(root, 'screens');
const LANGS = { zh: 'zh-Hant-TW', en: 'en', ja: 'ja' };

// 官網用到的畫面：[檔名, 頁面, 參數]
export const SHOTS = [
  ['calendar', 'calendar', 'day=2'],
  ['timeline', 'timeline', 'day=2'], ['overview', 'overview', ''],
  ['note', 'note', ''], ['scan', 'scan', ''], ['fx', 'fx', ''], ['shop', 'shop', ''],
  ['event', 'event', ''], ['event-extra', 'event', 'extra=1'], ['leg', 'leg', ''],
  ['map', 'map', ''], ['map-place', 'map-place', ''], ['map-store', 'map-store', ''], ['map-nav', 'map-nav', ''],
  ['members', 'members', ''], ['share-location', 'share-location', ''], ['lock', 'lock', ''], ['widget', 'widget', ''],
];

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.join(screens, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(screens) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    }).listen(0, () => resolve(srv));
  });
}

async function shoot(page, port, name, query, lang) {
  const url = `http://localhost:${port}/${name}.html?lang=${LANGS[lang]}&${query || ''}`;
  await page.goto(url);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
  return page.locator('#d').screenshot();
}

const [cmd, name, query = '', ...rest] = process.argv.slice(2);
const lang = (rest.find(a => a.startsWith('--lang=')) || '--lang=zh').slice(7);
const srv = await serve();
const port = srv.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
page.on('pageerror', e => console.error('page error:', e.message));
page.on('console', m => m.type() === 'error' && console.error('console:', m.text()));

try {
  if (cmd === 'render' || cmd === 'compare') {
    const png = await shoot(page, port, name, query, lang);
    const out = path.join(screens, 'out', lang);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `${name}.png`), png);
    console.log('wrote', path.join(out, `${name}.png`));
    if (cmd === 'compare') {
      const ref = path.join(screens, 'ref', lang, `${name}.png`);
      const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
      const cmp = await browser.newPage({ viewport: { width: 1206 + 20, height: 874 }, deviceScaleFactor: 2 });
      await cmp.setContent(`<body style="margin:0;display:flex;gap:10px;background:#333">
        <img src="${b64(path.join(out, `${name}.png`))}" width="402">
        <img src="${b64(ref)}" width="402">
        <div style="position:relative;width:402px;height:874px">
          <img src="${b64(ref)}" width="402" style="position:absolute;inset:0">
          <img src="${b64(path.join(out, `${name}.png`))}" width="402" style="position:absolute;inset:0;opacity:.5;mix-blend-mode:difference">
        </div></body>`);
      await cmp.waitForTimeout(200);
      const file = path.join(screens, 'out', `compare-${name}.png`);
      await cmp.screenshot({ path: file });
      console.log('wrote', file);
    }
  } else if (cmd === 'all') {
    for (const l of Object.keys(LANGS)) for (const [file, page_, q] of SHOTS) {
      const png = await shoot(page, port, page_, q, l);
      const out = path.join(screens, 'out', l);
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, `${file}.png`), png);
      console.log(l, file);
    }
  } else {
    console.log('usage: node tools/screens.mjs render|compare <name> [query] [--lang=zh|en|ja] | all');
  }
} finally {
  await browser.close();
  srv.close();
}
