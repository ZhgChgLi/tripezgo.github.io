/* CloudKit Web Services，只用 fetch——**不載 CloudKit JS**。
 *
 * 2026-09-15 用 CloudKit JS 的 setUpAuth() 一次都沒登入成功；2026-09-25 的 spike 直接打 Web Services
 * 一次就通（App repo `docs/App/Design/public-link-spike-2026-09-25.md`）。
 *
 * POST 用 `Content-Type: text/plain`：這樣是 CORS 的「簡單請求」，不必先走一趟 preflight。
 */

export const RECORD_TYPE = 'TripEZGoPublicItinerary';
const HOST = 'https://api.apple-cloudkit.com';

export function createClient({ container, environments, fetchImpl }) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const envs = environments.filter((e) => e.apiToken);

  function base(env) {
    return HOST + '/database/1/' + container + '/' + env.name + '/public/';
  }

  async function call(env, path, body, webAuthToken) {
    let url = base(env) + path + '?ckAPIToken=' + encodeURIComponent(env.apiToken);
    if (webAuthToken) url += '&ckWebAuthToken=' + encodeURIComponent(webAuthToken);
    const res = await doFetch(url, body
      ? { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }
      : { method: 'GET' });
    let json = null;
    try {
      json = await res.json();
    } catch (err) {
      json = null;
    }
    return { status: res.status, json, nextWebAuthToken: res.headers.get('x-apple-cloudkit-web-auth-token') };
  }

  /** 依序查每一個有 token 的環境。
   *  → `{ found: { env, record } }`／`{ notFound: true }`（每一個環境都說沒有）
   *  網路或伺服器錯誤會丟出來——那不是「連結失效」。 */
  async function lookup(recordName) {
    for (const env of envs) {
      const { status, json } = await call(env, 'records/lookup', { records: [{ recordName }] });
      const record = json && json.records && json.records[0];
      if (record && record.recordType === RECORD_TYPE && record.fields) return { found: { env, record } };
      /* 同名但不是這個 type 的（不可能是 App 寫的）當成沒有。 */
      if (record && (record.serverErrorCode === 'NOT_FOUND' || (record.recordType && record.recordType !== RECORD_TYPE))) continue;
      throw new Error('lookup failed in ' + env.name + ': ' + status + ' ' + ((record && record.serverErrorCode) || (json && json.serverErrorCode) || ''));
    }
    return { notFound: true };
  }

  return { environments: envs, call, lookup };
}
