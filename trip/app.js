/* 公開連結頁：https://tripezgo.com/trip/#<id>.<key>
 *
 * 1. 從 # 片段拿 id 與金鑰（金鑰永遠不離開這個瀏覽器：片段不會送到伺服器）
 * 2. 用 API token 匿名打 CloudKit Web Services `records/lookup`（public database）
 * 3. WebCrypto 解 AES-GCM → 公開版本 → 畫出來
 *
 * 失敗分兩種，畫面要分開（設計稿）：
 *   - record 不存在（停止分享、重新產生過、丟進垃圾桶）→「失效」
 *   - # 缺了、或解不開（網址被截斷、複製漏字）→「網址殘缺」
 * 前者是「去問作者」，後者是「請他重貼一次」。網址殘缺在查網路之前就判得出來，不必打 API。
 */
import { CONFIG } from './config.js';
import { createClient } from './cloudkit.js';
import { clock, daysOf, ITINERARY, linkURL, mapDayOf, openSealed, OpenFailure, parseFragment, plainText, sealedFromRecord } from './core.js';
import { SWATCH_DARK, SWATCH_LIGHT } from './icons.js';
import { iconOf, iconPath, swatchOf } from './looks.js';
import { LANGS, S, STORE } from './strings.js';

/* 類型色：App 的 EventTypeSwatch 十一族（淺／深），寫成 CSS 變數 --sw-<族>。 */
(function paintSwatches() {
  const vars = (t) => Object.keys(t).map((k) => '--sw-' + k + ':' + t[k] + ';').join('');
  const style = document.createElement('style');
  style.textContent = ':root{' + vars(SWATCH_LIGHT) + '}@media (prefers-color-scheme: dark){:root{' + vars(SWATCH_DARK) + '}}';
  document.head.appendChild(style);
})();
const tyVar = (item) => '--ev: var(--sw-' + swatchOf(item) + ')';
const tyIcon = (item) => '<svg class="ty" viewBox="0 0 15 15" fill-rule="evenodd" aria-hidden="true" data-icon="' + iconOf(item) + '"><path d="' + iconPath(iconOf(item)) + '"/></svg>';

/* ═══ 圖示（設計稿的線條圖示組） ═════════════════════════════════
 * 交通方式：設計稿有 car／walk／train；騎車與「其他」取 App 的 DesignIcon（.cycling／.ellipsis）。 */
const IC = {
  driving: '<path d="M4 16v-3.2l1.8-4.3A2 2 0 0 1 7.7 7h8.6a2 2 0 0 1 1.9 1.5L20 12.8V16"/><circle cx="7.5" cy="16.2" r="1.5"/><circle cx="16.5" cy="16.2" r="1.5"/>',
  walking: '<circle cx="13" cy="4.2" r="1.9"/><path d="M11.6 8.6 9.2 13l3 2 1 5.6M13.6 8.6l2 3.4 3 1M12 15l-2.8 5.6"/>',
  transit: '<rect x="5.4" y="3.6" width="13.2" height="12.4" rx="2.3"/><path d="M5.6 11.2h12.8M8.4 20l2-3.6M15.6 20l-2-3.6"/>',
  cycling: '<circle cx="6" cy="16" r="3.2"/><circle cx="18" cy="16" r="3.2"/><path d="M6 16 10 9h4l-2 7M14 9h3l1 7"/>',
  other: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
  cal: '<rect x="3.6" y="5" width="16.8" height="15.4" rx="2.4"/><path d="M3.6 9.8h16.8M8.4 3.4v3.2M15.6 3.4v3.2"/>',
  pin: '<path d="M12 21s6.6-5.6 6.6-10.2A6.6 6.6 0 0 0 5.4 10.8C5.4 15.4 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.4"/>',
  clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3 1.8"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5.8A.8.8 0 0 1 5.8 5H15"/>',
  share: '<path d="M12 16V4M8 7.5 12 3.5l4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/>',
  warn: '<path d="M12 3.6 1.8 20.4h20.4L12 3.6z"/><path d="M12 10v4.4M12 17.4v.1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
};
const svg = (d, cls) => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + d + '</svg>';

/* ═══ 小工具 ═══════════════════════════════════════════════════ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function fmt(tpl, ...args) {
  let i = 0;
  return String(tpl).replace(/%s/g, () => args[i++]);
}
function dur(min, s) {
  if (min < 60) return fmt(s.min, min);
  const h = Math.floor(min / 60), m = min % 60;
  return m ? fmt(s.hrmin, h, m) : fmt(s.hr, h);
}
const WD = { zh: ['日', '一', '二', '三', '四', '五', '六'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ja: ['日', '月', '火', '水', '木', '金', '土'] };
/** 抬頭與欄頭的日期：「7/30（四）」／「Thu 7/30」（設計稿 `md`）。 */
function md(m, d, wd) {
  if (lang === 'en') return WD.en[wd] + ' ' + m + '/' + d;
  return m + '/' + d + '（' + WD[lang][wd] + '）';
}
function stampOf(iso) {
  const t = new Date(iso);
  return md(t.getMonth() + 1, t.getDate(), t.getDay()) + ' ' + clock(t.getHours() * 60 + t.getMinutes());
}
function store(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch (e) { /* 私密瀏覽、封鎖網站資料：語言記不住就算了 */ }
  return null;
}

