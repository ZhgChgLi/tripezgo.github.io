/* 分享換 Premium 活動頁的純函式：請求怎麼包、後端的回答要畫成哪個畫面。瀏覽器與 node --test 共用。
 * 規格在 App repo 的 `.scratch/share-reward/spec.md`（§3 畫面狀態、§4 後端 API）。 */

/** 後端吃 text/plain 的 JSON——Content-Type 不是 application/json，瀏覽器就不會先送 CORS preflight，
 *  而 Apps Script web app 不回 preflight。 */
export function requestBody(op, idToken, extra = {}) {
  return JSON.stringify({ op, idToken, ...extra });
}

const VIEWS = ['ready', 'issued', 'rejected', 'pending-review', 'denied', 'closed'];

/** 後端的回答 → 要畫的畫面。認不得的一律是 error，不留白頁。 */
export function viewFor(res) {
  if (!res || typeof res !== 'object') return { view: 'error' };
  if (res.error === 'auth') return { view: 'signed-out' };
  // AI 沒回答：沒扣次數，留在上傳畫面，提示再送一次。
  if (res.error === 'judge-unavailable' && res.state === 'ready') {
    return { view: 'ready', remaining: res.remaining, notice: 'judge-unavailable' };
  }
  if (res.error || !VIEWS.includes(res.state)) return { view: 'error' };
  switch (res.state) {
    case 'ready': return { view: 'ready', remaining: res.remaining, deadline: res.deadline };
    case 'issued': return { view: 'issued', code: res.code, redeemUrl: res.redeemUrl, deadline: res.deadline };
    case 'rejected': return { view: 'rejected', reason: res.reason, remaining: res.remaining };
    default: return { view: res.state };
  }
}

/** 截圖縮到長邊不超過 max（保持比例、只縮不放）；上傳前在 canvas 上用。 */
export function fitWithin(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
