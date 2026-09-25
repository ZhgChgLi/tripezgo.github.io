/* 公開連結頁的設定。**這裡的東西本來就是公開的**：API token 只做得到 security roles 允許
 * `_world`（讀）與登入者（`_creator` 刪自己的）做的事；MapKit JS token 限定網站的 origin。
 *
 * ## 環境：先 Production，再 Development
 *
 * 同一條連結可能寫在兩個 CloudKit 環境裡的其中一個，取決於**發佈它的那一份 App 是怎麼裝的**：
 *   - TestFlight／App Store 的 build 寫 **Production**
 *   - 從 Xcode 按 Run 的 debug build 寫 **Development**
 * 網址上看不出是哪一個（recordName 是 128-bit 亂數，兩邊不會撞），所以依序查：Production 先，
 * 查不到（NOT_FOUND）再查 Development。**沒有 token 的環境直接跳過**——Production 的 API token
 * 要在 CloudKit Console 建好之後填進來（spec › Further Notes：上線前的使用者步驟）。
 *
 * 每一把 API token 的「Sign in Callback」要在 Console 設成 URL Redirect，指回
 * `https://tripezgo.com/trip/`——作者在網頁上登入、停止分享要靠它（票 13）。
 */
export const CONFIG = {
  container: 'iCloud.com.zhgchgli.tripezgo',
  environments: [
    { name: 'production', apiToken: '' },
    { name: 'development', apiToken: '95c27dadedb8f40f5c0ad9bbdfe58d5f2d2241fffb04dad08dcfef77d19c76af' },
  ],
  /* MapKit JS 的 JWT（開發者帳號上的 MapKit JS key 簽的、origin 限 tripezgo.com 與 www）。
   * 空字串＝沒有地圖：時間表下面只列清單，其他照常。 */
  mapkitToken: '',
};
