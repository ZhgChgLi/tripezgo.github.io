/* 兩個值都不是密鑰：client ID 與 web app 網址本來就會出現在送給瀏覽器的頁面裡。
 * 安全靠後端驗 ID token（aud 要是這個 client），不靠網址沒人知道。 */
export const GOOGLE_CLIENT_ID = '705023622082-3s6a4v7o71t3fg015658h6qpt6o2pqq6.apps.googleusercontent.com';

// Apps Script web app（App repo 的 tools/share-reward/gas/，以擁有者身分執行、任何人可呼叫）。
export const ENDPOINT =
  'https://script.google.com/macros/s/AKfycbyHdox4XNHc4qQZR9I0wPcnbebDY6abgIqvupk4rXYWfilvJX8itbEuCPpn6eUctJSo/exec';
