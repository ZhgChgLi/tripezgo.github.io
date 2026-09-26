/* 公開連結頁的純函式——瀏覽器（trip/app.js）、node 測試與每日清理（tools/cleanup/）共用這一份。
 *
 * 這裡沒有 DOM、沒有網路。跨語言的格式契約是 App repo 產生的黃金檔
 * （`docs/public-link/golden-v1.json`，本 repo 的副本在 `tests/fixtures/`）：
 * 解密、驗章、純文字三件事都拿它逐字對。
 *
 * 格式來源（App repo）：
 *   - record：`TripEZGoData/PublicLink/PublishedCopyEnvelope.swift`
 *   - 明文 JSON：`TripEZGoData/PublicLink/PublishedCopyDTO.swift`
 *   - 網址：`Domain/Model/PublicLink.swift`、`Domain/Model/Base64URL.swift`
 *   - 純文字：`Domain/UseCase/TripItineraryTextUseCase.swift`、`TripShare.swift`
 */

export const FORMAT_VERSION = 1;
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
export const KEY_BYTES = 32;
export const MINUTES_PER_DAY = 1440;

const subtle = () => globalThis.crypto.subtle;
const utf8 = new TextEncoder();

/* ═══ base64 ═════════════════════════════════════════════════════ */

export function base64Decode(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4) return null;
  try {
    const raw = atob(text);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  } catch (err) {
    return null;
  }
}

export function base64Encode(bytes) {
  let raw = '';
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  return btoa(raw);
}

export function base64UrlEncode(bytes) {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 同 App 的 `Base64URL.strictDecode`：解得開、而且重新編回去一字不差才算——拒絕非正規寫法。 */
export function base64UrlDecodeStrict(text) {
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  let padded = text.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  const bytes = base64Decode(padded);
  if (!bytes || base64UrlEncode(bytes) !== text) return null;
  return bytes;
}

/* ═══ 網址 ═══════════════════════════════════════════════════════ */

/** `#<32 碼小寫 hex>.<base64url 金鑰>` → `{ id, key }`；任何一格不對就是 `null`（網址殘缺）。
 *  同 App 的 `PublicLink(url:)`：id 先轉小寫再檢查，金鑰要剛好 32 bytes 且是正規的 base64url。 */
export function parseFragment(hash) {
  const fragment = String(hash || '').replace(/^#/, '');
  const parts = fragment.split('.');
  if (parts.length !== 2) return null;
  const id = parts[0].toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const key = base64UrlDecodeStrict(parts[1]);
  if (!key || key.length !== KEY_BYTES) return null;
  return { id, key };
}

export function linkURL(host, id, key) {
  return 'https://' + host + '/trip/#' + id + '.' + base64UrlEncode(key);
}

/* ═══ record ═════════════════════════════════════════════════════ */

/** CloudKit Web Services 回的那一筆（`fields.x.value`，Bytes 是 base64）→ 三格原始值。
 *  回傳 `{ formatVersion, payload, signature }`，缺的那一格是 `null`。 */
export function sealedFromRecord(record) {
  const fields = (record && record.fields) || {};
  const value = (name) => (fields[name] && 'value' in fields[name] ? fields[name].value : null);
  const version = value('formatVersion');
  const payload = value('payload');
  const signature = value('signature');
  return {
    formatVersion: typeof version === 'number' ? version : null,
    payload: typeof payload === 'string' ? base64Decode(payload) : null,
    signature: typeof signature === 'string' ? base64Decode(signature) : null,
  };
}

export class OpenFailure extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind; /* 'unknownFormat' | 'cannotDecrypt' | 'malformed' —— 同 App 的 PublishedCopyEnvelope.Failure */
  }
}

/** 解開——同 App 的 `PublishedCopyEnvelope.open`。**不驗簽章**：那是清理工具的事。 */
export async function openSealed(sealed, key) {
  if (sealed.formatVersion !== FORMAT_VERSION) throw new OpenFailure('unknownFormat');
  const payload = sealed.payload;
  if (!payload || payload.length < NONCE_BYTES + TAG_BYTES) throw new OpenFailure('cannotDecrypt');
  let plain;
  try {
    const aes = await subtle().importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
    plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: payload.slice(0, NONCE_BYTES), tagLength: TAG_BYTES * 8 },
      aes,
      payload.slice(NONCE_BYTES)
    );
  } catch (err) {
    throw new OpenFailure('cannotDecrypt');
  }
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(plain));
  } catch (err) {
    throw new OpenFailure('malformed');
  }
  const copy = validateCopy(json);
  if (!copy) throw new OpenFailure('malformed');
  return copy;
}

