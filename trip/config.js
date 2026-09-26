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
  /* MapKit JS 的 JWT：key TX7KT74NAS（team UGFKKJS5G7）簽的，origin 限 https://tripezgo.com
   * （www 會 301 到裸網域，頁面只在這裡跑）。**2027-09-26 到期**——到期前用同一把 key 重簽一次換掉。
   * 空字串＝沒有地圖：地圖 tab 只列清單，其他照常。 */
  mapkitToken: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IlRYN0tUNzROQVMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJVR0ZLS0pTNUc3IiwiaWF0IjoxNzkwMzkyMTY0LCJleHAiOjE4MjE5MjgxNjQsIm9yaWdpbiI6Imh0dHBzOi8vdHJpcGV6Z28uY29tIn0.0wYLY4RlteghM1nSma0UwZBp_gBNWJH8LkCj4SnVjDlDgZ96w28sRemz4ojRSaGgeV5MlAhWH-evadfLAi2dYQ',
};
