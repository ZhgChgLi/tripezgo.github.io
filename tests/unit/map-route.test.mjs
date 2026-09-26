/* 地圖 tab 的點、線、清單，照 App 的規則（MapViewModel：route、placeless、firstPlacedEvent；使用者要求 2026-09-26）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapDayOf } from '../../trip/core.js';

const at = (h, m = 0) => h * 60 + m;
const timed = (title, s, geo, leg = null) => ({ item: { title, geo, leg, to: null }, s, e: s + 30 });
const day = (n, list, allDay = []) => ({ n, timed: list, allDay });

test('點：當天有座標的定時行程依開始時間編號；全日的只在它第一天上圖、不編號', () => {
  const hotel = { title: '飯店', geo: [1, 1], to: 3, day: 1, leg: null };
  const d1 = mapDayOf(day(1, [timed('A', at(9), [0, 0]), timed('沒地點', at(10), null), timed('B', at(11), [0, 1])], [hotel]));
  assert.deepEqual(d1.pins.map((p) => [p.item.title, p.no]), [['A', 1], ['B', 2], ['飯店', null]]);
  const d2 = mapDayOf(day(2, [], [hotel]));
  assert.deepEqual(d2.pins, []);
});

test('線：相鄰兩個有地點的行程連起來；中間一則沒地點就斷開', () => {
  const d = mapDayOf(day(1, [
    timed('A', at(9), [0, 0]),
    timed('B', at(10), [0, 1], { mode: 'walking', min: 12 }),
    timed('沒地點', at(11), null),
    timed('C', at(12), [0, 2], { mode: 'transit', min: 30 }),
    timed('D', at(13), [0, 3]),
  ]));
  assert.deepEqual(d.lines.map((l) => [l.from.item.title, l.to.item.title]), [['A', 'B'], ['C', 'D']]);
});

test('線上的路程是「進下一個點」那一段；有交通方式是實線帶路程，沒有或空檔是虛線不標', () => {
  const d = mapDayOf(day(1, [
    timed('A', at(9), [0, 0]),
    timed('B', at(10), [0, 1], { mode: 'walking', min: 12 }),
    timed('C', at(11), [0, 2], { mode: 'idle', min: 0 }),
    timed('D', at(12), [0, 3], { mode: null, min: 0 }),
  ]));
  assert.deepEqual(d.lines.map((l) => [l.to.item.title, l.solid, l.leg && l.leg.mode]), [
    ['B', true, 'walking'],
    ['C', false, null],
    ['D', false, null],
  ]);
});

test('鏡頭：當天第一個點（依時間）；沒有定時的點就用全日的；都沒有就不給', () => {
  const hotel = { title: '飯店', geo: [5, 5], to: 1, day: 1, leg: null };
  assert.deepEqual(mapDayOf(day(1, [timed('沒地點', at(8), null), timed('A', at(9), [3, 4])], [hotel])).focus, [3, 4]);
  assert.deepEqual(mapDayOf(day(1, [], [hotel])).focus, [5, 5]);
  assert.equal(mapDayOf(day(1, [timed('沒地點', at(8), null)])).focus, null);
});

test('底部清單：只列沒座標的——當天的定時行程，加上從這一天開始的全日行程', () => {
  const car = { title: '租車', geo: null, to: 3, day: 1, leg: null };
  const d1 = mapDayOf(day(1, [timed('航班', at(11), null), timed('A', at(16), [0, 0])], [car]));
  assert.deepEqual(d1.placeless.map((p) => p.item.title), ['租車', '航班']);
  const d2 = mapDayOf(day(2, [timed('B', at(9), [0, 0])], [car]));
  assert.deepEqual(d2.placeless, []);
});
