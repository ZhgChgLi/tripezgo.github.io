import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestBody, viewFor, looksLikeUrl } from '../../share/core.js';

const EMAIL = 'someone@gmail.com';

test('a status request carries the op and the ID token as JSON', () => {
  assert.deepEqual(JSON.parse(requestBody('status', 'tok')), { op: 'status', idToken: 'tok' });
});

test('a submit request carries the post URL, the consent and the language', () => {
  assert.deepEqual(JSON.parse(requestBody('submit', 'tok', { url: 'https://x.com/a/status/1', consent: true, lang: 'zh-Hant' })),
    { op: 'submit', idToken: 'tok', url: 'https://x.com/a/status/1', consent: true, lang: 'zh-Hant' });
});

test('only an http(s) address with a host is worth sending', () => {
  assert.ok(looksLikeUrl('https://www.threads.net/@a/post/B'));
  assert.ok(looksLikeUrl('  http://x.com/a/status/1 '));
  assert.equal(looksLikeUrl('tripezgo.com'), false);
  assert.equal(looksLikeUrl('https://'), false);
  assert.equal(looksLikeUrl(''), false);
});

test('a URL or consent the backend refuses keeps the visitor on the form with a notice', () => {
  assert.deepEqual(viewFor({ error: 'url' }), { view: 'form-error', error: 'url' });
  assert.deepEqual(viewFor({ error: 'consent' }), { view: 'form-error', error: 'consent' });
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
  assert.deepEqual(viewFor({ error: 'server' }), { view: 'error' });
  assert.deepEqual(viewFor(null), { view: 'error' });
  assert.deepEqual(viewFor({ email: EMAIL, state: 'from-the-future' }), { view: 'error' });
});
