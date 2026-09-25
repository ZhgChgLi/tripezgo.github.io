#!/usr/bin/env node
/* 每日清理：把不是 App 寫的 `TripEZGoPublicItinerary` 從 **Production** public database 刪掉（票 15、場景 33）。
 *
 * ## 為什麼需要
 * `_icloud` 有 Create：任何登入 iCloud 的人都能繞過 App、直接用 Web Services 往這個 type 塞 record
 * （spike 量過）。它們吃的是整個 container 共用的 public 額度。App 寫的每一筆都帶一個 HMAC 簽章
 * （簽章金鑰內嵌在 App 裡），這一支認得出哪些不是。
 *
 * ## 刪的條件（任一）
 *   - 格式版本不認得（缺、不是數字、不是這一版認得的 1）
 *   - payload 壞格式（缺、不是 base64、短於 nonce 12 bytes＋tag 16 bytes）
 *   - 沒有簽章
 *   - HMAC-SHA256(key, UTF-8(recordName) ‖ SHA-256(payload)) 在目前接受的**任一把**金鑰下都驗不過
 * ⚠️ App 升格式版本（formatVersion 2）之前，先讓這裡認得新版本並上線——否則新版 App 寫的每一筆都會被刪。
 *
 * ## 為什麼只碰 Production（寫死，不吃參數）
 * Development 裡是模擬器與 Xcode debug build 的測試資料；清掉它會讓開發中的連結在測試途中消失。
 *
 * ## 身分
 * server-to-server key（CloudKit Console 在 Production 建的那一把）。它以建立它的開發者身分存取，
 * **連同那個人身上的 security role**——開發者的 user record 掛了自訂角色 `Moderator`（Write），
 * 所以刪得動別人建的 record（spike 量過；沒掛 Moderator 時 ACCESS_DENIED）。
 *
 * ## 環境變數（GitHub Actions secrets）
 *   CK_S2S_KEY_ID        server-to-server key 的 Key ID
 *   CK_S2S_PRIVATE_KEY   那一把的 EC P-256 私鑰（PEM）
 *   TEZ_SIGNING_KEYS     目前接受的簽章金鑰，base64，逗號分隔（換鑰期間新舊並列）
 *   DRY_RUN              "true" ＝只列出會刪哪些，不刪
 */
import { createPrivateKey, createHash, sign } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { base64Decode, FORMAT_VERSION, isSigned, NONCE_BYTES, sealedFromRecord, TAG_BYTES } from '../../trip/core.js';

export const CONTAINER = 'iCloud.com.zhgchgli.tripezgo';
export const ENVIRONMENT = 'production';
export const RECORD_TYPE = 'TripEZGoPublicItinerary';
const HOST = 'https://api.apple-cloudkit.com';
const PAGE = 50; /* 一筆最多 ~550 KB（封面在 payload 裡），一頁 50 筆 ≈ 27 MB */

/** CloudKit Web Services 的 server-to-server 簽章：
 *  ECDSA P-256／SHA-256 over `<ISO8601 date>:<base64(SHA-256(body))>:<subpath>`，DER，base64。 */
export function signedHeaders({ keyId, privateKey, subpath, body, date }) {
  const iso = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const bodyHash = createHash('sha256').update(body, 'utf8').digest('base64');
  const signature = sign('sha256', Buffer.from(iso + ':' + bodyHash + ':' + subpath, 'utf8'), privateKey).toString('base64');
  return {
    'Content-Type': 'application/json',
    'X-Apple-CloudKit-Request-KeyID': keyId,
    'X-Apple-CloudKit-Request-ISO8601Date': iso,
    'X-Apple-CloudKit-Request-SignatureV1': signature,
  };
}

/** 這一筆該不該刪。→ `null`（留著）或原因字串。 */
export async function verdict(record, signingKeys) {
  const fields = record.fields || {};
  const version = fields.formatVersion && fields.formatVersion.value;
  if (typeof version !== 'number') return 'unknown-format（沒有 formatVersion）';
  if (version !== FORMAT_VERSION) return 'unknown-format（formatVersion ' + version + '）';
  const raw = fields.payload && fields.payload.value;
  if (typeof raw !== 'string' || !base64Decode(raw)) return 'malformed-payload（沒有 payload 或不是 base64）';
  const sealed = sealedFromRecord(record);
  if (sealed.payload.length < NONCE_BYTES + TAG_BYTES) return 'malformed-payload（' + sealed.payload.length + ' bytes，短於 nonce＋tag）';
  if (!sealed.signature) return 'unsigned（沒有 signature）';
  if (!(await isSigned(sealed, record.recordName, signingKeys))) return 'bad-signature（目前接受的金鑰都驗不過）';
  return null;
}

export function parseSigningKeys(text) {
  const keys = String(text || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const k = base64Decode(s);
    if (!k || !k.length) throw new Error('TEZ_SIGNING_KEYS 裡有一把不是 base64');
    return k;
  });
  return keys;
}

