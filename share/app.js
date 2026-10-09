/* 分享換 Premium 活動頁：Google Sign-In → 後端（Apps Script）→ 畫面。判斷在 core.js。 */
import { GOOGLE_CLIENT_ID, ENDPOINT } from './config.js';
import { requestBody, viewFor } from './core.js';

function show(view, data = {}) {
  for (const el of document.querySelectorAll('[data-view]')) el.hidden = el.dataset.view !== view;
  if (view === 'ready') document.getElementById('remaining').textContent = data.remaining;
}

async function call(op, idToken) {
  try {
    // 不設 Content-Type：fetch 會送 text/plain，屬於「簡單請求」，不觸發 preflight。
    const res = await fetch(ENDPOINT, { method: 'POST', body: requestBody(op, idToken) });
    return await res.json();
  } catch {
    return null;
  }
}

async function onCredential({ credential }) {
  show('loading');
  const next = viewFor(await call('status', credential));
  show(next.view, next);
}

function start() {
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, use_fedcm_for_prompt: true });
  google.accounts.id.renderButton(document.getElementById('signin'), { theme: 'outline', size: 'large', shape: 'pill' });
  show('signed-out');
}

// GIS 用 async 載入；module 可能比它先跑完。
if (window.google?.accounts?.id) start();
else document.querySelector('script[src*="gsi/client"]').addEventListener('load', start);
