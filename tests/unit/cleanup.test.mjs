/* 票 15／場景 33：每日清理只刪不是 App 寫的，只碰 Production。
 * 假的 Web Services：合法／沒簽／竄改／壞格式／版本不認得，只有後四種被刪。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { base64Decode, base64Encode } from '../../trip/core.js';
import { CONTAINER, ENVIRONMENT, parseSigningKeys, runCleanup } from '../../tools/cleanup/cleanup.mjs';

const golden = JSON.parse(readFileSync(new URL('../fixtures/golden-v1.json', import.meta.url), 'utf8'));
const signingKey = base64Decode(golden.signingKey);
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

const record = (name, fields, extra = {}) => ({
  recordName: name,
  recordType: 'TripEZGoPublicItinerary',
  recordChangeTag: 'tag-' + name.slice(0, 8),
  created: { timestamp: 1790257500000, userRecordName: '_someone' },
  fields,
  ...extra,
});
const golden0 = golden.cases[0];
const golden1 = golden.cases[1];
const f = (c) => ({
  formatVersion: { value: c.record.formatVersion, type: 'INT64' },
  payload: { value: c.record.payload, type: 'BYTES' },
  signature: { value: c.record.signature, type: 'BYTES' },
});

function fixtures() {
  const valid = record(golden0.recordName, f(golden0));
  const alsoValid = record(golden1.recordName, f(golden1));
  const unsigned = record('b'.repeat(32), (({ signature, ...rest }) => rest)(f(golden0)));
  const tamperedBytes = base64Decode(golden1.record.payload);
  tamperedBytes[30] ^= 0xff;
  const tampered = record('c'.repeat(32), { ...f(golden1), payload: { value: base64Encode(tamperedBytes), type: 'BYTES' } });
  /* 合法密文搬到另一個 recordName 上：簽章綁 recordName，驗不過 */
  const moved = record('d'.repeat(32), f(golden0));
  const malformed = record('e'.repeat(32), { ...f(golden0), payload: { value: base64Encode(new Uint8Array(20)), type: 'BYTES' } });
  const notBase64 = record('f'.repeat(32), { ...f(golden0), payload: { value: '%%%', type: 'BYTES' } });
  const unknownVersion = record('0'.repeat(32), { ...f(golden0), formatVersion: { value: 2, type: 'INT64' } });
  const noVersion = record('1'.repeat(32), { payload: f(golden0).payload });
  return { valid, alsoValid, unsigned, tampered, moved, malformed, notBase64, unknownVersion, noVersion };
}

/** 假的 CloudKit Web Services：驗 server-to-server 簽章、分頁、刪除。 */
function fakeWebServices(records, { pageSize = 3 } = {}) {
  const store = new Map(records.map((r) => [r.recordName, r]));
  const requests = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    requests.push({ url, path: u.pathname, headers: init.headers, body: JSON.parse(init.body) });
    const h = init.headers;
    const message = h['X-Apple-CloudKit-Request-ISO8601Date'] + ':'
      + createHash('sha256').update(init.body).digest('base64') + ':' + u.pathname;
    const ok = verify('sha256', Buffer.from(message), publicKey, Buffer.from(h['X-Apple-CloudKit-Request-SignatureV1'], 'base64'));
    const respond = (status, obj) => ({ ok: status < 300, status, json: async () => obj });
    if (!ok || h['X-Apple-CloudKit-Request-KeyID'] !== 'test-key-id') return respond(401, { serverErrorCode: 'AUTHENTICATION_FAILED' });
    const body = JSON.parse(init.body);
    if (u.pathname.endsWith('/records/query')) {
      const all = [...store.values()];
      const start = body.continuationMarker ? Number(body.continuationMarker) : 0;
      const slice = all.slice(start, start + pageSize);
      return respond(200, { records: slice, ...(start + pageSize < all.length ? { continuationMarker: String(start + pageSize) } : {}) });
    }
    if (u.pathname.endsWith('/records/modify')) {
      return respond(200, {
        records: body.operations.map((op) => {
          const r = store.get(op.record.recordName);
          if (!r) return { recordName: op.record.recordName, serverErrorCode: 'NOT_FOUND' };
          if (r.recordChangeTag !== op.record.recordChangeTag) return { recordName: op.record.recordName, serverErrorCode: 'CONFLICT' };
          store.delete(op.record.recordName);
          return { recordName: op.record.recordName, deleted: true };
        }),
      });
    }
    return respond(400, { serverErrorCode: 'BAD_REQUEST' });
  };
  return { fetchImpl, requests, store };
}

const run = (ws, extra = {}) => runCleanup({
  fetchImpl: ws.fetchImpl, keyId: 'test-key-id', privateKey, signingKeys: [signingKey], log: () => {}, now: () => new Date('2026-09-26T03:00:00.123Z'), ...extra,
});