/* ═══ 狀態 ═════════════════════════════════════════════════════
 * state: 'loading' | 'normal' | 'gone' | 'bad' */
let lang = 'zh';
let state = 'loading';
let D = null;           /* { copy, days, allday, adLanes, record, env } */
const pageEl = document.getElementById('page');
const s = () => S[lang];

function pickLanguage() {
  const saved = store('tez.lang');
  if (S[saved]) return saved;
  const tag = (navigator.language || 'zh').toLowerCase();
  return tag.indexOf('ja') === 0 ? 'ja' : tag.indexOf('zh') === 0 ? 'zh' : 'en';
}

/* ═══ 整理：全日行程排道 ═════════════════════════════════════ */
function prepare(copy, found) {
  const days = daysOf(copy);
  const ads = copy.items
    .map((it, i) => ({ it, i }))
    .filter((x) => x.it.to !== null)
    .map((x) => {
      const st = Math.max(1, x.it.day);
      return { id: x.i, name: x.it.title, s: st, e: Math.min(copy.days, Math.max(st, x.it.to)) };
    })
    .filter((a) => a.s <= copy.days)
    .sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
  let lanes = 0;
  ads.forEach((a) => {
    for (let k = 0; ; k++) {
      const clash = ads.some((b) => b !== a && b.lane === k && a.s <= b.e && b.s <= a.e);
      if (!clash) { a.lane = k; if (k + 1 > lanes) lanes = k + 1; return; }
    }
  });
  days.forEach((d) => d.timed.forEach((x) => { x.id = copy.items.indexOf(x.item); }));
  return { copy, days, allday: ads, adLanes: lanes, record: found.record, env: found.env };
}

/* ═══ 抬頭 ═════════════════════════════════════════════════════ */
function heroHtml() {
  const c = D.copy;
  let f;
  if (!c.start) {
    f = '<span data-testid="dates">' + svg(IC.cal) + esc(s().undated) + '</span>';
  } else {
    const a = D.days[0].date, b = D.days[D.days.length - 1].date;
    f = '<span data-testid="dates">' + svg(IC.cal) + '<span class="mn">' + esc(md(a.m, a.d, a.wd)) + ' – ' + esc(md(b.m, b.d, b.wd)) + '</span></span>';
  }
  f += '<span data-testid="day-count">' + svg(IC.clock) + '<span class="mn">' + c.days + '</span> ' + esc(s().days) + '</span>';
  if (c.place) f += '<span data-testid="place">' + svg(IC.pin) + esc(c.place) + '</span>';
  return '<section class="hero">'
    + coverHtml()
    + '<h1>' + esc(c.name) + '</h1>'
    + '<p class="facts">' + f + '</p>'
    + '<p class="stamp" data-testid="updated">' + esc(fmt(s().updated, stampOf(c.at))) + '</p>'
    + actsHtml()
    + '</section>';
}
/* 封面在字的上面、不墊在字底下（設計稿 D1）：16:9、最高 240px。公開版本裡是 base64 JPEG。 */
function coverHtml() {
  const c = D.copy.cover;
  if (!c || !/^[A-Za-z0-9+/=]+$/.test(c)) return '';
  return '<div class="cover" role="img" aria-label="" data-testid="cover" style="background-image:url(data:image/jpeg;base64,' + c + ')"></div>';
}
function actsHtml() {
  return '<div class="acts">' + copyAppHtml()
    + '<button class="btn2" type="button" id="act-text" data-testid="copy-text">' + svg(IC.share) + esc(s().copyText) + '</button>'
    + '</div>' + actsNoteHtml();
}
/* ═══ 複製成我的旅程（票 11） ═══════════════════════════════════
 *
 * **按鈕指向另一個網域**：這一頁在 tripezgo.com 就指 www.tripezgo.com，反過來也一樣。同網域的點擊
 * 不會觸發 Universal Link，換個網域才會（spike：LINE 裡 www 會叫起 App、裸網域不會）。所以
 * 已裝 App 的人按下去就進 App 的預覽，這一頁什麼都不必做——**不 preventDefault**，讓那一下是
 * 一次真的、由使用者點出來的連結（程式跳轉的 Universal Link 不保證觸發）。
 *
 * 沒裝 App 的人：那一下會從 www 被 301 帶回這一頁（# 片段跟著走）。所以按下去的當下就
 *   1. 把整條連結寫進剪貼簿——App 第一次打開時讀剪貼簿接回來（同 join/ 的延後機制）
 *   2. 在 sessionStorage 記一筆「這一趟存過了」
 * 回到這一頁看到那一筆，按鈕就換成「前往下載」、旁邊的話換成「連結已經存起來了」——跟 join/
 * 一樣是兩下：跳到下載頁之後就沒有地方告訴他連結存好了。第二下去下載之前再寫一次剪貼簿，
 * 以防第一下的寫入被跳頁打斷。
 *
 * 剪貼簿裡放 www 那一條：那是 App 發出去的正式寫法（App 兩種主機都認）。 */
