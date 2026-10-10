// 地圖分頁（App：Modules/UI/Sources/UI/DesignSystem/Components/TripMap）。
//
// 參數：?lang=zh-Hant-TW|en|ja &card=none|place|store|nav &today=1 &start=2026-10-10
//   map-place.html／map-store.html／map-nav.html 先設 window.MAP_CARD 再載這支，compare 才找得到 ref/zh/<名字>.png。
//
// 地圖本身畫不出來：地圖區是從基準圖截下來的 img/map*.jpg（y=128 以下），上面這一層介面照 App 原始碼畫，
// 位置跟基準圖裡烤進去的那一份重疊。地圖標籤是系統依語系畫的，所以底圖每個語系各截一份：
// 繁中 img/map*.jpg，英日 img/en/、img/ja/（ref/en、ref/ja 截的）。
//
// 三顆浮動鈕裡「回到我的位置」是 MKUserTrackingButton（系統元件），沒有畫，用底圖裡那一顆。
import { fmt, params, lang, t, loadTrip, loadCategories, categoryName, chrome, swatchClass, ready, ICON } from './chrome.js';

const d = document.getElementById('d');
const card = window.MAP_CARD || params.get('card') || 'none';
const trip = await loadTrip();
await loadCategories();
const todayNo = +(params.get('today') || 1);
const start = new Date((params.get('start') || '2026-10-10') + 'T00:00:00');
const dateOf = n => new Date(start.getTime() + (n - 1) * 864e5);
const today = dateOf(todayNo);
const dayNo = 2;

// App 的字串（Scripts/i18n/maps/UI.json、Map.json）
const S = {
  'zh-Hant-TW': { all: '全部', search: '搜尋地標或地址', live: '分享我的位置', openEvent: '開啟行程細節',
    openInMaps: '在地圖開啟', open24: '24 小時營業', note: '資料更新於 2026/10/10，實際狀況可能有所不同。',
    straight: '繼續直行', dist: '360', unit: '公尺', left: '710 公尺', mins: '9 分', status: (a, b) => `步行導航 · 還有 ${a} · ${b}`, headingTo: s => `前往 ${s}`, openDest: '開啟終點' },
  en: { all: 'All', search: 'Search a landmark or address', live: 'Share my location', openEvent: 'Open event details',
    openInMaps: 'Open in Maps', open24: 'Open 24 hours', note: 'Data updated 10/10/2026. Actual hours may differ.',
    straight: 'Continue straight', dist: '0.2', unit: 'miles', left: '0.4 miles', mins: '9 min', status: (a, b) => `Walking · ${a} · ${b} left`, headingTo: s => `Heading to ${s}`, openDest: 'Open destination' },
  ja: { all: 'すべて', search: 'ランドマークや住所を検索', live: '現在地を共有', openEvent: '予定の詳細を開く',
    openInMaps: 'マップで開く', open24: '24 時間営業', note: 'データ更新日 2026/10/10。実際とは異なる場合があります。',
    straight: '直進', dist: '360', unit: 'm', left: '710 m', mins: '9 分', status: (a, b) => `徒歩ナビ · 残り ${a} · ${b}`, headingTo: s => `${s} へ移動中`, openDest: '目的地を開く' },
}[lang] || {};
// chrome.js 的日文與 App 不一樣的兩處（App：「%lld 日目」有空格；分頁叫「旅行」「マップ」）——先在這一頁蓋掉
const dayLabel = n => lang === 'ja' ? `${n} 日目` : t.day(n);
const TABS_JA = ['概要', '旅行', 'マップ', 'ツール', '設定'];

// 範本裡沒有的那一家店（地圖上點到的 7-ELEVEN）。店名與地址是 MapKit 給的日文原名，三語同一份。
const STORE = { name: '7-ELEVEN 広島若草町', address: '広島県広島市東区若草町１８−４６' };
// 地址那一串全形數字在哪裡換行，UIKit 依語系不同（基準圖）：繁中整串不拆（「若草町」後面換行）、
// 英文照字元拆（「若草町１」後面）、日文拆在「−」前面。英文就是 Chromium 的預設。
const storeAddress = () => {
  const nw = m => `<span style="white-space:nowrap">${m}</span>`;
  if (lang === 'zh-Hant-TW') return STORE.address.replace(/[０-９−]+/g, nw);
  if (lang === 'ja') return STORE.address.replace(/−[０-９]+/g, m => '<wbr>' + nw(m));
  return STORE.address;
};

