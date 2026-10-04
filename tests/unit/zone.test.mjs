/* 旅程時區（使用者裁定 2026-10-05：公開連結要帶旅程時區，兩邊一致）。
 *
 * 時間欄照 App 的規則（App repo `UI/…/TripCalendar/PhoneClock.swift`、`TripCalendarViewModel.phoneClock`）：
 * 手機時區換成瀏覽器時區；只在那一天兩邊偏移不同時出現；整點下疊觀看者的時刻，跨午夜掛 +1／-1；
 * 夏令時間那一天照實際切換時刻分段；時間表上方一格說明。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { phoneShifts, phoneReading, validateCopy, zoneName, zoneNote, zoneDifference } from '../../trip/core.js';
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