const WWW = 'www.tripezgo.com';
const APEX = 'tripezgo.com';
const SAVED = () => 'tez.saved.' + D.link.id;

function otherHost() { return location.hostname === WWW ? APEX : WWW; }
function shareLink() { return linkURL(WWW, D.link.id, D.link.key); }
function isSaved() { return session.get(SAVED()) === '1'; }

function copyAppHtml() {
  if (isSaved()) {
    return '<a class="cta" id="act-app" data-testid="copy-app" data-saved="1" href="' + esc(STORE[lang]) + '">' + esc(s().savedGo) + '</a>';
  }
  return '<a class="cta" id="act-app" data-testid="copy-app" href="' + esc(linkURL(otherHost(), D.link.id, D.link.key)) + '">'
    + svg(IC.copy) + esc(s().copyApp) + '</a>';
}
function actsNoteHtml() {
  const note = isSaved() ? '<b>' + esc(s().savedHead) + '</b>　' + esc(s().savedLede) : s().copyAppNote;
  return '<p class="acts-note" data-testid="copy-app-note">' + note + '</p>';
}
function onCopyApp(ev) {
  const saved = ev.target.closest('#act-app').dataset.saved === '1';
  if (saved) {
    /* 第二下去下載：不需要 Universal Link，所以等剪貼簿寫完再走——跳頁會打斷還沒寫完的剪貼簿
     *（測試量到的：同步寫完立刻跳，剪貼簿裡是舊的）。 */
    ev.preventDefault();
    const go = () => location.assign(STORE[lang]);
    writeClipboard(shareLink()).then(go, go);
    return;
  }
  /* 第一下：照 href 走（Universal Link），不能等。寫入在 pointerdown 就先起跑（見底下），
   * 這裡在 click 再寫一次，兩次都在使用者的手勢裡。 */
  writeClipboard(shareLink()).catch(() => {});
  session.set(SAVED(), '1');
}
/* pointerdown 也是一個手勢：在 click 之前幾十毫秒就開始寫剪貼簿，讓它在跳頁之前寫完。 */
document.addEventListener('pointerdown', (ev) => {
  const b = ev.target.closest && ev.target.closest('#act-app');
  if (b && b.dataset.saved !== '1') writeClipboard(shareLink()).catch(() => {});
});

