/* 旅程時區（使用者裁定 2026-10-05：公開連結要帶旅程時區，兩邊一致）。
 *
 * 時間欄照 App 的規則（App repo `UI/…/TripCalendar/PhoneClock.swift`、`TripCalendarViewModel.phoneClock`）：
 * 手機時區換成瀏覽器時區；只在那一天兩邊偏移不同時出現；整點下疊觀看者的時刻，跨午夜掛 +1／-1；
 * 夏令時間那一天照實際切換時刻分段；時間表上方一格說明。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { phonePlan, phoneReadingOn, phoneShifts, phoneReading, validateCopy, zoneName, zoneNote, zoneDifference } from '../../trip/core.js';
import { S } from '../../trip/strings.js';

const golden = JSON.parse(readFileSync(new URL('../fixtures/golden-v1.json', import.meta.url), 'utf8'));
const plain = (name) => golden.cases.find((c) => c.name === name).plaintext;
const day = (y, m, d) => ({ y, m, d });

/* ── 解析 ── */

test('明文的 trip.tz 讀進來；黃金檔 dated 是 Asia/Tokyo、undated 是 null', () => {
  assert.equal(validateCopy(plain('dated')).tz, 'Asia/Tokyo');
  assert.equal(validateCopy(plain('undated')).tz, null);
});

test('舊連結沒有 tz 這一格：照常讀，旅程時區當作沒有', () => {
  const old = structuredClone(plain('dated'));
  delete old.trip.tz;
  const copy = validateCopy(old);
  assert.ok(copy);
  assert.equal(copy.tz, null);
});

test('tz 是瀏覽器不認得的時區：只丟掉旅程時區，其他照讀（同 App）', () => {
  const odd = structuredClone(plain('dated'));
  odd.trip.tz = 'Mars/Olympus';
  const copy = validateCopy(odd);
  assert.ok(copy);
  assert.equal(copy.tz, null);
});

test('tz 不是字串：整份讀不懂（同 App 的 JSONDecoder）', () => {
  const odd = structuredClone(plain('dated'));
  odd.trip.tz = 9;
  assert.equal(validateCopy(odd), null);
});

/* ── 哪一天要畫、差多少 ── */

test('偏移相同就不畫：同一個時區、或識別碼不同但偏移相同（首爾之於東京）', () => {
  assert.equal(phoneShifts('Asia/Tokyo', 'Asia/Tokyo', day(2026, 7, 30)), null);
  assert.equal(phoneShifts('Asia/Tokyo', 'Asia/Seoul', day(2026, 7, 30)), null);
  assert.equal(phoneShifts(null, 'Asia/Taipei', day(2026, 7, 30)), null, '沒有旅程時區（舊連結）');
});

test('東京的旅程、台北的瀏覽器：一整天差 −60 分（瀏覽器減旅程）', () => {
  assert.deepEqual(phoneShifts('Asia/Tokyo', 'Asia/Taipei', day(2026, 7, 30)), [{ fromMinute: 0, deltaMinutes: -60 }]);
});

test('夏令時間那一天照實際切換時刻分段：紐約 11/1 撥回是印度的 11:30（不是整點）', () => {
  assert.deepEqual(phoneShifts('Asia/Kolkata', 'America/New_York', day(2026, 11, 1)), [
    { fromMinute: 0, deltaMinutes: -570 },
    { fromMinute: 690, deltaMinutes: -630 },
  ]);
});

test('00:00 兩邊相同、之後才分開（鳳凰城的旅程、丹佛的瀏覽器，2026-03-08 丹佛 02:00 撥快）', () => {
  assert.deepEqual(phoneShifts('America/Phoenix', 'America/Denver', day(2026, 3, 8)), [
    { fromMinute: 0, deltaMinutes: 0 },
    { fromMinute: 120, deltaMinutes: 60 },
  ]);
});

/* ── 副時刻 ── */

