/* 分享換 Premium 活動頁：貼網址 → Google Sign-In → 後端（Apps Script）當場檢查 → 畫面。判斷在 core.js。
 * 表單一開始就看得到（grill Q38）；沒登入時送出鈕的位置是 Google 登入，登入完如果網址與同意都填好了就直接送。 */
import { GOOGLE_CLIENT_ID, ENDPOINT } from './config.js';
import { requestBody, viewFor, looksLikeUrl } from './core.js';
import { CAPTIONS, shareTarget } from './captions.js';
import { brandHtml, footerHtml } from '/assets/js/chrome.js';

const REASONS = {
  'no-mention': '這篇貼文裡找不到 tripezgo.com 或 TripEZGo 的 App Store 連結。只寫名字不算，請把連結加進貼文內容。',
  unreachable: '讀不到這篇貼文。請確認貼文是公開的，網址是貼文本身（不是個人首頁）。',
  'duplicate-url': '這篇貼文已經被其他帳號用過了。',
  url: '這看起來不是社群貼文的網址。',
  consent: '請先勾選同意。',
};

let idToken = '';
let email = '';

const $ = (id) => document.getElementById(id);

function setNotice(code) {
  $('notice').hidden = !code;
  $('notice').textContent = code ? REASONS[code] || REASONS.unreachable : '';
}

function show(next) {
  if (next.view === 'form-error') {
    for (const el of document.querySelectorAll('[data-view]')) el.hidden = true;
    $('form').hidden = false;
    setNotice(next.error);
    return;
  }
  if (next.email !== undefined) email = next.email || '';
  if (next.view === 'signed-out') {
    idToken = '';
    email = '';
  }
  const onForm = next.view === 'ready' || next.view === 'signed-out';
  $('form').hidden = !onForm;
  for (const el of document.querySelectorAll('[data-view]')) el.hidden = el.dataset.view !== next.view;

  $('account').hidden = !email;
  $('email').textContent = email;
  $('signin').hidden = !!idToken;
  $('submit').hidden = !idToken;
  $('remaining-line').hidden = next.view !== 'ready';
  if (next.view === 'ready') {
    $('remaining').textContent = next.remaining;
    $('deadline').textContent = next.deadline || '';
    $('deadline-line').hidden = !next.deadline;
    setNotice(next.reason);
  }
  for (const el of document.querySelectorAll('[data-field="email"]')) el.textContent = email;
  if (next.view === 'issued') {
    const card = document.querySelector('[data-view="issued"]');
    card.querySelector('[data-field="code"]').textContent = next.code;
    card.querySelector('[data-field="redeem"]').href = next.redeemUrl;
  }
  refreshSubmit();
}

async function call(op, extra) {
  try {
    // 不設 Content-Type：fetch 會送 text/plain，屬於「簡單請求」，不觸發 preflight。
    const res = await fetch(ENDPOINT, { method: 'POST', body: requestBody(op, idToken, extra) });
    const body = await res.json();
    if (body && body.error && body.error !== 'auth') console.warn('share backend', op, body);
    return body;
  } catch (err) {
    console.warn('share backend', op, err);
    return null;
  }
}

const ready = () => looksLikeUrl($('url').value) && $('consent').checked;

function refreshSubmit() {
  $('submit').disabled = !ready();
}

async function submit() {
  show({ view: 'loading' });
  show(viewFor(await call('submit', { url: $('url').value.trim(), consent: $('consent').checked, lang: document.documentElement.lang })));
}

async function onCredential({ credential }) {
  idToken = credential;
  show({ view: 'loading' });
  const status = viewFor(await call('status'));
  // 網址與同意都填好了才按登入的：登入完直接送，不必再按一次（Q38）。
  if (status.view === 'ready' && ready()) return submit();
  show(status);
}

// ── 文案與分享（使用者要求 2026-10-10：挑文案 → 一鍵分享 → 把網址貼回來） ──

function renderCaptions() {
  $('captions').innerHTML = '';
  CAPTIONS.forEach((text, i) => {
    const label = document.createElement('label');
    label.className = 'caption-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'caption';
    radio.checked = i === 0;
    radio.addEventListener('change', () => { $('caption').value = text; });
    const span = document.createElement('span');
    span.textContent = text;
    label.append(radio, span);
    $('captions').append(label);
  });
  $('caption').value = CAPTIONS[0];
}

function hint(text) {
  $('share-hint').hidden = !text;
  $('share-hint').textContent = text;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

for (const button of document.querySelectorAll('[data-share]')) {
  button.addEventListener('click', async () => {
    const text = $('caption').value.trim();
    if (button.dataset.share === 'native') {
      try { await navigator.share({ text }); } catch { /* 使用者取消 */ }
      hint('發好之後，把那篇貼文的網址貼到第 3 步。');
      return;
    }
    const target = shareTarget(button.dataset.share, text);
    // 先開視窗再做別的：手機瀏覽器只在使用者點擊的那一刻放行彈出視窗。
    if (target.url) window.open(target.url, '_blank', 'noopener');
    if (target.copy) {
      const copied = await copy(text);
      hint(copied
        ? '文案已經複製好了，到貼文裡貼上就行。發好之後，把那篇貼文的網址貼到第 3 步。'
        : '請手動複製上面的文案貼到貼文裡。發好之後，把那篇貼文的網址貼到第 3 步。');
    } else {
      hint('發好之後，把那篇貼文的網址貼到第 3 步。');
    }
  });
}
$('native-share').hidden = typeof navigator.share !== 'function';

$('paste').addEventListener('click', async () => {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (looksLikeUrl(text)) {
      $('url').value = text;
      refreshSubmit();
    } else {
      hint('剪貼簿裡不是網址。到貼文的「分享」或「複製連結」拿網址，再按一次。');
    }
  } catch {
    $('url').focus();
    hint('這個瀏覽器不讓網頁讀剪貼簿，請直接在欄位裡貼上。');
  }
});

renderCaptions();

$('url').addEventListener('input', refreshSubmit);
$('consent').addEventListener('change', refreshSubmit);
$('submit').addEventListener('click', submit);
$('switch').addEventListener('click', () => {
  google.accounts.id.disableAutoSelect();
  show({ view: 'signed-out' });
});

$('brand').innerHTML = brandHtml('zh');
$('site-footer').innerHTML = footerHtml('zh');

function start() {
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, use_fedcm_for_prompt: true });
  google.accounts.id.renderButton($('signin'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with' });
  show({ view: 'signed-out' });
}

// GIS 用 async 載入；module 可能比它先跑完。
if (window.google?.accounts?.id) start();
else document.querySelector('script[src*="gsi/client"]').addEventListener('load', start);
