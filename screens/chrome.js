// 共用：讀網址參數、載入範本旅程、畫系統外框（狀態列、分頁列、主畫面橫條）、icon。
//
// 網址參數：?lang=zh-Hant-TW|en|ja（預設繁中）。每支畫面另外自己讀需要的參數（例如 day）。
// 資料：screens/data/sanyo.<lang>.json，是 App 內建範本 jp-sanyo-hiroshima-okayama-6d 的原檔
// （App/iOS/Modules/TripEZGoData/Sources/TripEZGoData/TripTemplateResources），不要手改——
// 範本改了就重新複製一份過來。

export const params = new URLSearchParams(location.search);
export const lang = params.get('lang') || 'zh-Hant-TW';
const htmlLang = { 'zh-Hant-TW': 'zh-Hant-TW', en: 'en', ja: 'ja' }[lang] || 'zh-Hant-TW';
document.documentElement.lang = htmlLang;

export async function loadTrip() {
  const res = await fetch(`./data/sanyo.${lang}.json`);
  return res.json();
}

// App 的 UI 字串（照 App 各語系的 xcstrings 抄，只收畫面上用得到的）
const STRINGS = {
  'zh-Hant-TW': {
    tabs: ['總覽', '旅程', '地圖', '小工具', '設定'],
    today: '今天', day: n => `第 ${n} 天`, allDay: '全日',
    weekday: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'],
    monthDay: (m, d) => `${m}月${d}日`, shortDate: (m, d) => `${m}/${d}`,
    minutes: m => `${m} 分`, hours: h => `${h} 小時`, hm: (h, m) => `${h} 小時 ${m} 分`,
  },
  en: {
    tabs: ['Overview', 'Trip', 'Map', 'Tools', 'Settings'],
    today: 'Today', day: n => `Day ${n}`, allDay: 'All day',
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthDay: (m, d) => `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${d}`,
    shortDate: (m, d) => `${m}/${d}`,
    minutes: m => `${m} min`, hours: h => `${h} h`, hm: (h, m) => `${h} h ${m} min`,
  },
  ja: {
    tabs: ['概要', '旅行', 'マップ', 'ツール', '設定'],
    today: '今日', day: n => `${n} 日目`, allDay: '終日',
    weekday: ['日', '月', '火', '水', '木', '金', '土'],
    monthDay: (m, d) => `${m}月${d}日`, shortDate: (m, d) => `${m}/${d}`,
    minutes: m => `${m} 分`, hours: h => `${h} 時間`, hm: (h, m) => `${h} 時間 ${m} 分`,
  },
};
export const t = STRINGS[lang] || STRINGS['zh-Hant-TW'];