test('只刪沒簽、竄改、搬家、壞格式、版本不認得的；App 寫的留著', async () => {
  const fx = fixtures();
  const ws = fakeWebServices(Object.values(fx));
  const report = await run(ws);
  assert.deepEqual([...ws.store.keys()].sort(), [fx.valid.recordName, fx.alsoValid.recordName].sort());
  assert.equal(report.scanned, 9);
  assert.equal(report.kept, 2);
  const reasons = Object.fromEntries(report.deleted.map((d) => [d.recordName, d.reason.split('（')[0]]));
  assert.deepEqual(reasons, {
    [fx.unsigned.recordName]: 'unsigned',
    [fx.tampered.recordName]: 'bad-signature',
    [fx.moved.recordName]: 'bad-signature',
    [fx.malformed.recordName]: 'malformed-payload',
    [fx.notBase64.recordName]: 'malformed-payload',
    [fx.unknownVersion.recordName]: 'unknown-format',
    [fx.noVersion.recordName]: 'unknown-format',
  });
  assert.equal(report.failed.length, 0);
  /* 逐筆記下建立者與建立時間 */
  assert.equal(report.deleted[0].creator, '_someone');
  assert.equal(report.deleted[0].createdAt, '2026-09-24T13:45:00.000Z');
});

test('只打 Production：每一個請求都在 production 的 public database，沒有一個碰 Development', async () => {
  const ws = fakeWebServices(Object.values(fixtures()));
  await run(ws);
  assert.equal(ENVIRONMENT, 'production');
  assert.ok(ws.requests.length >= 4); /* 三頁查詢＋刪除 */
  for (const r of ws.requests) {
    assert.ok(r.path.startsWith('/database/1/' + CONTAINER + '/production/public/'), r.path);
    assert.ok(!r.url.includes('development'), r.url);
  }
  /* 環境不吃參數：想傳也傳不進去 */
  const ws2 = fakeWebServices(Object.values(fixtures()));
  await run(ws2, { environment: 'development' });
  assert.ok(ws2.requests.every((r) => !r.url.includes('development')));
});

test('server-to-server 簽章：日期不帶毫秒、帶 KeyID，伺服器端驗得過', async () => {
  const ws = fakeWebServices([fixtures().valid]);
  await run(ws);
  const h = ws.requests[0].headers;
  assert.equal(h['X-Apple-CloudKit-Request-ISO8601Date'], '2026-09-26T03:00:00Z');
  assert.equal(h['X-Apple-CloudKit-Request-KeyID'], 'test-key-id');
  assert.ok(h['X-Apple-CloudKit-Request-SignatureV1']);
  assert.deepEqual(ws.requests[0].body.query, { recordType: 'TripEZGoPublicItinerary' });
});

test('刪除帶 recordChangeTag、不是 atomic', async () => {
  const fx = fixtures();
  const ws = fakeWebServices([fx.valid, fx.unsigned]);
  await run(ws);
  const modify = ws.requests.find((r) => r.path.endsWith('/records/modify'));
  assert.deepEqual(modify.body, {
    atomic: false,
    operations: [{ operationType: 'delete', record: { recordName: fx.unsigned.recordName, recordChangeTag: fx.unsigned.recordChangeTag } }],
  });
});

test('換鑰期間：新舊兩把都收', async () => {
  const fx = fixtures();
  const ws = fakeWebServices([fx.valid, fx.unsigned]);
  const report = await run(ws, { signingKeys: parseSigningKeys(base64Encode(new Uint8Array(32).fill(1)) + ', ' + golden.signingKey) });
  assert.equal(report.kept, 1);
  assert.ok(ws.store.has(fx.valid.recordName));
});

test('只有新鑰、舊鑰已不收：舊鑰簽的也會被刪（金鑰清單就是規則）', async () => {
  const fx = fixtures();
  const ws = fakeWebServices([fx.valid]);
  await run(ws, { signingKeys: [new Uint8Array(32).fill(1)] });
  assert.equal(ws.store.size, 0);
});

test('試跑：列出會刪哪些，一筆都不刪', async () => {
  const fx = fixtures();
  const ws = fakeWebServices(Object.values(fx));
  const report = await run(ws, { dryRun: true });
  assert.equal(report.wouldDelete.length, 7);
  assert.equal(ws.store.size, 9);
  assert.ok(ws.requests.every((r) => r.path.endsWith('/records/query')));
});

test('沒有簽章金鑰就拒絕執行，不會把全部當成沒簽刪光', async () => {
  const ws = fakeWebServices(Object.values(fixtures()));
  await assert.rejects(run(ws, { signingKeys: [] }), /拒絕執行/);
  assert.equal(ws.requests.length, 0);
  assert.throws(() => parseSigningKeys('not base64!!'), /不是 base64/);
});

test('刪不掉的逐筆記下（例如 record 在清理途中被原作者更新過）', async () => {
  const fx = fixtures();
  const ws = fakeWebServices([fx.unsigned, fx.tampered]);
  const realFetch = ws.fetchImpl;
  ws.fetchImpl = async (url, init) => {
    if (url.endsWith('/records/modify')) ws.store.get(fx.tampered.recordName).recordChangeTag = 'changed';
    return realFetch(url, init);
  };
  const report = await run(ws);
  assert.equal(report.deleted.length, 1);
  assert.equal(report.failed.length, 1);
  assert.equal(report.failed[0].recordName, fx.tampered.recordName);
  assert.match(report.failed[0].error, /CONFLICT/);
});