/** HMAC-SHA256(key, UTF-8(recordName) ‖ SHA-256(payload))，換鑰期間任一把驗得過就算。 */
export async function isSigned(sealed, recordName, signingKeys) {
  if (!sealed.payload || !sealed.signature) return false;
  const digest = new Uint8Array(await subtle().digest('SHA-256', sealed.payload));
  const name = utf8.encode(recordName);
  const message = new Uint8Array(name.length + digest.length);
  message.set(name, 0);
  message.set(digest, name.length);
  for (const raw of signingKeys) {
    const key = await subtle().importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (await subtle().verify('HMAC', key, sealed.signature, message)) return true;
  }
  return false;
}

/* ═══ 明文 ═══════════════════════════════════════════════════════
 * 同 App 的 `PublishedCopyDTO.modelValue`：版本不認得、任何一格讀不懂就整份不收。 */

const isInt = (n) => typeof n === 'number' && Number.isInteger(n);
const isStringOrNull = (s) => s === null || s === undefined || typeof s === 'string';
const has = (o, k) => o[k] !== undefined && o[k] !== null;

export function validateCopy(json) {
  if (!json || typeof json !== 'object' || json.v !== FORMAT_VERSION) return null;
  if (typeof json.at !== 'string' || isNaN(Date.parse(json.at))) return null;
  const trip = json.trip;
  if (!trip || typeof trip.name !== 'string' || !isInt(trip.days) || trip.days < 1) return null;
  if (!isStringOrNull(trip.place) || !isStringOrNull(trip.cover)) return null;
  let start = null;
  if (has(trip, 'start')) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trip.start);
    if (!m) return null;
    start = { y: +m[1], m: +m[2], d: +m[3] };
  }
  if (!Array.isArray(json.items)) return null;
  const items = [];
  for (const row of json.items) {
    if (!row || typeof row.title !== 'string' || !isInt(row.day)) return null;
    const timed = has(row, 's') || has(row, 'e');
    if (timed) {
      if (!isInt(row.s) || !isInt(row.e) || has(row, 'to')) return null;
    } else if (!isInt(row.to)) {
      return null;
    }
    let geo = null;
    if (has(row, 'geo')) {
      if (!Array.isArray(row.geo) || row.geo.length !== 2 || !row.geo.every((n) => typeof n === 'number')) return null;
      geo = row.geo.slice();
    }
    for (const k of ['place', 'type', 'icon', 'swatch']) if (!isStringOrNull(row[k])) return null;
    if (typeof row.color !== 'string') return null;
    let leg = null;
    if (has(row, 'leg')) {
      if (!isInt(row.leg.min) || !isStringOrNull(row.leg.mode)) return null;
      leg = { mode: row.leg.mode || null, min: row.leg.min };
    }
    items.push({
      title: row.title,
      day: row.day,
      s: timed ? row.s : null,
      e: timed ? row.e : null,
      to: timed ? null : row.to,
      place: row.place || null,
      geo,
      type: row.type || null,
      icon: row.icon || null,
      swatch: row.swatch || null,
      color: row.color,
      leg,
    });
  }
  return {
    at: json.at,
    name: trip.name,
    place: trip.place || null,
    start,
    days: trip.days,
    cover: trip.cover || null,
    items,
  };
}

/* ═══ 日子 ═══════════════════════════════════════════════════════ */

/** 同 App 的 `EventWhen.dayOffset(of:isEnd:)`。 */
export function dayOffset(minute, isEnd) {
  return Math.floor((isEnd ? minute - 1 : minute) / MINUTES_PER_DAY);
}

/** 第 n 天的日曆日 `{y, m, d}`；日期未定是 `null`。 */
export function dateOfDay(copy, n) {
  if (!copy.start) return null;
  const t = new Date(Date.UTC(copy.start.y, copy.start.m - 1, copy.start.d + (n - 1)));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
}

/** 逐日分好的那一份——同 App 的 `TripShare.events(onDay:)`：
 *  全日在前（橫跨的每一天都列），定時的照「畫在哪一天」分桶（兩頭夾進 1…天數），
 *  分鐘換成相對那一天，再照開始時刻排。 */
