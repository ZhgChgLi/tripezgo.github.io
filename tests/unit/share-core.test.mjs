import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestBody, viewFor } from '../../share/core.js';

test('a status request carries the op and the ID token as JSON', () => {
  assert.deepEqual(JSON.parse(requestBody('status', 'tok')), { op: 'status', idToken: 'tok' });
});

test('a ready answer shows the upload view with the attempts left', () => {
  assert.deepEqual(viewFor({ state: 'ready', remaining: 3 }), { view: 'ready', remaining: 3 });
});

test('a rejected ID token sends the visitor back to sign in', () => {
  assert.deepEqual(viewFor({ error: 'auth' }), { view: 'signed-out' });
});

test('anything the page does not understand is an error, not a blank page', () => {
  assert.deepEqual(viewFor({ error: 'bad-request' }), { view: 'error' });
  assert.deepEqual(viewFor(null), { view: 'error' });
  assert.deepEqual(viewFor({ state: 'from-the-future' }), { view: 'error' });
});