test('整點下的那一行：跨過午夜掛 -1／+1，半小時照寫，手機剛好走到午夜是隔天 00:00', () => {
  const tokyo = phoneShifts('Asia/Tokyo', 'Asia/Taipei', day(2026, 7, 30));
  assert.deepEqual(phoneReading(tokyo, 0), { clock: '23:00', dayShift: -1 });
  assert.deepEqual(phoneReading(tokyo, 600), { clock: '09:00', dayShift: 0 });
  const india = phoneShifts('Asia/Kolkata', 'Asia/Taipei', day(2026, 7, 30));
  assert.deepEqual(phoneReading(india, 22 * 60), { clock: '00:30', dayShift: 1 });
  assert.deepEqual(phoneReading(india, 9 * 60), { clock: '11:30', dayShift: 0 });
  const dubai = phoneShifts('Asia/Dubai', 'Asia/Taipei', day(2026, 7, 30));
  assert.deepEqual(phoneReading(dubai, 20 * 60), { clock: '00:00', dayShift: 1 });
  const nepal = phoneShifts('Asia/Kathmandu', 'Asia/Taipei', day(2026, 7, 30));
  assert.deepEqual(phoneReading(nepal, 10 * 60), { clock: '12:15', dayShift: 0 });
});

test('切換那一天：切換之前與之後各用各的時差', () => {
  const ny = phoneShifts('Asia/Kolkata', 'America/New_York', day(2026, 11, 1));
  assert.deepEqual(phoneReading(ny, 11 * 60), { clock: '01:30', dayShift: 0 });
  assert.deepEqual(phoneReading(ny, 12 * 60), { clock: '01:30', dayShift: 0 });
  assert.deepEqual(phoneReading(ny, 13 * 60), { clock: '02:30', dayShift: 0 });
});

/* ── 時區名與說明（同 App 的 PrimaryTimeZone.name 與 ui.calendar.zone.*） ── */

test('時區名：系統的短名字；短名字是縮寫（JST、ET）就退回完整的名字', () => {
  assert.equal(zoneName('Asia/Tokyo', 'zh'), '日本時間');
  assert.equal(zoneName('Asia/Tokyo', 'en'), 'Japan Time');
  assert.equal(zoneName('Asia/Tokyo', 'ja'), '日本標準時');
  assert.equal(zoneName('America/New_York', 'zh'), '東部時間');
});

test('時差：旅程減瀏覽器、負號 U+2212；是 0 的那一半不寫', () => {
  const diff = (trip, viewer, lang, d = day(2026, 7, 30)) => zoneDifference(phoneShifts(trip, viewer, d), S[lang]);
  assert.equal(diff('Asia/Tokyo', 'Asia/Taipei', 'zh'), '+1 小時');
  assert.equal(diff('Asia/Taipei', 'Asia/Tokyo', 'zh'), '−1 小時');
  assert.equal(diff('Asia/Kathmandu', 'Asia/Taipei', 'zh'), '−2 小時 15 分');
  assert.equal(diff('Asia/Kolkata', 'Asia/Dhaka', 'zh'), '−30 分');
  assert.equal(diff('Asia/Kolkata', 'America/New_York', 'en', day(2026, 11, 1)), '+9 h 30 min');
  assert.equal(diff('Asia/Kathmandu', 'Asia/Taipei', 'ja'), '−2時間15分');
  assert.equal(diff('America/Phoenix', 'America/Denver', 'zh', day(2026, 3, 8)), '−1 小時', '讀第一段不為 0 的');
});

test('說明一句，三語', () => {
  const shifts = phoneShifts('Asia/Tokyo', 'Asia/Taipei', day(2026, 7, 30));
  assert.equal(zoneNote('Asia/Tokyo', shifts, 'zh', S.zh), '目前為日本時間，與裝置時間差 +1 小時');
  assert.equal(zoneNote('Asia/Tokyo', shifts, 'en', S.en), 'Times are in Japan Time, +1 h from your device’s time');
  assert.equal(zoneNote('Asia/Tokyo', shifts, 'ja', S.ja), '現在は日本標準時で表示しています。端末の時刻との差は +1時間');
});