export function daysOf(copy) {
  const out = [];
  for (let n = 1; n <= copy.days; n++) {
    const allDay = copy.items.filter((it) => it.to !== null && it.day <= n && n <= it.to);
    const timed = copy.items
      .filter((it) => it.to === null)
      .map((it) => {
        const drawn = it.day + dayOffset(it.s, false);
        if (Math.min(Math.max(drawn, 1), copy.days) !== n) return null;
        const shift = n - it.day;
        return { item: it, s: it.s - shift * MINUTES_PER_DAY, e: it.e - shift * MINUTES_PER_DAY };
      })
      .filter(Boolean)
      .sort((a, b) => a.s - b.s);
    out.push({ n, date: dateOfDay(copy, n), allDay, timed });
  }
  return out;
}

/* ═══ 時間表的分欄 ═══════════════════════════════════════════
 * boxes：依開始排好、各有 top 與 ext（畫出來佔的高度）。寫回 lane（第幾欄）與 lanes（這一則分幾欄）。
 *
 * **只有真的同時段的那幾則分欄**（使用者要求 2026-09-26）。先前一整串連在一起的行程共用一個欄數：
 * 一則跨一整天的（迪士尼 08:30–21:00）把當天每一則都串在一起，上午某一刻三則同時，下午只跟它
 * 重疊的午餐也被切成三欄。現在每一則的欄數只看跟它時間重疊的那幾則（1 + 它們最大的欄號）。
 * 這樣算萬一讓兩則同時的在畫面上疊到（很少見的交錯），那一串退回整串同一個欄數——寧可窄，不可疊。 */
export function laneLayout(boxes) {
  const sameTime = (p, q) => p.top < q.top + q.ext && q.top < p.top + p.ext;
  for (let gi = 0; gi < boxes.length;) {
    let gEnd = boxes[gi].top + boxes[gi].ext, gj = gi + 1;
    while (gj < boxes.length && boxes[gj].top < gEnd) { gEnd = Math.max(gEnd, boxes[gj].top + boxes[gj].ext); gj++; }
    const group = boxes.slice(gi, gj), ends = [];
    group.forEach((bx) => {
      for (let ln = 0; ; ln++) { if (ends[ln] === undefined || ends[ln] <= bx.top) { ends[ln] = bx.top + bx.ext; bx.lane = ln; break; } }
    });
    group.forEach((bx) => {
      bx.lanes = 1 + Math.max(...group.filter((o) => o === bx || sameTime(o, bx)).map((o) => o.lane));
    });
    const clash = group.some((p, i) => group.slice(i + 1).some((q) => sameTime(p, q)
      && (p.lane + 1) / p.lanes > q.lane / q.lanes + 1e-9 && (q.lane + 1) / q.lanes > p.lane / p.lanes + 1e-9));
    if (clash) group.forEach((bx) => { bx.lanes = ends.length; });
    gi = gj;
  }
  return boxes;
}

/* ═══ 地圖 tab 的一天（照 App 的 MapViewModel；使用者要求 2026-09-26） ═══════
 * - 點：當天有座標的定時行程依開始時間編號（App 的站號）；全日的只在它第一天上圖、不編號。
 * - 線：相鄰兩個有地點的定時行程連起來；中間一則沒地點就斷開（App 的 `split`）。
 *   線上的路程是「進下一個點」那一段（`legTo`）；有交通方式是實線帶路程，
 *   沒有或是空檔（idle）就是虛線、不標（`isJourney`、`isSolidLine`）。
 * - 鏡頭：當天第一個點（`firstEventPlace(ofDay:)`：先看定時的，再看全日的）。
 * - 底部清單：只列沒座標的（`placeless(onDay:)`：全日的算在它開始那一天）。 */
export function mapDayOf(day) {
  const startsHere = (it) => Math.max(1, it.day) === day.n;
  const journey = (leg) => (leg && leg.mode && leg.mode !== 'idle' ? leg : null);
  let no = 0;
  const pins = day.timed.filter((x) => x.item.geo).map((x) => ({ x, item: x.item, no: ++no }))
    .concat(day.allDay.filter((it) => it.geo && startsHere(it)).map((it) => ({ x: null, item: it, no: null })));
  const lines = [];
  let prev = null;
  day.timed.forEach((x) => {
    if (!x.item.geo) { prev = null; return; }
    if (prev) {
      const leg = journey(x.item.leg);
      lines.push({ from: prev, to: x, leg, solid: !!leg });
    }
    prev = x;
  });
  const first = day.timed.find((x) => x.item.geo);
  const firstAllDay = day.allDay.find((it) => it.geo && startsHere(it));
  const focus = first ? first.item.geo : firstAllDay ? firstAllDay.geo : null;
  const placeless = day.allDay.filter((it) => !it.geo && startsHere(it)).map((it) => ({ x: null, item: it }))
    .concat(day.timed.filter((x) => !x.item.geo).map((x) => ({ x, item: x.item })));
  return { pins, lines, focus, placeless };
}