export function duration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return t.minutes(m);
  return m ? t.hm(h, m) : t.hours(h);
}
export const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// ── icon：照 App 的 DesignIcon.swift（它本身是設計稿 <path d> 的轉寫），24×24 線條 ──
export const ICON = {
  overview: '<path d="M4 6h16M4 12h10M4 18h13"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  map: '<path d="M9 3.5 3.5 5.5v15L9 18.5l6 2 5.5-2v-15L15 5.5z M9 3.5v15M15 5.5v15"/>',
  notes: '<path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5M8.5 12.5h7M8.5 16.5h5"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.8-1.4-1.9-3.2-2.1.9a7.6 7.6 0 0 0-2.6-1.5L14.2 3h-3.7l-.4 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.1-.9L3.5 9.1l1.8 1.4a7.6 7.6 0 0 0 0 3l-1.8 1.4 1.9 3.2 2.1-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.3h3.7l.4-2.3a7.6 7.6 0 0 0 2.6-1.5l2.1.9 1.9-3.2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  readingTimeline: '<path d="M8 3.6v1.7M8 9.5v5M8 18.7v1.7M12.4 7.4H20M12.4 16.6h4.8"/><circle cx="8" cy="7.4" r="2.1"/><circle cx="8" cy="16.6" r="2.1"/>',
  readingCalendar: '<rect x="3.2" y="5.2" width="17.6" height="15.6" rx="2.4"/><path d="M8 3.2v4M16 3.2v4M3.2 10.2h17.6M7 13.8h4.6M7 17.4h8"/>',
  transit: '<rect x="6" y="4" width="12" height="12" rx="2"/><path d="M6 11h12M9.5 19.5 8 22M14.5 19.5 16 22"/><circle cx="9.5" cy="13.5" r=".8" fill="currentColor"/><circle cx="14.5" cy="13.5" r=".8" fill="currentColor"/>',
  walking: '<circle cx="13" cy="4" r="2" fill="currentColor" stroke="none"/><path d="M11.5 8.5 9 13l3 2 1 6M13.5 8.5l2 3.5 3 1M12 15l-3 6"/>',
  picker: '<path d="m8 10 4-4 4 4M8 14l4 4 4-4"/>',
  nearby: '<circle cx="12" cy="12" r=".6"/><circle cx="12" cy="12" r="5.5"/><path d="M15.42 2.6A10 10 0 0 1 15.42 21.4M8.58 21.4A10 10 0 0 1 8.58 2.6"/>',
  infoFill: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM13.15 7.9a1.15 1.15 0 1 1-2.3 0a1.15 1.15 0 1 1 2.3 0zM12 11.2a1 1 0 0 1 1 1v3.2a1 1 0 0 1-2 0v-3.2a1 1 0 0 1 1-1z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  turnStraight: '<path d="M12 20V6M5.6 12.4 12 6l6.4 6.4"/>',
  share: '<path d="M12 16V4M8 7.5l4-4 4 4M5 14v5q0 1 1 1h12q1 0 1-1v-5"/>',
  swap: '<path d="m7 9 5-5 5 5M7 15l5 5 5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.2V12l3 1.8"/>',
  mapPin: '<path d="M12 21C16.5 16.5 19 13 19 10A7 7 0 0 0 5 10C5 13 7.5 16.5 12 21z"/><circle cx="12" cy="10" r="2.6"/>',
};
export const svg = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

// ── 系統外框 ──
const SB_ICONS = `
<svg class="sb-icons" width="80" height="13" viewBox="0 0 80 13" fill="currentColor">
  <rect x="0.3" y="8.3" width="3.2" height="4" rx=".8"/><rect x="5.3" y="5.9" width="3.2" height="6.4" rx=".8"/>
  <rect x="10.3" y="3.3" width="3.2" height="9" rx=".8"/><rect x="15.3" y=".3" width="3.2" height="12" rx=".8"/>
  <path d="M35.9 2.6c-2.6 0-5 1-6.8 2.7l1.4 1.4a7.7 7.7 0 0 1 10.8 0l1.4-1.4c-1.8-1.7-4.2-2.7-6.8-2.7zm0 3.9a5.7 5.7 0 0 0-4 1.6l1.4 1.4a3.7 3.7 0 0 1 5.2 0l1.4-1.4a5.7 5.7 0 0 0-4-1.6zm0 3.9c-.5 0-1 .2-1.3.5l1.3 1.4 1.3-1.4c-.3-.3-.8-.5-1.3-.5z" transform="translate(-.8 -1.6) scale(1.08)"/>
  <rect x="53.6" y="1.5" width="23" height="10.3" rx="3" fill="none" stroke="currentColor" stroke-opacity=".38" stroke-width="1"/>
  <rect x="55.4" y="3.2" width="19.4" height="6.9" rx="1.8"/>
  <path d="M78 5v3.6c.7-.3 1.2-1 1.2-1.8S78.7 5.3 78 5z" fill-opacity=".4"/>
</svg>`;

export function chrome(device, { tab = null, dark = false } = {}) {
  device.insertAdjacentHTML('beforeend', `
    <div class="sb${dark ? ' on-dark' : ''}"><div class="sb-time">9:41</div><div class="sb-island"></div>${SB_ICONS}</div>
    <div class="home${dark ? ' on-dark' : ''}"></div>`);
  if (tab !== null) {
    const icons = ['overview', 'calendar', 'map', 'notes', 'settings'];
    device.insertAdjacentHTML('beforeend', `<nav class="tabbar">${icons.map((ic, i) =>
      `<div class="tab${i === tab ? ' on' : ''}">${svg(ic)}<span>${t.tabs[i]}</span></div>`).join('')}</nav>`);
  }
}

// 截圖工具等這個旗標：字型、資料都畫完了才拍
export function ready() { document.fonts.ready.then(() => { document.body.dataset.ready = '1'; }); }