/* ═══ 時間軸（設計稿原樣；欄頭支援日期未定） ═════════════════════ */
const PPM = 1, HOUR = 60 * PPM;
const FIT3 = 58, FIT2 = 42, FIT1 = 25, LINE_EXT = 15, LEG_LB = 18, AD_H = 24;
function timeSpan() {
  let lo = 24 * 60, hi = 0;
  D.days.forEach((d) => d.timed.forEach((x) => { if (x.s < lo) lo = x.s; if (x.e > hi) hi = x.e; }));
  if (hi <= lo) { lo = 9 * 60; hi = 18 * 60; }
  return { lo: Math.floor(lo / 60) * 60, hi: Math.ceil(hi / 60) * 60 };
}
function timelineHtml() {
  const r = timeSpan(), gh = (r.hi - r.lo) * PPM;
  let hours = '';
  for (let t = r.lo; t <= r.hi; t += 30) {
    hours += '<span class="tl-hr' + (t % 60 ? ' is-half' : '') + '" style="top:' + ((t - r.lo) * PPM) + 'px">' + esc(clock(t)) + '</span>';
  }
  const cols = D.days.map((d) => {
    const boxes = d.timed.map((x) => {
      const h = (x.e - x.s) * PPM, line = h < FIT1;
      return { x, st: x.s, en: x.e, line, top: (x.s - r.lo) * PPM, h: line ? Math.max(1, Math.round(h)) : h, ext: line ? Math.max(h, LINE_EXT) : h, lane: 0, lanes: 1 };
    });
    for (let gi = 0; gi < boxes.length;) {
      let gEnd = boxes[gi].top + boxes[gi].ext, gj = gi + 1;
      while (gj < boxes.length && boxes[gj].top < gEnd) { gEnd = Math.max(gEnd, boxes[gj].top + boxes[gj].ext); gj++; }
      const ends = [];
      for (let gk = gi; gk < gj; gk++) {
        const bx = boxes[gk];
        for (let ln = 0; ; ln++) { if (ends[ln] === undefined || ends[ln] <= bx.top) { ends[ln] = bx.top + bx.ext; bx.lane = ln; break; } }
      }
      for (let gm = gi; gm < gj; gm++) boxes[gm].lanes = ends.length;
      gi = gj;
    }
    let legHtml = '', evHtml = '';
    boxes.forEach((b, i) => {
      const it = b.x.item, prev = i ? boxes[i - 1] : null;
      const pe = prev ? prev.en : 0;
      if (prev && it.leg && b.st > pe) {
        const lh = (b.st - pe) * PPM;
        /* 路程標籤只給真的在移動的那幾種；「空檔」（idle／未設定）不是一段路（App 的 LegMode.isJourney）。 */
        const mode = it.leg.mode && s().modes[it.leg.mode] ? it.leg.mode : null;
        legHtml += '<div class="tl-lg" style="top:' + ((pe - r.lo) * PPM) + 'px;height:' + lh + 'px">'
          + (mode && lh >= LEG_LB ? '<span class="b" data-testid="leg">' + svg(IC[mode]) + '<span>' + esc(s().modes[mode])
            + ' · <span class="mn">' + esc(dur(it.leg.min, s())) + '</span></span></span>' : '') + '</div>';
      }
      const span = clock(b.st) + '–' + clock(b.en), nm = it.title;
      const sub = [it.place, dur(b.en - b.st, s())].filter(Boolean).join(' · ');
      const inner = b.line ? '<span class="nm">' + esc(nm) + '</span>'
        : b.h >= FIT2 ? '<p class="h">' + esc(span) + '</p><p class="n">' + esc(nm) + '</p>'
          + (b.h >= FIT3 && sub ? '<p class="m">' + esc(sub) + '</p>' : '')
          : '<p class="one">' + (b.lanes === 1 ? '<span class="mn">' + esc(clock(b.st)) + '</span>' : '')
          + '<span class="nm">' + esc(nm) + '</span></p>';
      let geo = 'top:' + b.top + 'px;height:' + b.h + 'px';
      if (b.lanes > 1) geo += ';left:calc(6px + ' + b.lane + ' * (100% - 12px) / ' + b.lanes + ');width:calc((100% - 12px) / ' + b.lanes + ' - 2px)';
      evHtml += '<button type="button" class="tl-ev' + (b.line ? ' is-line' : '') + '" data-ev="' + b.x.id + '"'
        + ' title="' + esc(span + ' ' + nm + (sub ? ' · ' + sub : '')) + '"'
        + ' style="' + geo + '">' + inner + '</button>';
    });
    const body = legHtml + evHtml;
    const hd = esc(fmt(s().day, d.n)) + (d.date ? '<span>' + esc(md(d.date.m, d.date.d, d.date.wd)) + '</span>' : '');
    return '<section class="tl-day" data-testid="day-' + d.n + '"><div class="tl-hd"><div class="t">' + hd + '</div></div>'
      + '<div class="tl-ad"></div><div class="tl-cv">' + (body || '<p class="empty">' + esc(s().empty) + '</p>') + '</div></section>';
  }).join('');
  const band = D.allday.map((a) => '<span class="tl-adb" data-testid="allday" title="' + esc(a.name) + '" style="left:calc(var(--ax) + ' + (a.s - 1) + ' * var(--colw) + 6px)'
    + ';width:calc(' + (a.e - a.s + 1) + ' * var(--colw) - 12px);top:' + (a.lane * AD_H) + 'px">' + esc(a.name) + '</span>').join('');
  const adh = D.adLanes ? D.adLanes * AD_H + 6 : 0;
  return '<section id="timeline"><div class="tl-sc" tabindex="0" role="group" aria-label="' + esc(s().grid) + '">'
    + '<div class="tl-in" style="--gh:' + gh + 'px;--hh:' + HOUR + 'px;--adh:' + adh + 'px">'
    + '<div class="tl-ax"><div class="tl-hd"></div><div class="tl-ad"></div><div class="tl-axb">' + hours + '</div></div>'
    + cols + (band ? '<div class="tl-ads">' + band + '</div>' : '') + '</div></div></section>';
}

/* ═══ 行事曆／地圖兩個 tab（使用者決定 2026-09-26） ══════════════
 * 先前地圖疊在時間表底下；改成兩個 tab，一次只看一種。預設行事曆——這一頁的主角是時間表。
 * 換語言、開地點卡都不跳回；重新整理回到行事曆（網址片段是金鑰，不拿來記 tab）。 */
let view = 'cal';
function tabsHtml() {
  const tab = (k, label) => '<button type="button" role="tab" data-view="' + k + '" aria-selected="' + (view === k)
    + '" aria-pressed="' + (view === k) + '">' + esc(label) + '</button>';
  return '<div class="seg vtabs" role="tablist" data-testid="view-tabs">' + tab('cal', s().cal) + tab('map', s().map) + '</div>';
}

/* ═══ 地圖（MapKit JS） ═══════════════════════════════════════
 * 第二個 tab、一次一天（設計稿 D2）：類型色＋當天順序號，底下附清單；沒座標的只列不上圖。
 * **沒有 MapKit JS token 就沒有地圖框**：清單照列、點得開地點卡，其他照常（config.js）。 */
let mapDay = 1;
let mapInstance = null;
let mapkitLoading = null;

