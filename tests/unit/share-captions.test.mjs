import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITE_URL, shareTarget } from '../../share/captions.js';
import { S } from '../../share/strings.js';

const LANG_KEYS = Object.keys(S);

// 後端認的是 tripezgo.com 或 App Store 連結（App repo tools/share-reward/gas/src/core.js mentionsTripEZGo）。
const MENTION = /(^|[^a-z0-9.-])(www\.)?tripezgo\.com(?![a-z0-9-]|\.[a-z])/i;

test('every language has a few captions to choose from, each one different', () => {
  for (const k of LANG_KEYS) {
    assert.ok(S[k].captions.length >= 3, k);
    assert.equal(new Set(S[k].captions).size, S[k].captions.length, k);
  }
});

test('every caption carries the site link, so a post made from it passes the check', () => {
  for (const k of LANG_KEYS) for (const c of S[k].captions) assert.match(c, MENTION, c);
});

test('no caption asks for ratings or reviews (App Review Guidelines 3.2.2 / 5.6.3)', () => {
  for (const k of LANG_KEYS) for (const c of S[k].captions) assert.doesNotMatch(c, /評分|評價|評論|五星|rating|review|レビュー|評価/i, c);
});

test('X, Threads, Bluesky and Plurk open a composer with the caption already in it', () => {
  const text = '去京都 tripezgo.com';
  const enc = encodeURIComponent(text);
  assert.deepEqual(shareTarget('x', text), { url: 'https://x.com/intent/post?text=' + enc, copy: false });
  assert.deepEqual(shareTarget('threads', text), { url: 'https://www.threads.net/intent/post?text=' + enc, copy: false });
  assert.deepEqual(shareTarget('bluesky', text), { url: 'https://bsky.app/intent/compose?text=' + enc, copy: false });
  assert.deepEqual(shareTarget('plurk', text), { url: 'https://www.plurk.com/?qualifier=shares&status=' + enc, copy: false });
});

test('Facebook only takes a link, so the caption is copied for the visitor to paste', () => {
  assert.deepEqual(shareTarget('facebook', 'x'),
    { url: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SITE_URL), copy: true });
});

test('platforms without a web composer just copy the caption', () => {
  assert.deepEqual(shareTarget('copy', 'x'), { url: '', copy: true });
});
