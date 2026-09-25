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

test('挑過圖示：色族跟著圖示那一族', () => {
  assert.equal(iconOf(item({ type: '我的潛水', icon: 'swimming' })), 'swimming');
  assert.equal(swatchOf(item({ type: '我的潛水', icon: 'swimming' })), 'seeNature');
});

test('挑過色族：用挑的，不管圖示', () => {
  assert.equal(swatchOf(item({ type: 'dining', icon: 'swimming', swatch: 'stay' })), 'stay');
});

test('認不得的色族 key、認不得的圖示、自訂類型：退回圖示那一族／通用圖釘／雜項', () => {
  assert.equal(swatchOf(item({ icon: 'swimming', swatch: 'sea' })), 'seeNature');
  assert.equal(iconOf(item({ icon: 'no-such-icon' })), 'marker');
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
