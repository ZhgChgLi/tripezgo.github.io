import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestBody, viewFor, fitWithin } from '../../share/core.js';

const EMAIL = 'someone@gmail.com';

test('a status request carries the op and the ID token as JSON', () => {
  assert.deepEqual(JSON.parse(requestBody('status', 'tok')), { op: 'status', idToken: 'tok' });
});

test('a submit request carries the image, the consent and the language', () => {
  assert.deepEqual(JSON.parse(requestBody('submit', 'tok', { image: 'AAA', consent: true, lang: 'ja' })),
    { op: 'submit', idToken: 'tok', image: 'AAA', consent: true, lang: 'ja' });
});

test('every signed-in view carries the Gmail account taking part', () => {
  for (const state of ['ready', 'rejected', 'pending-review', 'issued', 'denied', 'closed']) {
    assert.equal(viewFor({ email: EMAIL, state }).email, EMAIL, state);
  }
});

test('a ready answer shows the upload view with the attempts left', () => {
  assert.deepEqual(viewFor({ email: EMAIL, state: 'ready', remaining: 3, deadline: '2026-12-31' }),
    { view: 'ready', email: EMAIL, remaining: 3, deadline: '2026-12-31' });
});

test('a rejection shows the upload view again, with the reason and the attempts left', () => {
  assert.deepEqual(viewFor({ email: EMAIL, state: 'rejected', reason: 'no-tripezgo', remaining: 2, deadline: '2026-12-31' }),
    { view: 'ready', email: EMAIL, reason: 'no-tripezgo', remaining: 2, deadline: '2026-12-31' });
});

test('an issued answer shows the code and the redeem link', () => {
  const v = viewFor({ email: EMAIL, state: 'issued', code: 'ABC', redeemUrl: 'https://apps.apple.com/redeem?code=ABC' });
  assert.equal(v.view, 'issued');
  assert.equal(v.code, 'ABC');
  assert.equal(v.redeemUrl, 'https://apps.apple.com/redeem?code=ABC');
});

test('waiting, taken part and closed each have their own view', () => {
  assert.equal(viewFor({ email: EMAIL, state: 'pending-review' }).view, 'pending-review');
  assert.equal(viewFor({ email: EMAIL, state: 'denied' }).view, 'denied');
  assert.equal(viewFor({ email: EMAIL, state: 'closed' }).view, 'closed');
});

test('a rejected ID token sends the visitor back to sign in', () => {
  assert.deepEqual(viewFor({ error: 'auth' }), { view: 'signed-out' });
});

test('anything the page does not understand is an error, not a blank page', () => {
  assert.deepEqual(viewFor({ error: 'bad-request' }), { view: 'error' });
  assert.deepEqual(viewFor({ error: 'image' }), { view: 'error' });
  assert.deepEqual(viewFor(null), { view: 'error' });
  assert.deepEqual(viewFor({ email: EMAIL, state: 'from-the-future' }), { view: 'error' });
});

test('a large screenshot is scaled so its long side is at most the limit, keeping the aspect ratio', () => {
  assert.deepEqual(fitWithin(1170, 2532, 2048), { width: 946, height: 2048 });
  assert.deepEqual(fitWithin(3000, 2000, 2048), { width: 2048, height: 1365 });
});

test('a small screenshot is left alone', () => {
  assert.deepEqual(fitWithin(750, 1334, 2048), { width: 750, height: 1334 });
});
