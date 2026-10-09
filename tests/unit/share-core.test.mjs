import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestBody, viewFor, fitWithin } from '../../share/core.js';

test('a status request carries the op and the ID token as JSON', () => {
  assert.deepEqual(JSON.parse(requestBody('status', 'tok')), { op: 'status', idToken: 'tok' });
});

test('a submit request carries the image, the consent and the language', () => {
  assert.deepEqual(JSON.parse(requestBody('submit', 'tok', { image: 'AAA', consent: true, lang: 'ja' })),
    { op: 'submit', idToken: 'tok', image: 'AAA', consent: true, lang: 'ja' });
});

test('a ready answer shows the upload view with the attempts left', () => {
  assert.deepEqual(viewFor({ state: 'ready', remaining: 3, deadline: '2026-12-31' }),
    { view: 'ready', remaining: 3, deadline: '2026-12-31' });
});

test('an issued answer shows the code and the redeem link', () => {
  const v = viewFor({ state: 'issued', code: 'ABC', redeemUrl: 'https://apps.apple.com/redeem?code=ABC', deadline: '2026-12-31' });
  assert.equal(v.view, 'issued');
  assert.equal(v.code, 'ABC');
  assert.equal(v.redeemUrl, 'https://apps.apple.com/redeem?code=ABC');
});

test('a rejection keeps the reason and the attempts left', () => {
  assert.deepEqual(viewFor({ state: 'rejected', reason: 'no-tripezgo', remaining: 2 }),
    { view: 'rejected', reason: 'no-tripezgo', remaining: 2 });
});

test('waiting for a human, denied and closed each have their own view', () => {
  assert.equal(viewFor({ state: 'pending-review' }).view, 'pending-review');
  assert.equal(viewFor({ state: 'denied' }).view, 'denied');
  assert.equal(viewFor({ state: 'closed' }).view, 'closed');
});

test('when the AI did not answer, the visitor stays on upload with a notice and nothing spent', () => {
  assert.deepEqual(viewFor({ state: 'ready', remaining: 3, error: 'judge-unavailable' }),
    { view: 'ready', remaining: 3, notice: 'judge-unavailable' });
});

test('a rejected ID token sends the visitor back to sign in', () => {
  assert.deepEqual(viewFor({ error: 'auth' }), { view: 'signed-out' });
});

test('anything the page does not understand is an error, not a blank page', () => {
  assert.deepEqual(viewFor({ error: 'bad-request' }), { view: 'error' });
  assert.deepEqual(viewFor({ error: 'image' }), { view: 'error' });
  assert.deepEqual(viewFor(null), { view: 'error' });
  assert.deepEqual(viewFor({ state: 'from-the-future' }), { view: 'error' });
});

test('a large screenshot is scaled so its long side is at most the limit, keeping the aspect ratio', () => {
  assert.deepEqual(fitWithin(1170, 2532, 2048), { width: 946, height: 2048 });
  assert.deepEqual(fitWithin(3000, 2000, 2048), { width: 2048, height: 1365 });
});

test('a small screenshot is left alone', () => {
  assert.deepEqual(fitWithin(750, 1334, 2048), { width: 750, height: 1334 });
});