function mapPoints(day) {
  let no = 0;
  return day.timed.map((x) => ({ x, no: x.item.geo ? ++no : null }));
}
const itemId = (it) => D.copy.items.indexOf(it);
/* 清單的一列：編號、時刻（全日的寫「全日」）、類型圖示、名稱與地點。 */
function mapRow(it, no, when, sub) {
  const has = no !== null;
  return '<li><button type="button" class="prow" data-ev="' + itemId(it) + '" data-testid="map-row" style="' + tyVar(it) + '">'
    + '<span class="no' + (has ? '' : ' is-none') + '">' + (has ? no : '–') + '</span>'
    + '<span class="tm">' + esc(when) + '</span>'
    + tyIcon(it)
    + '<span class="bd"><span class="t">' + esc(it.title) + '</span><span class="s">' + esc(sub) + '</span></span>'
    + svg(IC.chev, 'chev') + '</button></li>';
}
function mapHtml() {
  if (mapDay > D.days.length) mapDay = 1;
  const d = D.days[mapDay - 1];
  const seg = D.days.map((x) => '<button type="button" data-mday="' + x.n + '" aria-pressed="' + (x.n === mapDay) + '">' + esc(fmt(s().day, x.n)) + '</button>').join('');
  let box = '', list = '';
  if (CONFIG.mapkitToken) {
    /* 有地圖：底下只列沒地點的（照 App 的 placeless），有地點的都在圖上、點了開地點卡。 */
    const m = mapDayOf(d);
    box = '<div class="map" id="map" data-testid="map"></div>';
    const rows = m.placeless.map(({ x, item }) =>
      mapRow(item, null, x ? clock(x.s) : ITINERARY[lang].allDay, item.place || s().mapNone)).join('');
    list = rows ? '<h3 class="plist-h" data-testid="map-list-head">' + esc(s().mapPlaceless) + '</h3><ul class="plist" data-testid="map-list">' + rows + '</ul>'
      : m.pins.length ? '' : '<p class="empty">' + esc(s().mapAll) + '</p>';
  } else {
    /* 沒有地圖（沒有 token、或 CDN 讀不到）：整天都列，編號跟圖上會用的一樣。 */
    const rows = mapPoints(d).map(({ x, no }) => mapRow(x.item, no, clock(x.s), no !== null ? x.item.place || '' : s().mapNone)).join('');
    list = rows ? '<ul class="plist" data-testid="map-list">' + rows + '</ul>' : '<p class="empty">' + esc(s().mapAll) + '</p>';
  }
  return '<section class="sec" data-testid="map-section"><div class="sec-h">'
    + '<div class="seg" role="group">' + seg + '</div></div>'
    + box + list + '</section>';
}

function loadMapKit() {
  if (!mapkitLoading) {
    mapkitLoading = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
      el.crossOrigin = 'anonymous';
      el.onload = () => {
        window.mapkit.init({ authorizationCallback: (done) => done(CONFIG.mapkitToken) });
        resolve(window.mapkit);
      };
      el.onerror = reject;
      document.head.appendChild(el);
    });
  }
  return mapkitLoading;
}

async function mountMap() {
  if (mapInstance) { mapInstance.destroy(); mapInstance = null; }
  const el = document.getElementById('map');
  if (!el) return;
  let mk;
  try {
    mk = await loadMapKit();
  } catch (err) {
    el.remove(); /* CDN 讀不到：退回只有清單 */
    return;
  }
  if (!document.body.contains(el)) return; /* 等 MapKit 的時候已經換過一次畫面 */
  mk.language = LANGS.find((l) => l.k === lang).html;
  const map = new mk.Map(el);
  const m = mapDayOf(D.days[mapDay - 1]);
  const css = getComputedStyle(document.documentElement);
  const probe = document.createElement('span');
  el.appendChild(probe);
  const coord = (g) => new mk.Coordinate(g[0], g[1]);
  const pins = m.pins.map(({ item, no }) => {
    probe.setAttribute('style', tyVar(item) + ';color:var(--ev)');
    const a = new mk.MarkerAnnotation(coord(item.geo), {
      color: getComputedStyle(probe).color,
      glyphText: no === null ? '' : String(no),
      title: item.title,
      data: { id: itemId(item) },
    });
    a.addEventListener('select', () => openPlace(itemId(item)));
    return a;
  });
  probe.remove();
  /* 線：App 的 tzAccentInk、3pt；沒有交通方式是 [2, 6] 的虛線（TripMapMetrics）。 */
  const ink = css.getPropertyValue('--machi-ink').trim();
  map.addOverlays(m.lines.map((l) => new mk.PolylineOverlay([coord(l.from.item.geo), coord(l.to.item.geo)], {
    style: new mk.Style({ strokeColor: ink, lineWidth: 3, lineCap: 'round', lineJoin: 'round', lineDash: l.solid ? [] : [2, 6] }),
  })));
  /* 路程標在線的中點：交通方式＋時間（使用者要求 2026-09-26；App 的 pill 只寫距離）。 */
  const labels = m.lines.filter((l) => l.leg).map((l) => {
    const mid = [(l.from.item.geo[0] + l.to.item.geo[0]) / 2, (l.from.item.geo[1] + l.to.item.geo[1]) / 2];
    const mode = s().modes[l.leg.mode] ? l.leg.mode : 'other';
    return new mk.Annotation(coord(mid), () => {
      const pill = document.createElement('span');
      pill.className = 'map-leg';
      pill.innerHTML = svg(IC[mode] || IC.chev) + '<span>' + esc(s().modes[mode]) + (l.leg.min ? ' · ' + esc(dur(l.leg.min, s())) : '') + '</span>';
      return pill;
    }, { anchorOffset: new DOMPoint(0, 0), enabled: false, displayPriority: 1000 });
  });
  map.addAnnotations(pins.concat(labels));
  /* 鏡頭：當天第一個點、50 公里見方（App 的 TripMapMetrics.defaultSpanMetres）。 */
  if (m.focus) {
    const dLat = 50000 / 111320;
    const dLng = dLat / Math.max(0.1, Math.cos(m.focus[0] * Math.PI / 180));
    map.setRegionAnimated(new mk.CoordinateRegion(coord(m.focus), new mk.CoordinateSpan(dLat, dLng)), false);
  }
  mapInstance = map;
}

