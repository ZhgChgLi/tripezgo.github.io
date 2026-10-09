#!/usr/bin/env node
// 分享活動頁的三語版本：/share/（中）、/en/share/、/ja/share/。
//
//   node tools/gen-share.mjs          # 重寫三個 index.html
//
// 模板是 tools/share-template.html，字在 share/strings.js。頁首頁尾從同語言的首頁（/、/en/、/ja/）抽出來，
// 所以首頁的頁首頁尾改了，重跑一次就跟上；tests/unit/share-pages.test.mjs 會在沒重跑時變紅。
// 頁首那排的錨點（#why…）改成指回首頁；語言鈕改成指到另一語的分享頁。頁尾照抄首頁。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S } from '../share/strings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const PAGES = [
  { key: 'zh', htmlLang: 'zh-Hant', gisLang: 'zh-TW', home: '/', out: 'share/index.html' },
  { key: 'en', htmlLang: 'en', gisLang: 'en', home: '/en/', out: 'en/share/index.html' },
  { key: 'ja', htmlLang: 'ja', gisLang: 'ja', home: '/ja/', out: 'ja/share/index.html' },
];
const SHARE_PATH = { '/': '/share/', '/en/': '/en/share/', '/ja/': '/ja/share/' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function slice(html, start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('首頁裡找不到 ' + start);
  return html.slice(a, b + end.length);
}

/** 一個語言的頁面 HTML。 */
export function render(page) {
  const t = S[page.key];
  const home = readFileSync(join(root, page.home.slice(1), 'index.html'), 'utf8');
  const header = slice(home, '<header class="site-header">', '</header>')
    .replace(/class="hide-sm" href="#/g, `class="hide-sm" href="${page.home}#`)
    .replace(/class="lang" href="(\/(?:en\/|ja\/)?)"/g, (_, href) => `class="lang" href="${SHARE_PATH[href]}"`);
  const footer = slice(home, '<footer class="site-footer">', '</footer>');
  const skipLink = slice(home, '<a class="skip-link"', '</a>');

  let html = readFileSync(join(root, 'tools/share-template.html'), 'utf8')
    .replace('{{htmlLang}}', page.htmlLang)
    .replace('{{gisLang}}', page.gisLang)
    .replace('{{title}}', esc(t.title))
    .replace('{{description}}', esc(t.lede))
    .replace('{{skipLink}}', skipLink)
    .replace('{{header}}', header)
    .replace('{{footer}}', footer);

  // 空元素上的 data-t／data-t-html 預先填好字：不必等 JS，也不會先閃一下空白。
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\sdata-t="([A-Za-z0-9]+)"[^>]*>)(<\/\2>)/g,
    (_, open, tag, key, close) => open + esc(t[key]) + close);
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\sdata-t-html="([A-Za-z0-9]+)"[^>]*>)(<\/\2>)/g,
    (_, open, tag, key, close) => open + t[key] + close);
  html = html.replace('<ul class="fine" id="fine"></ul>',
    '<ul class="fine" id="fine">\n' + t.fine.map((f) => '      <li>' + f + '</li>').join('\n') + '\n    </ul>');
  const missing = html.match(/data-t(?:-html)?="[A-Za-z0-9]+"[^>]*><\//);
  if (missing) throw new Error(page.key + ' 有沒填到的字：' + missing[0]);
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const page of PAGES) {
    const path = join(root, page.out);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, render(page));
    console.log('wrote ' + page.out);
  }
}
