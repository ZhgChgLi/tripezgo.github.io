/* CloudKit Web Services 在 HTTP 邊界上假掉：`page.route` 攔 api.apple-cloudkit.com。
 * 頁面照常用 fetch 打，假的這一側照 Web Services 的形狀回。 */
import { readFileSync } from 'node:fs';

export const golden = JSON.parse(readFileSync(new URL('../fixtures/golden-v1.json', import.meta.url), 'utf8'));
export const dated = golden.cases.find((c) => c.name === 'dated');
export const undated = golden.cases.find((c) => c.name === 'undated');

export const AUTHOR = '_author0000000000000000000000000';
export const STRANGER = '_stranger00000000000000000000000';

/** 黃金檔的一筆 → Web Services `records/lookup` 回的那一筆。 */
export function recordOf(c, creator = AUTHOR) {
  return {
    recordName: c.recordName,
    recordType: 'TripEZGoPublicItinerary',
    recordChangeTag: 'tag-' + c.recordName.slice(0, 6),
    created: { timestamp: 1790257500000, userRecordName: creator },
    fields: {
      formatVersion: { value: c.record.formatVersion, type: 'INT64' },
      payload: { value: c.record.payload, type: 'BYTES' },
      signature: { value: c.record.signature, type: 'BYTES' },
    },
  };
}

/** 連結的路徑與片段（測試伺服器上的 /trip/#…）。 */
export const pathOf = (c) => '/trip/' + new URL(c.url).hash;

/** 把 trip/config.js 換成測試用的設定（兩個環境都有 token、可選 MapKit token）。 */
export async function useConfig(page, { production = 'prod-token', development = 'dev-token', mapkitToken = '' } = {}) {
  await page.route('**/trip/config.js*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'export const CONFIG = ' + JSON.stringify({
        container: 'iCloud.com.zhgchgli.tripezgo',
        environments: [
          { name: 'production', apiToken: production },
          { name: 'development', apiToken: development },
        ],
        mapkitToken,
      }) + ';',
    }));
}

/**
 * @param stores  `{ production: { [recordName]: record }, development: {...} }`
 * @param users   web-auth token → userRecordName（登入過的人）
 * @param hold    `true` 時 records/lookup 先不回，等測試呼叫 `release()`
 */
export async function fakeCloudKit(page, { stores = {}, users = {}, hold = false } = {}) {
  const calls = [];
  let release;
  const held = hold ? new Promise((r) => { release = r; }) : Promise.resolve();
  let rotation = 0;

  await page.route('https://api.apple-cloudkit.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const m = /^\/database\/1\/([^/]+)\/(production|development)\/public\/(.+)$/.exec(url.pathname);
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const call = {
      env: m && m[2],
      container: m && m[1],
      path: m && m[3],
      apiToken: url.searchParams.get('ckAPIToken'),
      webAuthToken: url.searchParams.get('ckWebAuthToken'),
      body,
    };
    calls.push(call);
    const store = (m && stores[m[2]]) || {};
    const json = (status, obj, headers = {}) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-apple-cloudkit-web-auth-token', ...headers },
        body: JSON.stringify(obj),
      });
    /* 登入者：token 用一次就換一把（spike 量到的行為），下一把放在 response header。 */
    const signedIn = call.webAuthToken && users[call.webAuthToken];
    const nextToken = () => {
      if (!signedIn) return {};
      const next = 'rotated-' + ++rotation;
      users[next] = users[call.webAuthToken];
      delete users[call.webAuthToken];
      return { 'x-apple-cloudkit-web-auth-token': next };
    };

    if (call.path === 'records/lookup') {
      await held;
      const records = body.records.map(({ recordName }) =>
        store[recordName] || { recordName, reason: 'Record not found', serverErrorCode: 'NOT_FOUND' });
      return json(200, { records }, nextToken());
    }
    if (call.path === 'users/current') {
      if (!signedIn) {
        return json(421, {
          uuid: 'x', serverErrorCode: 'AUTHENTICATION_REQUIRED', reason: 'request needs authorization',
          redirectURL: 'https://idmsa.apple.com/fake-sign-in?env=' + call.env,
        });
      }
      return json(200, { userRecordName: signedIn }, nextToken());
    }
    if (call.path === 'records/modify') {
      const results = body.operations.map((op) => {
        const rec = store[op.record.recordName];
        if (!signedIn) return { recordName: op.record.recordName, serverErrorCode: 'AUTHENTICATION_REQUIRED' };
        if (!rec) return { recordName: op.record.recordName, serverErrorCode: 'NOT_FOUND' };
        if (rec.created.userRecordName !== signedIn) {
          return { recordName: op.record.recordName, serverErrorCode: 'ACCESS_DENIED', reason: 'WRITE operation not permitted' };
        }
        delete store[op.record.recordName];
        return { recordName: op.record.recordName, deleted: true };
      });
      return json(200, { records: results }, nextToken());
    }
    return json(400, { serverErrorCode: 'BAD_REQUEST' });
  });

  return { calls, release: () => release && release() };
}
