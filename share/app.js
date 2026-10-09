/* 分享換 Premium 活動頁：貼網址 → Google Sign-In → 後端（Apps Script）當場檢查 → 畫面。判斷在 core.js。
 * 表單一開始就看得到（grill Q38）；沒登入時送出鈕的位置是 Google 登入，登入完如果網址與同意都填好了就直接送。 */
import { GOOGLE_CLIENT_ID, ENDPOINT } from './config.js';
import { requestBody, viewFor, looksLikeUrl } from './core.js';
import { shareTarget } from './captions.js';
import { S, langKey } from './strings.js';

// 頁面的語言由 /share/、/en/share/、/ja/share/ 的 <html lang> 決定；靜態的字產生頁面時就填好了（tools/gen-share.mjs），
// 這裡只管會變的字。
const t = S[langKey(document.documentElement.lang)];
const GIS_LOCALE = { zh: 'zh_TW', en: 'en', ja: 'ja' }[langKey(document.documentElement.lang)];

let idToken = '';
let email = '';

const $ = (id) => document.getElementById(id);

function setNotice(code) {
  $('notice').hidden = !code;
  $('notice').textContent = code ? t.reasons[code] || t.reasons.unreachable : '';
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
    $('remaining-line').textContent = t.remaining.replace('{n}', next.remaining);
    $('deadline-line').textContent = next.deadline ? t.deadline.replace('{d}', next.deadline) : '';
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
  $('captions').setAttribute('aria-label', t.captionsLabel);
  t.captions.forEach((text, i) => {
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
  $('caption').value = t.captions[0];
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
      hint(t.hintAfter);
      return;
    }
    const target = shareTarget(button.dataset.share, text);
    // 先開視窗再做別的：手機瀏覽器只在使用者點擊的那一刻放行彈出視窗。
    if (target.url) window.open(target.url, '_blank', 'noopener');
    if (target.copy) {
      const copied = await copy(text);
      hint(copied ? t.hintCopied : t.hintCopyFailed);
    } else {
      hint(t.hintAfter);
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
      hint(t.hintNotUrl);
    }
  } catch {
    $('url').focus();
    hint(t.hintNoClipboard);
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

function start() {
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, use_fedcm_for_prompt: true });
  google.accounts.id.renderButton($('signin'),
    { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: GIS_LOCALE });
  show({ view: 'signed-out' });
}

// GIS 用 async 載入；module 可能比它先跑完。
if (window.google?.accounts?.id) start();
else document.querySelector('script[src*="gsi/client"]').addEventListener('load', start);