/* ═══ 地點卡：點時間表的方塊、地圖清單、地圖上的點 ════════════════
 * 手機貼底、桌機置中；Apple／Google 地圖各一顆，不替他挑。 */
function placeLinks(it) {
  const q = it.geo ? it.geo.join(',') : it.place || it.title;
  const apple = 'https://maps.apple.com/?' + (it.geo ? 'll=' + q + '&q=' + encodeURIComponent(it.title) : 'q=' + encodeURIComponent(q));
  const google = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  return { apple, google };
}
function whenText(id) {
  for (const d of D.days) {
    const x = d.timed.find((t) => t.id === id);
    if (x) return fmt(s().day, d.n) + ' · ' + clock(x.s) + '–' + clock(x.e);
  }
  return '';
}
function openPlace(id) {
  const it = D.copy.items[id];
  if (!it) return;
  const { apple, google } = placeLinks(it);
  closePlace();
  const w = document.createElement('div');
  w.id = 'place';
  w.innerHTML = '<div class="scrim" data-close></div><div class="pcard" role="dialog" aria-modal="true" aria-labelledby="pc-t" data-testid="place-card" style="' + tyVar(it) + '">'
    + '<p class="k">' + tyIcon(it) + '<span>' + esc(whenText(id)) + '</span></p>'
    + '<h3 id="pc-t">' + esc(it.title) + '</h3>' + (it.place ? '<p class="loc">' + esc(it.place) + '</p>' : '')
    + '<div class="go"><a class="btn2" target="_blank" rel="noopener" data-testid="open-apple" href="' + esc(apple) + '">' + svg(IC.pin) + esc(s().openApple) + '</a>'
    + '<a class="btn2" target="_blank" rel="noopener" data-testid="open-google" href="' + esc(google) + '">' + svg(IC.pin) + esc(s().openGoogle) + '</a></div>'
    + '<button class="linkbtn x" type="button" data-close>' + esc(s().close) + '</button></div>';
  document.body.appendChild(w);
  w.querySelector('.btn2').focus();
}
function closePlace() {
  const o = document.getElementById('place');
  if (o) o.remove();
}

/* ═══ toast ═══════════════════════════════════════════════════ */
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-t').textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

/** 寫剪貼簿。`navigator.clipboard` 不在（舊瀏覽器、非安全來源）就退回 execCommand。 */
function writeClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    ta.remove();
    (ok ? resolve : reject)();
  });
}

/* ═══ 頁尾 ═════════════════════════════════════════════════════ */
function footHtml() {
  return '<footer class="foot"><p>' + esc(s().note) + '</p><div class="author">' + authorHtml() + '</div></footer>';
}
/* ═══ 作者區：登入後停止分享（票 13） ═══════════════════════════
 * 九成九的讀者不是作者，所以頁尾只有一行字；按了才長出卡片（設計稿 4a–4d）。
 * 「停止分享」是次要鈕（白底紅字），紅色實心只在確認視窗裡出現一次（D4）。
 *
 * author: 'entry' | 'signin' | 'checking' | 'owner' | 'confirm' | 'notowner' */
let author = 'entry';
let busy = false;

function authorHtml() {
  const card = (testid, k, t, w, row) => '<div class="acard" data-testid="' + testid + '"><p class="k">' + esc(k) + '</p>'
    + '<p class="t">' + esc(t) + '</p><p class="w">' + esc(w) + '</p><div class="row">' + row + '</div></div>';
  if (author === 'signin' || author === 'checking') {
    return card('author-signin', s().signinK, s().signinT, s().signinWhy,
      '<button class="btn2" type="button" data-author="go" data-testid="sign-in"' + (author === 'checking' || busy ? ' disabled aria-busy="true"' : '') + '>'
      + svg(IC.link) + esc(s().signinGo) + '</button>'
      + '<button class="linkbtn" type="button" data-author="entry">' + esc(s().cancel) + '</button>');
  }
  if (author === 'owner' || author === 'confirm') {
    return card('author-owner', s().ownerK, s().ownerT, s().ownerWhy,
      '<button class="btn2 is-danger" type="button" data-author="confirm" data-testid="author-stop">' + esc(s().stop) + '</button>'
      + '<button class="linkbtn" type="button" data-author="signout">' + esc(s().signout) + '</button>');
  }
  if (author === 'notowner') {
    return card('author-not-owner', s().ownerK, s().notOwnerT, s().notOwnerWhy,
      '<button class="linkbtn" type="button" data-author="switch">' + esc(s().signout) + '</button>');
  }
  return '<button class="linkbtn" type="button" data-author="signin" data-testid="author-entry">' + esc(s().authorLink) + '</button>';
}

