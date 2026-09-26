/* 時間表的分欄：只有真的同時段的那幾則分欄，不是整串連在一起的都一樣窄（使用者要求 2026-09-26：
 * 「上面有三個行程三欄，下面的也會變三欄」）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laneLayout } from '../../trip/core.js';

const box = (top, ext) => ({ top, ext });
const cols = (bs) => bs.map((b) => [b.lane, b.lanes]);

test('不重疊的各自一欄', () => {
  const bs = [box(0, 10), box(20, 10)];
  laneLayout(bs);
  assert.deepEqual(cols(bs), [[0, 1], [0, 1]]);
});

test('長行程底下：三個同時的那一段三欄，只跟長行程重疊的那一段兩欄', () => {
  /* 迪士尼 08:30–21:00；11:00 兩則同時；12:30 午餐只跟迪士尼重疊 */
  const L = box(0, 750), a = box(150, 15), b = box(150, 90), c = box(240, 60);
  const bs = [L, a, b, c];
  laneLayout(bs);
  assert.deepEqual(cols([a, b]), [[1, 3], [2, 3]]);
  assert.deepEqual(cols([c]), [[1, 2]]);
});

test('每一對同時的行程在畫面上都不疊', () => {
  const bs = [box(0, 100), box(10, 20), box(10, 50), box(40, 50), box(45, 10), box(95, 30)];
  laneLayout(bs);
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i], q = bs[j];
      const sameTime = p.top < q.top + q.ext && q.top < p.top + p.ext;
      if (!sameTime) continue;
      const pl = p.lane / p.lanes, pr = (p.lane + 1) / p.lanes, ql = q.lane / q.lanes, qr = (q.lane + 1) / q.lanes;
      assert.ok(pr <= ql + 1e-9 || qr <= pl + 1e-9, 'box ' + i + ' 跟 ' + j + ' 在畫面上疊到了');
    }
  }
});
