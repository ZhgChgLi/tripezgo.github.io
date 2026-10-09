/* 分享換 Premium 活動頁的純函式：請求怎麼包、後端的回答要畫成哪個畫面。瀏覽器與 node --test 共用。
 * 規格在 App repo 的 `.scratch/share-reward/spec.md`（§3 畫面狀態、§4 後端 API）。 */

/** 後端吃 text/plain 的 JSON——Content-Type 不是 application/json，瀏覽器就不會先送 CORS preflight，
 *  而 Apps Script web app 不回 preflight。 */
export function requestBody(op, idToken, extra = {}) {
  return JSON.stringify({ op, idToken, ...extra });
}

const VIEWS = ['ready'];

/** 後端的回答 → 要畫的畫面。認不得的一律是 error，不留白頁。 */
export function viewFor(res) {
  if (!res || typeof res !== 'object') return { view: 'error' };
  if (res.error === 'auth') return { view: 'signed-out' };
  if (res.error || !VIEWS.includes(res.state)) return { view: 'error' };
  return { view: res.state, remaining: res.remaining };
}
