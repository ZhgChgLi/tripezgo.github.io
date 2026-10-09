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
  // 網址或同意被後端擋下：沒有算次數，留在表單上提示。
  if (res.error === 'url' || res.error === 'consent') return { view: 'form-error', error: res.error };
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

/** 網址欄的值值得送嗎：http(s)、有主機名。真正的檢查（是不是貼文、內網、我們自己的站）在後端。 */
export function looksLikeUrl(value) {
  return /^https?:\/\/[^\s\/?#]+\.[^\s\/?#]+/i.test(String(value || '').trim());
}
