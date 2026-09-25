/* 跨語言契約：App 產生的黃金檔（tests/fixtures/golden-v1.json），網頁這一側逐字對上。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  base64Decode,
  base64UrlEncode,
  clock,
  isSigned,
  openSealed,
  OpenFailure,
  parseFragment,
  plainText,
  sealedFromRecord,
  timeRange,
  validateCopy,
} from '../../trip/core.js';
import { compareGolden } from '../../tools/check-golden.mjs';

const golden = JSON.parse(readFileSync(new URL('../fixtures/golden-v1.json', import.meta.url), 'utf8'));
const signingKey = base64Decode(golden.signingKey);

/** 黃金檔裡的 record 換成 Web Services 回的那個形狀。 */
const recordOf = (c) => ({
  recordName: c.recordName,
  recordType: 'TripEZGoPublicItinerary',
  fields: {
    formatVersion: { value: c.record.formatVersion, type: 'INT64' },
    payload: { value: c.record.payload, type: 'BYTES' },
    signature: { value: c.record.signature, type: 'BYTES' },
  },
});

test('黃金檔副本跟 App repo 那一份一致（App repo 不在就略過）', (t) => {
  const result = compareGolden();
  if (result.status === 'skipped') {
    t.skip(result.reason);
    return;
  }
  assert.equal(result.status, 'same', result.reason);
});

for (const c of golden.cases) {
  test(`${c.name}：網址片段解得出 id 與金鑰`, () => {
    const link = parseFragment(new URL(c.url).hash);
    assert.ok(link);
    assert.equal(link.id, c.recordName);
    assert.equal(link.key.length, 32);
  });

  test(`${c.name}：解密出來的公開版本跟 App 的明文同一份`, async () => {
    const link = parseFragment(new URL(c.url).hash);
    const copy = await openSealed(sealedFromRecord(recordOf(c)), link.key);
    assert.deepEqual(copy, validateCopy(c.plaintext));
    assert.equal(copy.name, c.plaintext.trip.name);
    assert.equal(copy.items.length, c.plaintext.items.length);
  });

  for (const lang of ['zh', 'en', 'ja']) {
    test(`${c.name}：純文字（${lang}）與 App 逐字相同`, async () => {
      const link = parseFragment(new URL(c.url).hash);
      const copy = await openSealed(sealedFromRecord(recordOf(c)), link.key);
      assert.equal(plainText(copy, lang), c.plainText[lang]);
    });
  }

  test(`${c.name}：簽章用測試金鑰驗得過`, async () => {
    assert.equal(await isSigned(sealedFromRecord(recordOf(c)), c.recordName, [signingKey]), true);
  });

  test(`${c.name}：換鑰期間新舊兩把只要一把驗得過就算`, async () => {
    const other = new Uint8Array(32).fill(7);
    assert.equal(await isSigned(sealedFromRecord(recordOf(c)), c.recordName, [other, signingKey]), true);
    assert.equal(await isSigned(sealedFromRecord(recordOf(c)), c.recordName, [other]), false);
  });
}

test('竄改過的 payload 驗不過簽章、也解不開', async () => {
  const c = golden.cases[0];
  const sealed = sealedFromRecord(recordOf(c));
  sealed.payload[20] ^= 0x01;
  assert.equal(await isSigned(sealed, c.recordName, [signingKey]), false);
  await assert.rejects(openSealed(sealed, parseFragment(new URL(c.url).hash).key), (e) => e.kind === 'cannotDecrypt');
});

test('合法的密文搬到別的 recordName 上就驗不過', async () => {
  const c = golden.cases[0];
  assert.equal(await isSigned(sealedFromRecord(recordOf(c)), golden.cases[1].recordName, [signingKey]), false);
});

test('沒有簽章的 record 驗不過', async () => {
  const c = golden.cases[0];
  const record = recordOf(c);
  delete record.fields.signature;
  assert.equal(await isSigned(sealedFromRecord(record), c.recordName, [signingKey]), false);
});

test('金鑰不對就是解不開', async () => {
  const c = golden.cases[0];
  await assert.rejects(openSealed(sealedFromRecord(recordOf(c)), new Uint8Array(32)), OpenFailure);
});

test('格式版本不認得就不解', async () => {
  const c = golden.cases[0];
  const record = recordOf(c);
  record.fields.formatVersion.value = 2;
  await assert.rejects(
    openSealed(sealedFromRecord(record), parseFragment(new URL(c.url).hash).key),
    (e) => e.kind === 'unknownFormat'
  );
});

test('網址片段：殘缺、多一段、金鑰非正規編碼都算解析失敗', () => {
  const good = new URL(golden.cases[0].url).hash;
  assert.ok(parseFragment(good));
  assert.ok(parseFragment(good.toUpperCase().replace(/^#/, '#').split('.')[0] + '.' + good.split('.')[1]), '大寫的 id 也收（同 App）');
  assert.equal(parseFragment(''), null);
  assert.equal(parseFragment('#'), null);
  assert.equal(parseFragment(good.slice(0, -3)), null, '金鑰被截掉一段');
  assert.equal(parseFragment(good.split('.')[0]), null, '沒有金鑰');
  assert.equal(parseFragment(good + '.x'), null);
  assert.equal(parseFragment('#' + 'g'.repeat(32) + '.' + good.split('.')[1]), null, 'id 不是 hex');
  const key = new Uint8Array(32).fill(0xff);
  assert.equal(parseFragment('#' + '0'.repeat(32) + '.' + base64UrlEncode(key) + '='), null, '帶補位');
});

test('時刻：24:00 與跨午夜的詞', () => {
  assert.equal(clock(0), '00:00');
  assert.equal(clock(1440), '24:00');
  assert.equal(clock(-1440), '24:00');
  assert.equal(timeRange(1380, 1440, 'zh'), '23:00 – 24:00');
  assert.equal(timeRange(1320, 1530, 'zh'), '22:00 – 隔天 01:30');
  assert.equal(timeRange(1800, 2000, 'en'), 'next day 06:00 – 09:20');
  assert.equal(timeRange(-60, 60, 'ja'), '前日 23:00 – 01:00');
  assert.equal(timeRange(3000, 3100, 'en'), '2 days later 02:00 – 03:40');
});