function confirmHtml() {
  return '<div class="scrim" data-author="owner"></div><div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" data-testid="stop-confirm">'
    + '<h3 id="dlg-t">' + esc(s().stopAsk) + '</h3><p>' + esc(s().stopWhy) + '</p>'
    + '<div class="row"><button class="btn2" type="button" data-author="owner">' + esc(s().back) + '</button>'
    + '<button class="btn2 btn-danger" type="button" data-author="stop" data-testid="stop-go"' + (busy ? ' disabled' : '') + '>' + esc(s().stop) + '</button></div></div>';
}

/* web-auth token 放 sessionStorage：這一個分頁、這一趟登入。**每用一次就換一把**——下一把在
 * response header `x-apple-cloudkit-web-auth-token`（spike 量到的；body 裡沒有），舊的立刻作廢。 */
const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* 存不了就等於沒登入 */ } },
  remove(k) { try { sessionStorage.removeItem(k); } catch (e) { /* 同上 */ } },
};
const TOKEN = (env) => 'tez.auth.token.' + env.name;

async function authed(path, body) {
  const env = D.env;
  const r = await client.call(env, path, body, session.get(TOKEN(env)));
  if (r.nextWebAuthToken) session.set(TOKEN(env), r.nextWebAuthToken);
  return r;
}

/** 回到這一頁、手上有 token：問 users/current 是誰，跟 record 的建立者比。 */
async function checkAuthor() {
  author = 'checking';
  draw();
  let r;
  try {
    r = await authed('users/current');
  } catch (err) {
    author = 'signin';
    draw();
    return;
  }
  const me = r.json && r.json.userRecordName;
  if (!me) {
    /* token 過期或被用掉了：當成沒登入，再登一次。 */
    session.remove(TOKEN(D.env));
    author = 'signin';
  } else {
    author = me === D.record.created.userRecordName ? 'owner' : 'notowner';
  }
  draw();
  const cardEl = document.querySelector('.acard');
  if (cardEl && cardEl.scrollIntoView) cardEl.scrollIntoView({ block: 'center' });
}

/** 去 Apple 登入。**跳轉會把 # 片段丟掉**（spike 量到），而金鑰就在 # 裡——先存進 sessionStorage，
 *  回來的時候放回去（見底下 restoreAfterSignIn）。 */
async function signIn() {
  busy = true;
  draw();
  session.set('tez.auth.hash', location.hash);
  session.set('tez.auth.env', D.env.name);
  session.remove(TOKEN(D.env));
  let r = null;
  try {
    r = await client.call(D.env, 'users/current');
  } catch (err) {
    r = null;
  }
  busy = false;
  if (r && r.json && r.json.redirectURL) {
    location.assign(r.json.redirectURL);
    return;
  }
  draw();
}

async function stopSharing() {
  busy = true;
  draw();
  let result = null;
  try {
    const r = await authed('records/modify', {
      operations: [{ operationType: 'delete', record: { recordName: D.record.recordName, recordChangeTag: D.record.recordChangeTag } }],
    });
    result = r.json && r.json.records && r.json.records[0];
  } catch (err) {
    result = null;
  }
  busy = false;
  if (result && result.deleted) {
    session.remove(TOKEN(D.env));
    state = 'stopped';
    author = 'entry';
    draw();
    return;
  }
  author = result && result.serverErrorCode === 'AUTHENTICATION_REQUIRED' ? 'signin' : 'owner';
  draw();
  toast(s().stopFailed);
}

function onAuthorClick(action) {
  if (action === 'go') { signIn(); return; }
  if (action === 'stop') { stopSharing(); return; }
  if (action === 'signout' || action === 'switch') {
    session.remove(TOKEN(D.env));
    author = action === 'switch' ? 'signin' : 'entry';
    draw();
    return;
  }
  author = action; /* entry / signin / owner / confirm */
  draw();
}

/** Apple 登入頁導回來：`?ckWebAuthToken=…`，# 片段已經沒了。把 token 收好、把片段放回網址，
 *  再照常載入；載入完發現有 token 就問 users/current。 */
function restoreAfterSignIn() {
  const params = new URLSearchParams(location.search);
  const token = params.get('ckWebAuthToken');
  if (!token) return;
  const env = session.get('tez.auth.env');
  if (env) session.set('tez.auth.token.' + env, token);
  const hash = location.hash || session.get('tez.auth.hash') || '';
  session.remove('tez.auth.hash');
  history.replaceState(null, '', location.pathname + hash);
}