// icon 走 chrome.js 的 ICON（DesignIcon.swift 的轉寫）；筆畫粗細照 DesignIcon.strokeWidth。
// turnStraight 還不在 ICON 裡，先寫在這裡。
const IC = { ...ICON, turnStraight: '<path d="M12 20V6M5.6 12.4 12 6l6.4 6.4"/>' };
const SW = { plus: 2, close: 2, turnStraight: 2, nearby: 1.8, walking: 1.8, mapPin: 1.8, infoFill: 0 };
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke-width="${SW[n] ?? 1.8}">${IC[n]}</g></svg>`;

// 底圖
d.insertAdjacentHTML('beforeend', `<div class="map" style="background-image:url(img/${{ en: 'en/', ja: 'ja/' }[lang] || ''}${card === 'none' ? 'map' : 'map-' + card}.jpg)"></div>`);

// 頁首（同旅程分頁，但右邊沒有切換鈕，標題吃滿到右邊 20）
d.insertAdjacentHTML('beforeend', `
  <div class="head"><div class="greet">${`${t.monthDay(today.getMonth() + 1, today.getDate())} · ${t.weekday[today.getDay()]}`.replace(/[0-9]+/g, m => lang === 'ja' ? m : `<span lang="en">${m}</span>`)}</div>
  <div class="title">${fmt(trip.title).replace(/[\u3000-\u9fff\uff00-\uffef]+/g, m => `<span class="cjk">${m}</span>`)}</div></div>`);

// 日期篩選列：「全部」＋每一天
const chips = [`<div class="chip all"><b>${S.all}</b></div>`].concat(Array.from({ length: trip.dayCount }, (_, i) => {
  const n = i + 1, dt = dateOf(n), isToday = n === todayNo;
  return `<div class="chip${n === dayNo ? ' on' : ''}"><b>${isToday ? '<i></i>' : ''}${isToday ? t.today : dayLabel(n)}</b>
    <span>${t.shortDate(dt.getMonth() + 1, dt.getDate())} ${t.weekday[dt.getDay()]}</span></div>`;
})).join('');
d.insertAdjacentHTML('beforeend', `<div class="chips">${chips}</div>
  <div class="search">${S.search}</div>
  <div class="live"><i></i>${S.live}</div>
  <div class="fab on" style="top:242px">${icon('infoFill')}</div>`);

// 卡片
if (card === 'place') {
  const ev = trip.days.find(x => x.day === dayNo).events.find(e => e.key === 'd2-itsukushima');
  d.insertAdjacentHTML('beforeend', `<div class="card" id="card">
    <div class="c-head"><div class="c-text"><div class="c-title">${fmt(ev.title)}</div>
      <div class="c-sub">${fmt(ev.place.name)}</div>
      <div class="c-detail">${fmt(`${dayLabel(dayNo)} · ${ev.start} – ${ev.end}`)}</div></div>
      <div class="c-btn">${icon('walking')}</div><div class="c-btn">${icon('close')}</div></div>
    <div class="c-tag ${swatchClass(ev.category)}">${categoryName(ev.category)}</div>
    <div class="c-notes">${fmt(ev.notes)}</div>
    <div class="c-action">${S.openEvent}</div></div>`);
} else if (card === 'store') {
  d.insertAdjacentHTML('beforeend', `<div class="card" id="card">
    <div class="c-head"><img class="c-art" src="img/map-shop-7eleven.png" alt="">
      <div class="c-text"><div class="c-title">${STORE.name}</div><div class="c-sub">${storeAddress()}</div></div>
      <div class="c-btn">${icon('walking')}</div><div class="c-btn">${icon('close')}</div></div>
    <div class="c-shop"><div class="c-status"><i></i>${S.open24}</div>
      <div class="c-open">${icon('mapPin')}${S.openInMaps}</div>
      <div class="c-note">${fmt(S.note)}</div></div></div>`);
} else if (card === 'nav') {
  // 步行導航卡（MapNavigationCard.swift）：飯店 → 7-ELEVEN 広島若草町。目的地是店自己的名字，三語同一份。
  d.insertAdjacentHTML('beforeend', `<div class="card" id="card">
    <div class="n-head"><div class="n-ico">${icon('turnStraight')}</div>
      <div class="n-text"><div class="n-man">${S.straight}</div>
        <div class="n-dist"><b>${S.dist}</b><span>${S.unit}</span></div></div>
      <div class="c-btn">${icon('close')}</div></div>
    <div class="n-status">${fmt(S.status(S.left, S.mins))}</div>
    <div class="n-bar"></div>
    <div class="n-dest"><i></i>${S.headingTo('広島若草町')}</div>
    <div class="c-action">${S.openDest}</div></div>`);
}

// 描述三行封頂：UIKit 截在字元上（「two com…」），Chromium 的 line-clamp 截在字上（「two…」）——自己截
const notes = d.querySelector('.c-notes');
if (notes) {
  const full = notes.textContent, max = 3 * parseFloat(getComputedStyle(notes).lineHeight) + 1;
  notes.style.display = 'block';
  if (notes.scrollHeight > max) {
    let lo = 0, hi = full.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; notes.innerHTML = fmt(full.slice(0, mid).trimEnd() + '…'); if (notes.scrollHeight <= max) lo = mid; else hi = mid - 1; }
    notes.innerHTML = fmt(full.slice(0, lo).trimEnd() + '…');
  }
}
// 英文的「—」：UIKit 的 SF 畫得比 Chromium 窄約兩成（基準圖量），不壓的話第三行少一個字
if (notes && lang === 'en') notes.innerHTML = notes.innerHTML.replace(/—/g, '<span class="dash">—</span>');

// 右邊那一列浮動鈕：沒有卡片時「＋／附近／定位」貼在分頁列上方；
// 有卡片時「＋」收起來，「附近／定位」移到卡片上方（定位鈕底邊離卡片頂 40.33，照基準圖量）
const cardEl = document.getElementById('card');
if (cardEl) {
  const top = cardEl.getBoundingClientRect().top - 40.33 - 52 - 12 - 52;
  d.insertAdjacentHTML('beforeend', `<div class="fab" style="top:${top}px">${icon('nearby')}</div>`);
} else {
  d.insertAdjacentHTML('beforeend', `<div class="fab" style="top:595px">${icon('plus')}</div>
    <div class="fab" style="top:659px">${icon('nearby')}</div>`);
}

// 日文頁的 -apple-system 會整段解析成 Hiragino，數字與英文跟著變寬；App（UIKit）的西文走 SF。
// 把西文那幾段包成 lang="en"（同 fmt() 的手法）。抬頭例外：基準圖的抬頭照 Hiragino 的寬度量起來才對。
if (lang === 'ja') {
  const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement.closest('[lang="en"], .head') || !/[0-9A-Za-z]/.test(node.data)) continue;
    const span = document.createElement('span');
    span.innerHTML = node.data.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/ ?(?:[0-9A-Za-z][0-9A-Za-z/:.' -]*[0-9A-Za-z]|[0-9A-Za-z]) ?/g, m => `<span lang="en">${m}</span>`);
    node.replaceWith(span);   // 包成一個 span：父層若是 flex，拆成好幾段會各自吃到 gap
  }
}
// 英文的「 · 」：UIKit 的 SF 畫得比 Chromium 窄，每一顆約 3.5pt（基準圖量）
if (lang === 'en') d.querySelectorAll('.c-detail, .n-status').forEach(el => {
  el.innerHTML = el.innerHTML.replace(/ · /g, '<span class="mdot"> · </span>');
});
chrome(d, { tab: 2 });
if (lang === 'ja') d.querySelectorAll('.tab span').forEach((el, i) => { el.textContent = TABS_JA[i]; });
if (card === 'nav') {
  // 導航中：狀態列 9:41 後面多一枚定位箭頭（系統的 location.fill，照基準圖量），地圖分頁的 icon 掛一顆點
  d.querySelector('.sb').classList.add('locating');
  d.querySelector('.sb-time').insertAdjacentHTML('afterend', `<svg class="sb-loc" viewBox="0 0 13 13" aria-hidden="true">
    <path d="M1.2 5.6 11.8 1.2 7.4 11.8 6.4 6.6Z"/></svg>`);
  d.querySelectorAll('.tab')[2].insertAdjacentHTML('beforeend', '<i class="tab-dot"></i>');
}
ready();
