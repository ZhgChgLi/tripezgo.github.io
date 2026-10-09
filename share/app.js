/* 分享換 Premium 活動頁：Google Sign-In → 後端（Apps Script）→ 畫面。判斷在 core.js。 */
import { GOOGLE_CLIENT_ID, ENDPOINT } from './config.js';
import { requestBody, viewFor, fitWithin } from './core.js';

const MAX_SIDE = 2048;
const REASONS = {
  'not-social-post': '上一張看起來不是社群貼文的截圖。請截整篇貼文，要看得到發文帳號。',
  'no-tripezgo': '上一張貼文的圖片裡看不到 TripEZGo 的畫面。只在文字提到不算，要附上 App 的截圖。',
};

let idToken = '';
let image = ''; // 壓縮後 JPEG 的 base64（不含 data: 前綴）

const $ = (id) => document.getElementById(id);

function show(next) {
  for (const el of document.querySelectorAll('[data-view]')) el.hidden = el.dataset.view !== next.view;
  $('account').hidden = !next.email;
  $('email').textContent = next.email || '';
  const section = document.querySelector(`[data-view="${next.view}"]`);
  const field = (name) => section && section.querySelector(`[data-field="${name}"]`);
  if (next.view === 'ready') {
    field('remaining').textContent = next.remaining;
    field('deadline').textContent = next.deadline;
    field('reason').hidden = !next.reason;
    field('reason').textContent = next.reason ? REASONS[next.reason] || REASONS['not-social-post'] : '';
  }
  if (next.view === 'issued') {
    field('code').textContent = next.code;
    field('redeem').href = next.redeemUrl;
  }
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

async function onCredential({ credential }) {
  idToken = credential;
  show({ view: 'loading' });
  show(viewFor(await call('status')));
}

/** 選的圖畫進 canvas、縮到長邊 2048、轉 JPEG；重新畫過一次，EXIF（含拍攝地點）也就不會送出去。 */
async function compress(file) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function refreshSubmit() {
  $('submit').disabled = !(image && $('consent').checked);
}

function clearUpload() {
  image = '';
  $('file').value = '';
  $('preview').hidden = true;
  refreshSubmit();
}

$('file').addEventListener('change', async () => {
  const file = $('file').files[0];
  image = '';
  $('preview').hidden = true;
  if (file) {
    const dataUrl = await compress(file);
    image = dataUrl.slice(dataUrl.indexOf(',') + 1);
    $('preview').src = dataUrl;
    $('preview').hidden = false;
  }
  refreshSubmit();
});
$('consent').addEventListener('change', refreshSubmit);

$('submit').addEventListener('click', async () => {
  const email = $('email').textContent;
  show({ view: 'loading', email });
  show(viewFor(await call('submit', { image, consent: $('consent').checked, lang: document.documentElement.lang })));
  clearUpload();
});

$('switch').addEventListener('click', () => {
  google.accounts.id.disableAutoSelect();
  idToken = '';
  clearUpload();
  show({ view: 'signed-out' });
});

function start() {
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, use_fedcm_for_prompt: true });
  google.accounts.id.renderButton($('signin'), { theme: 'outline', size: 'large', shape: 'pill' });
  show({ view: 'signed-out' });
}

// GIS 用 async 載入；module 可能比它先跑完。
if (window.google?.accounts?.id) start();
else document.querySelector('script[src*="gsi/client"]').addEventListener('load', start);