// EventTypeSwatch.swift 的分組：類型名稱 → 色組
const SWATCH = {
  move: ['flight', 'airport', 'ferry', 'harbor', 'hsr', 'train', 'station'],
  moveLocal: ['transport', 'metro', 'bus', 'taxi', 'driving', 'carrental', 'cycling', 'cablecar', 'fuel', 'chargingstation', 'parking'],
  see: ['sight', 'museum', 'artgallery', 'temple', 'castle', 'show'],
  seeNature: ['park', 'mountain', 'beach', 'waterfall', 'viewpoint', 'onsen', 'aquarium', 'zoo', 'diving'],
  eat: ['dining', 'fastfood'], eatLight: ['cafe', 'bar', 'dessert', 'bakery'],
  stay: ['lodging', 'hotel'], stayLodge: ['guesthouse', 'camping'],
  shop: ['shopping', 'conveniencestore', 'souvenir'], shopMarket: ['market'],
};
const SWATCH_OF = Object.fromEntries(Object.entries(SWATCH).flatMap(([k, v]) => v.map(n => [n, k])));
export const swatchClass = category => `sw-${SWATCH_OF[category] || 'misc'}`;

let CATS = null;
export async function loadCategories() {
  CATS = (await (await fetch('./data/categories.json')).json())[lang];
}
export const categoryName = c => (CATS && CATS[c]) || c;

// ── OKLCH 混色：照 UIColor+OKLCH.swift 的 OKLCh.mix 移植 ──
// 不用 CSS 的 color-mix(in oklch)：Chromium 把暖白 #fbf8f4（彩度 ≈0.006）當成無色相，色相整個留在
// 有色那一邊；App 的門檻是 1e-6，暖白有色相、走最短弧——住宿類的底色因此是偏粉的米色，不是藍。
const lin = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const gam = v => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
function hexToOklch(hex) {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const c = Math.hypot(A, B);
  return { l: L, c, h: c < 1e-6 ? 0 : Math.atan2(B, A) };
}
function oklchToCss({ l, c, h }) {
  const A = c * Math.cos(h), B = c * Math.sin(h);
  const L = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const M = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const S = (l - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const rgb = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S,
  ].map(v => Math.round(Math.min(1, Math.max(0, gam(v))) * 255));
  return `rgb(${rgb.join(',')})`;
}
function mix(a, w, b) {
  let h;
  if (a.c < 1e-6 && b.c < 1e-6) h = 0;
  else if (a.c < 1e-6) h = b.h;
  else if (b.c < 1e-6) h = a.h;
  else { let d = b.h - a.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; h = a.h + d * (1 - w); }
  return { l: a.l * w + b.l * (1 - w), c: a.c * w + b.c * (1 - w), h };
}
const RECIPES = {
  eat: [0.452, 0.086, 30], eatLight: [0.510, 0.076, 30], shop: [0.566, 0.079, 74], shopMarket: [0.624, 0.070, 74],
  see: [0.498, 0.058, 150], seeNature: [0.556, 0.051, 150], stay: [0.428, 0.074, 264], stayLodge: [0.486, 0.065, 264],
  move: [0.524, 0.062, 322], moveLocal: [0.582, 0.055, 322], misc: [0.545, 0.022, 65],
};
{
  const surface = hexToOklch('#fbf8f4'), border = hexToOklch('#dbd5cd');
  const css = Object.entries(RECIPES).map(([k, [l, c, h]]) => {
    const base = { l, c, h: h * Math.PI / 180 };
    return `.sw-${k}{--sw-base:${oklchToCss(base)};--sw-fill:${oklchToCss(mix(base, .16, surface))};` +
      `--sw-stroke:${oklchToCss(mix(base, .30, border))};--sw-chip-stroke:${oklchToCss(mix(base, .45, border))}}`;
  }).join('\n');
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
}

// Chromium 在中日文頁面會拿 PingFang 畫「–」「→」，變成全形；App（UIKit）用 SF 畫。包成 lang="en" 的 span 就會改用 SF。
export const fmt = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/[–→↔]/g, c => `<span class="lt${c === '–' ? '' : ' ar'}">${c}</span>`);
