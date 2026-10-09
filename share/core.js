/* 分享換 Premium 活動頁的純函式：請求怎麼包、後端的回答要畫成哪個畫面。瀏覽器與 node --test 共用。
 * 規格在 App repo 的 `.scratch/share-reward/spec.md`（§3 畫面狀態、§4 後端 API）。 */

/** 後端吃 text/plain 的 JSON——Content-Type 不是 application/json，瀏覽器就不會先送 CORS preflight，
 *  而 Apps Script web app 不回 preflight。 */
export function requestBody(op, idToken, extra = {}) {
  return JSON.stringify({ op, idToken, ...extra });
}

const VIEWS = ['ready', 'issued', 'rejected', 'pending-review', 'denied', 'closed'];

/** 後端的回答 → 要畫的畫面。認不得的一律是 error，不留白頁。
 *  判讀是每天一次的排程（grill Q30），所以「未通過」不是終點：回到上傳畫面，上面寫著上一次的原因。 */
export function viewFor(res) {
  if (!res || typeof res !== 'object') return { view: 'error' };
  if (res.error === 'auth') return { view: 'signed-out' };
  if (res.error || !VIEWS.includes(res.state)) return { view: 'error' };
  const email = res.email;
  switch (res.state) {
    case 'ready': return { view: 'ready', email, remaining: res.remaining, deadline: res.deadline };
    case 'rejected':
      return { view: 'ready', email, reason: res.reason, remaining: res.remaining, deadline: res.deadline };
    case 'issued': return { view: 'issued', email, code: res.code, redeemUrl: res.redeemUrl };
    default: return { view: res.state, email };
  }
}

/** 截圖縮到長邊不超過 max（保持比例、只縮不放）；上傳前在 canvas 上用。 */
export function fitWithin(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