/* ═══ 純文字（TripItineraryTextUseCase，逐字） ═══════════════════ */

/** App 的字串目錄 `Domain/Resources/Localizable.xcstrings` 的三欄（zh-Hant-TW／en／ja）。 */
export const ITINERARY = {
  zh: {
    dayCount: (n) => n + ' 天',
    undated: (days) => '日期未定 · ' + days,
    dayLabel: (n) => '第 ' + n + ' 天',
    allDay: '全日',
    emptyDay: '（尚無安排）',
    signature: '使用 https://tripezgo.com 安排的旅程。',
    next: '隔天',
    previous: '前一天',
    after: (n) => n + ' 天後',
    before: (n) => n + ' 天前',
  },
  en: {
    dayCount: (n) => n + (n === 1 ? ' day' : ' days'),
    undated: (days) => 'Dates undecided · ' + days,
    dayLabel: (n) => 'Day ' + n,
    allDay: 'All-day',
    emptyDay: '(nothing planned)',
    signature: 'Planned with https://tripezgo.com',
    next: 'next day',
    previous: 'previous day',
    after: (n) => n + (n === 1 ? ' day later' : ' days later'),
    before: (n) => n + (n === 1 ? ' day earlier' : ' days earlier'),
  },
  ja: {
    dayCount: (n) => n + ' 日',
    undated: (days) => '日付未定 · ' + days,
    dayLabel: (n) => n + ' 日目',
    allDay: '終日',
    emptyDay: '（予定なし）',
    signature: 'https://tripezgo.com で組んだ旅程です。',
    next: '翌日',
    previous: '前日',
    after: (n) => n + ' 日後',
    before: (n) => n + ' 日前',
  },
};

/** 同 App 的 `DisplayTimeZone.dayOffsetWord`。 */
export function dayOffsetWord(offset, lang) {
  const t = ITINERARY[lang];
  if (offset === 0) return null;
  if (offset === 1) return t.next;
  if (offset === -1) return t.previous;
  return offset > 1 ? t.after(offset) : t.before(-offset);
}

/** 「09:00」；一天的最後一刻（整天的倍數，0 除外）寫 `24:00`。 */
export function clock(minute) {
  if (minute !== 0 && minute % MINUTES_PER_DAY === 0) return '24:00';
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60);
  const i = m % 60;
  return (h < 10 ? '0' : '') + h + ':' + (i < 10 ? '0' : '') + i;
}

/** 「09:00 – 11:00」／「隔天 06:00 – 14:00」／「23:00 – 隔天 07:00」——兩端都相對這一行所屬的那一天。 */
export function timeRange(start, end, lang) {
  const so = dayOffset(start, false);
  const eo = dayOffset(end, end > start);
  const sw = dayOffsetWord(so, lang);
  const ew = dayOffsetWord(eo, lang);
  const from = clock(start - so * MINUTES_PER_DAY);
  const to = clock(end - eo * MINUTES_PER_DAY);
  if (sw === ew) return sw ? sw + ' ' + from + ' – ' + to : from + ' – ' + to;
  const pre = (w, t) => (w ? w + ' ' + t : t);
  return pre(sw, from) + ' – ' + pre(ew, to);
}

/** 「7/30」——App 用 `Md` template，這三種語言都是 M/d。 */
export function monthDay(date) {
  return date.m + '/' + date.d;
}

export function plainText(copy, lang) {
  const t = ITINERARY[lang];
  const days = daysOf(copy);
  const count = t.dayCount(copy.days);
  const lines = [copy.name];
  if (copy.start) {
    const from = monthDay(days[0].date);
    const to = monthDay(days[days.length - 1].date);
    lines.push((from === to ? from : from + ' – ' + to) + ' · ' + count);
  } else {
    lines.push(t.undated(count));
  }
  for (const day of days) {
    lines.push('');
    lines.push(t.dayLabel(day.n) + (day.date ? ' · ' + monthDay(day.date) : ''));
    const rows = day.allDay
      .map((it) => t.allDay + '　' + it.title)
      .concat(day.timed.map((x) => timeRange(x.s, x.e, lang) + '　' + x.item.title));
    lines.push(...(rows.length ? rows : [t.emptyDay]));
  }
  /* 待排行程：公開版本不帶沒有日子的行程（PublishedCopyUseCase），所以沒有那一段。 */
  lines.push('');
  lines.push(t.signature);
  return lines.join('\n');
}
