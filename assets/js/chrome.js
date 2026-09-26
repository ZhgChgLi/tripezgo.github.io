/* 全站共用的頁尾（使用者要求 2026-09-26：公開頁與 /open/ 的頁首頁尾跟首頁同一份）。
 *
 * 首頁三個語言版本（/、/en/、/ja/）的頁尾逐字搬過來；樣式在 /assets/css/chrome.css。
 * 公開頁是在頁內切語言的，所以頁尾用這一支照當下的語言畫，而不是寫死在 HTML 裡。 */
const FOOTER = {
  zh: {
    home: '/', label: 'TripEZGo 首頁', tag: '旅行規劃、快樂出行，一次搞定。', width: '32ch', nav: '頁尾導覽',
    links: [['/privacy.html', '隱私權政策'], ['/terms.html', '使用者條款'], ['mailto:zhgchgli@gmail.com', '聯絡我們'],
      ['/en/', 'English', 'en'], ['/ja/', '日本語', 'ja']],
    made: 'Made for iPhone · 支援繁體中文、English、日本語',
  },
  en: {
    home: '/en/', label: 'TripEZGo home', tag: 'Plan the whole trip, all in one place.', width: '34ch', nav: 'Footer',
    links: [['/en/privacy.html', 'Privacy Policy'], ['/en/terms.html', 'Terms of Use'], ['mailto:zhgchgli@gmail.com', 'Contact'],
      ['/', '繁體中文', 'zh-Hant'], ['/ja/', '日本語', 'ja']],
    made: 'Made for iPhone · English, 繁體中文, 日本語',
  },
  ja: {
    home: '/ja/', label: 'TripEZGo ホーム', tag: '旅の予定を、1本のタイムラインに。', width: '32ch', nav: 'フッター',
    links: [['/ja/privacy.html', 'プライバシーポリシー'], ['/ja/terms.html', '利用規約'], ['mailto:zhgchgli@gmail.com', 'お問い合わせ'],
      ['/', '繁體中文', 'zh-Hant'], ['/en/', 'English', 'en']],
    made: 'Made for iPhone · 日本語、English、繁體中文',
  },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const marks = '<span class="m m-mark" role="img" aria-hidden="true"></span><span class="m m-word" role="img" aria-hidden="true"></span>';

/** 頁首左邊那個標誌連結（回那個語言的首頁）。 */
export function brandHtml(lang) {
  const f = FOOTER[lang] || FOOTER.zh;
  return '<a class="brand" href="' + f.home + '" aria-label="' + esc(f.label) + '">' + marks + '</a>';
}

/** `<footer class="site-footer">` 裡面那一整塊。 */
export function footerHtml(lang) {
  const f = FOOTER[lang] || FOOTER.zh;
  const links = f.links.map(([href, text, hl]) => '<a href="' + href + '"'
    + (hl ? ' hreflang="' + hl + '" lang="' + hl + '"' : '') + '>' + esc(text) + '</a>').join('');
  return '<div class="wrap"><div class="footer-top"><div>' + brandHtml(lang)
    + '<p style="margin:12px 0 0;max-width:' + f.width + '">' + esc(f.tag) + '</p></div>'
    + '<nav class="footer-links" aria-label="' + esc(f.nav) + '">' + links + '</nav></div>'
    + '<div class="footer-bottom"><span>© 2026 TripEZGo</span><span>' + esc(f.made) + '</span></div></div>';
}
