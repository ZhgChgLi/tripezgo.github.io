/* 類型的圖示與色族——同 App 的 EventTypeLook（resolvedSwatch / resolvedShapes）。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { iconOf, swatchOf } from '../../trip/looks.js';
import { appRoot, generate, OUTPUT } from '../../tools/gen-icons.mjs';

const item = (o) => ({ type: null, icon: null, swatch: null, ...o });

test('內建類型沒挑過：照凍結 key 查圖示與色族', () => {
  assert.equal(iconOf(item({ type: 'dining' })), 'restaurant');
  assert.equal(swatchOf(item({ type: 'dining' })), 'eat');
  assert.equal(iconOf(item({ type: 'diving' })), 'swimming');
  assert.equal(swatchOf(item({ type: 'diving' })), 'seeNature');
  assert.equal(swatchOf(item({ type: 'guesthouse' })), 'stayLodge');
});

/* App 1.0.0 (185) 起類型是固定清單（ADR-0024）：類型決定圖示與顏色，公開版本不再帶 icon／swatch。
 * 舊版 App 發佈、還沒更新過的那幾份仍帶著這兩格——App 讀的時候視而不見，網頁也一樣。 */
test('舊公開版本上的 icon／swatch 不算數：只看類型 key', () => {
  assert.equal(iconOf(item({ type: 'dining', icon: 'swimming', swatch: 'stay' })), 'restaurant');
  assert.equal(swatchOf(item({ type: 'dining', icon: 'swimming', swatch: 'stay' })), 'eat');
});

test('清單外的名字（舊版的自訂類型）就算帶著 icon／swatch，也是通用圖釘＋雜項（同 App 的「其他」）', () => {
  assert.equal(iconOf(item({ type: '我的潛水', icon: 'swimming', swatch: 'seeNature' })), 'marker');
  assert.equal(swatchOf(item({ type: '我的潛水', icon: 'swimming', swatch: 'seeNature' })), 'misc');
  assert.equal(iconOf(item({ type: 'other' })), iconOf(item({ type: '宵夜攤' })));
  assert.equal(swatchOf(item({ type: 'other' })), swatchOf(item({ type: '宵夜攤' })));
});

test('沒有類型、或認不得的名字：通用圖釘＋雜項', () => {
  assert.equal(iconOf(item({ type: '餐廳' })), 'marker');
  assert.equal(swatchOf(item({ type: '餐廳' })), 'misc');
  assert.equal(iconOf(item({})), 'marker');
  assert.equal(swatchOf(item({})), 'misc');
});

test('trip/icons.js 跟 App 的原始碼一致（App repo 不在就略過）', (t) => {
  const app = appRoot();
  if (!existsSync(path.join(app, 'App/iOS/Modules/UI'))) {
    t.skip('找不到 App repo：' + app);
    return;
  }
  assert.equal(readFileSync(OUTPUT, 'utf8'), generate(app), '跑 node tools/gen-icons.mjs 重產');
});