function msgHtml(t, why, icon, testid) {
  return '<main class="wrap"><section class="msg" role="alert" data-testid="' + testid + '">' + svg(icon, 'ico')
    + '<h1>' + esc(t) + '</h1><p>' + esc(why) + '</p>'
    + '<a href="' + esc(homeHref()) + '">' + esc(s().learn) + '</a></section></main>';
}
function homeHref() { return lang === 'zh' ? '/' : '/' + lang + '/'; }

function loadingHtml() {
  return '<main class="wrap" aria-busy="true" data-testid="loading"><section class="hero">'
    + '<div class="sk sk-cover"></div><div class="sk sk-l" style="width:52px"></div><div class="sk sk-h"></div>'
    + '<div class="sk sk-l" style="width:44%"></div>'
    + '<p class="loading-t" role="status">' + esc(s().loading) + '</p></section>'
    + '<div class="sk sk-grid"></div></main>';
}

/* ═══ 繪製 ═════════════════════════════════════════════════════ */
function draw() {
  document.documentElement.lang = LANGS.find((l) => l.k === lang).html;
  paintLang();
  if (state === 'loading') { pageEl.innerHTML = loadingHtml(); document.title = 'TripEZGo'; return; }
  if (state === 'gone') { pageEl.innerHTML = msgHtml(s().err, s().errWhy, IC.link, 'gone'); document.title = 'TripEZGo'; return; }
  if (state === 'bad') { pageEl.innerHTML = msgHtml(s().badT, s().badWhy, IC.warn, 'bad'); document.title = 'TripEZGo'; return; }
  if (state === 'stopped') { pageEl.innerHTML = msgHtml(s().stoppedT, s().stoppedWhy, IC.link, 'stopped'); document.title = 'TripEZGo'; return; }
  document.title = D.copy.name + ' · TripEZGo';
  pageEl.innerHTML = '<div class="wrap" data-testid="trip">' + heroHtml() + '</div><main class="wrap">'
    + tabsHtml() + (view === 'map' ? mapHtml() : timelineHtml()) + footHtml() + '</main>' + overlayHtml();
  afterDraw();
}
function overlayHtml() { return author === 'confirm' ? confirmHtml() : ''; }
function afterDraw() { mountMap(); }
function paintLang() {
  document.getElementById('lang').innerHTML = LANGS.map((l) =>
    '<button type="button" data-lang="' + l.k + '" lang="' + l.html + '" aria-pressed="' + (l.k === lang) + '">' + esc(l.lb) + '</button>').join('');
}

/* ═══ 互動 ═════════════════════════════════════════════════════ */
document.addEventListener('click', (ev) => {
  let b;
  if ((b = ev.target.closest('[data-lang]'))) { lang = b.dataset.lang; store('tez.lang', lang); closePlace(); draw(); return; }
  if ((b = ev.target.closest('[data-view]'))) { view = b.dataset.view; closePlace(); draw(); return; }
  if ((b = ev.target.closest('[data-mday]'))) { mapDay = +b.dataset.mday; draw(); return; }
  if (ev.target.closest('[data-close]')) { closePlace(); return; }
  if ((b = ev.target.closest('[data-ev]'))) { openPlace(+b.dataset.ev); return; }
  if (ev.target.closest('#act-text')) {
    /* 純文字依觀看者目前選的語言產生，格式逐字照 App 的 TripItineraryTextUseCase（決策 D6）。 */
    writeClipboard(plainText(D.copy, lang)).then(() => toast(s().copiedText), () => {});
    return;
  }
  onClick(ev);
});
function onClick(ev) {
  if (ev.target.closest('#act-app')) { onCopyApp(ev); return; }
  const b = ev.target.closest('[data-author]');
  if (b && !b.disabled) onAuthorClick(b.dataset.author);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePlace(); onEscape(); } });
function onEscape() {
  if (author === 'confirm' && !busy) { author = 'owner'; draw(); }
}

/* ═══ 讀取 ═════════════════════════════════════════════════════ */
const client = createClient({ container: CONFIG.container, environments: CONFIG.environments });

async function load() {
  const link = parseFragment(location.hash);
  if (!link) { state = 'bad'; draw(); return; }
  state = 'loading';
  draw();
  let result;
  try {
    result = await client.lookup(link.id);
  } catch (err) {
    /* 網路或伺服器錯誤：畫面上跟失效同一句（「讀不到這趟行程」）。 */
    state = 'gone';
    draw();
    return;
  }
  if (result.notFound) { state = 'gone'; draw(); return; }
  try {
    const copy = await openSealed(sealedFromRecord(result.found.record), link.key);
    D = prepare(copy, result.found);
    D.link = link;
    state = 'normal';
  } catch (err) {
    if (!(err instanceof OpenFailure)) throw err;
    state = 'bad';
  }
  author = 'entry';
  draw();
  if (state === 'normal' && session.get(TOKEN(D.env))) checkAuthor();
}

lang = pickLanguage();
restoreAfterSignIn();
window.addEventListener('hashchange', load);
load();