/* ── 時差會變的旅程（review F1：時間欄是幾天共用的，跨夏令時間就畫錯） ──
 * 紐約的旅程、2026-10-31 起三天、台北的瀏覽器：第 1 天差 −12、第 2 天 02:00 撥回之後與第 3 天差 −13。 */

const nyDays = [day(2026, 10, 31), day(2026, 11, 1), day(2026, 11, 2), day(2026, 11, 3)]
  .map((d) => phoneShifts('America/New_York', 'Asia/Taipei', d));
const tokyoDays = [day(2026, 7, 30), day(2026, 7, 31), day(2026, 8, 1), day(2026, 8, 2)]
  .map((d) => phoneShifts('Asia/Tokyo', 'Asia/Taipei', d));

test('每一天、每一刻時差都一樣：共用時間欄（照舊）', () => {
  assert.deepEqual(phonePlan(tokyoDays, true), { shared: tokyoDays[0], perDay: false });
  assert.deepEqual(phonePlan([null, null, null, null], true), { shared: null, perDay: false });
});

test('有一天跨夏令時間：每一天自己畫', () => {
  assert.equal(phonePlan(nyDays, false).perDay, true);
  assert.equal(phonePlan(nyDays, false).shared, null);
});

test('旅程裡每天一樣、但時間表畫過午夜而隔天切換：也要每一天自己畫（最後一天的 24:00 之後是隔天）', () => {
  const before = [day(2026, 10, 29), day(2026, 10, 30), day(2026, 10, 31), day(2026, 11, 1)]
    .map((d) => phoneShifts('America/New_York', 'Asia/Taipei', d));
  assert.equal(phonePlan(before, false).perDay, false, '時間表沒畫過午夜：不看隔天');
  assert.equal(phonePlan(before, true).perDay, true);
});

test('有幾天偏移相同（null）、有幾天不同：每一天自己畫', () => {
  assert.equal(phonePlan([null, tokyoDays[0], tokyoDays[0]], false).perDay, true);
});

test('過了午夜的刻度讀隔天的時差：第 1 天 26:00 是 11/1 02:00（已撥回），台北 15:00 隔天', () => {
  assert.deepEqual(phoneReadingOn(nyDays[0], nyDays[1], 9 * 60), { clock: '21:00', dayShift: 0 });
  assert.deepEqual(phoneReadingOn(nyDays[0], nyDays[1], 24 * 60), { clock: '12:00', dayShift: 1 });
  assert.deepEqual(phoneReadingOn(nyDays[0], nyDays[1], 26 * 60), { clock: '15:00', dayShift: 1 });
  assert.deepEqual(phoneReadingOn(nyDays[2], nyDays[3], 9 * 60), { clock: '22:00', dayShift: 0 });
  assert.deepEqual(phoneReadingOn(null, null, 9 * 60), { clock: '09:00', dayShift: 0 }, '那一天偏移相同：照寫旅程時刻');
});

test('時差會變的說明：第一段不為 0 的時差，再加「部分日子不同」，三語', () => {
  const shifts = nyDays[0];
  assert.equal(zoneNote('America/New_York', shifts, 'zh', S.zh, Date.UTC(2026, 9, 31), true),
    '目前為東部時間，與裝置時間差 −12 小時（部分日子不同，以每一天欄內左側的裝置時刻為準）');
  assert.equal(zoneNote('America/New_York', shifts, 'en', S.en, Date.UTC(2026, 9, 31), true),
    'Times are in Eastern Time, −12 h from your device’s time (varies on some days — each day shows its own device time on its left)');
  assert.equal(zoneNote('America/New_York', shifts, 'ja', S.ja, Date.UTC(2026, 9, 31), true),
    '現在はニューヨーク時間で表示しています。端末の時刻との差は −12時間（日によって異なります。各日の左側の端末の時刻を参照）');
});
