import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S, langKey } from '../../share/strings.js';

const shape = (v) => (Array.isArray(v) ? `array:${v.length}` : typeof v === 'object' ? 'object' : typeof v);

test('English and Japanese have every key Chinese has, of the same shape, and nothing extra', () => {
  for (const lang of ['en', 'ja']) {
    assert.deepEqual(Object.keys(S[lang]).sort(), Object.keys(S.zh).sort(), lang);
    assert.deepEqual(Object.keys(S[lang].reasons).sort(), Object.keys(S.zh.reasons).sort(), lang + ' reasons');
    for (const key of Object.keys(S.zh)) {
      if (key === 'captions') continue; // 文案各語言可以不一樣多
      assert.equal(shape(S[lang][key]), shape(S.zh[key]), `${lang}.${key}`);
    }
  }
});

test('no string is left empty', () => {
  for (const [lang, dict] of Object.entries(S)) {
    const all = Object.values(dict).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)));
    for (const s of all) assert.ok(String(s).trim(), lang);
  }
});

test('placeholders survive translation', () => {
  for (const lang of Object.keys(S)) {
    assert.match(S[lang].remaining, /\{n\}/, lang);
    assert.match(S[lang].deadline, /\{d\}/, lang);
  }
});

test('the page language picks the dictionary, and anything unknown falls back to Chinese', () => {
  assert.equal(langKey('zh-Hant'), 'zh');
  assert.equal(langKey('en'), 'en');
  assert.equal(langKey('ja'), 'ja');
  assert.equal(langKey('fr'), 'zh');
});

test('the six App Store offer-code disclosures are there in every language (Schedule 2 §3.13(d))', () => {
  for (const lang of Object.keys(S)) {
    assert.equal(S[lang].fine.length, 6, lang);
    assert.match(S[lang].fine[4], /apple\.com\/legal\/internet-services\/itunes/, lang);
  }
});