export async function runCleanup({ fetchImpl, keyId, privateKey, signingKeys, dryRun = false, log = console.log, now = () => new Date() }) {
  if (!signingKeys || !signingKeys.length) {
    /* 沒有金鑰＝每一筆都驗不過＝全部刪光。寧可不跑。 */
    throw new Error('沒有任何簽章金鑰：拒絕執行（否則每一筆都會被當成沒簽）');
  }
  const key = typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;
  const call = async (op, payload) => {
    const subpath = '/database/1/' + CONTAINER + '/' + ENVIRONMENT + '/public/' + op;
    const body = JSON.stringify(payload);
    const res = await fetchImpl(HOST + subpath, {
      method: 'POST',
      headers: signedHeaders({ keyId, privateKey: key, subpath, body, date: now() }),
      body,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) throw new Error(op + ' → HTTP ' + res.status + ' ' + JSON.stringify(json));
    return json;
  };

  const report = { scanned: 0, kept: 0, deleted: [], wouldDelete: [], failed: [] };
  const doomed = [];
  let marker;
  do {
    const page = await call('records/query', {
      zoneID: { zoneName: '_defaultZone' },
      query: { recordType: RECORD_TYPE },
      resultsLimit: PAGE,
      ...(marker ? { continuationMarker: marker } : {}),
    });
    for (const record of page.records || []) {
      if (record.serverErrorCode) continue;
      report.scanned++;
      const reason = await verdict(record, signingKeys);
      if (!reason) { report.kept++; continue; }
      doomed.push({
        recordName: record.recordName,
        recordChangeTag: record.recordChangeTag,
        reason,
        creator: record.created && record.created.userRecordName,
        createdAt: record.created && record.created.timestamp ? new Date(record.created.timestamp).toISOString() : null,
      });
    }
    marker = page.continuationMarker;
  } while (marker);

  if (dryRun) {
    report.wouldDelete = doomed;
  } else {
    for (let i = 0; i < doomed.length; i += 100) {
      const batch = doomed.slice(i, i + 100);
      const res = await call('records/modify', {
        atomic: false,
        operations: batch.map((d) => ({ operationType: 'delete', record: { recordName: d.recordName, recordChangeTag: d.recordChangeTag } })),
      });
      const byName = Object.fromEntries((res.records || []).map((r) => [r.recordName, r]));
      for (const d of batch) {
        const r = byName[d.recordName];
        if (r && r.deleted) report.deleted.push(d);
        else report.failed.push({ ...d, error: r ? r.serverErrorCode + ' ' + (r.reason || '') : 'no result' });
      }
    }
  }

  log('環境：' + ENVIRONMENT + '（寫死）｜掃過 ' + report.scanned + ' 筆｜留下 ' + report.kept + ' 筆｜'
    + (dryRun ? '試跑，會刪 ' + report.wouldDelete.length + ' 筆' : '刪掉 ' + report.deleted.length + ' 筆，失敗 ' + report.failed.length + ' 筆'));
  for (const d of dryRun ? report.wouldDelete : report.deleted) {
    log((dryRun ? '會刪  ' : '已刪  ') + d.recordName + '  ' + d.reason + '  建立者 ' + (d.creator || '?') + '  建立於 ' + (d.createdAt || '?'));
  }
  for (const d of report.failed) log('刪不掉 ' + d.recordName + '  ' + d.reason + '  → ' + d.error);
  return report;
}

function summaryMarkdown(report, dryRun) {
  const rows = (dryRun ? report.wouldDelete : report.deleted).map((d) => '| ' + d.recordName + ' | ' + d.reason + ' | ' + (d.creator || '') + ' | ' + (d.createdAt || '') + ' |');
  const failed = report.failed.map((d) => '| ' + d.recordName + ' | ' + d.reason + ' | ' + d.error + ' |');
  return '## 公開連結每日清理（' + ENVIRONMENT + (dryRun ? '，試跑' : '') + '）\n\n'
    + '掃過 ' + report.scanned + ' 筆，留下 ' + report.kept + ' 筆，' + (dryRun ? '會刪 ' : '刪掉 ') + rows.length + ' 筆'
    + (dryRun ? '' : '，失敗 ' + failed.length + ' 筆') + '。\n\n'
    + (rows.length ? '| recordName | 原因 | 建立者 | 建立於 |\n|---|---|---|---|\n' + rows.join('\n') + '\n\n' : '')
    + (failed.length ? '### 刪不掉\n\n| recordName | 原因 | 錯誤 |\n|---|---|---|\n' + failed.join('\n') + '\n' : '');
}

async function main() {
  const { CK_S2S_KEY_ID: keyId, CK_S2S_PRIVATE_KEY: pem, TEZ_SIGNING_KEYS: keys, DRY_RUN } = process.env;
  const missing = ['CK_S2S_KEY_ID', 'CK_S2S_PRIVATE_KEY', 'TEZ_SIGNING_KEYS'].filter((n) => !process.env[n]);
  if (missing.length) {
    /* Production 的 key 與正式簽章金鑰設好之前，排程每天照跑、每天跳過——不算失敗，不寄紅燈信。 */
    console.log('::warning::沒有設定 ' + missing.join('、') + '，這一輪跳過（見 README 的每日清理一節）');
    return;
  }
  const dryRun = DRY_RUN === 'true';
  const report = await runCleanup({ fetchImpl: fetch, keyId, privateKey: pem, signingKeys: parseSigningKeys(keys), dryRun });
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(report, dryRun));
  if (report.failed.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('::error::' + err.message);
    process.exit(1);
  });
}
