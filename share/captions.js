/* 分享活動頁的現成文案與各平台的分享入口。
 * 每一則都帶 tripezgo.com：後端只認 tripezgo.com 或 App Store 連結（只寫名字不算），照著發就一定過。
 * 內容只講首頁寫過的事（行事曆排行程、交通時間軸、地圖、多人共筆、離線、免費開始），不提評分或評論。 */

export const SITE_URL = 'https://tripezgo.com/';

export const CAPTIONS = [
  '下一趟旅行的行程，我都排在 TripEZGo 裡：行程放行事曆、交通排時間軸，地圖、待辦、筆記都跟著這一趟走，沒有網路也看得到。\n👉 tripezgo.com\n#TripEZGo #旅行規劃',
  '排行程終於不用再開表格自己算時間了。TripEZGo 把每天的行程、路程和票券收在同一個 App，還能跟旅伴一起編。\ntripezgo.com',
  '出發前一晚不用再整理 Excel 了 😂 這次用 TripEZGo 一天一天把行程拉好，地圖上看得到每天怎麼走。\ntripezgo.com #旅行規劃',
  '推一個 iPhone／iPad 上的旅行規劃 App：TripEZGo。行事曆排行程、地圖看每日路線、多人共筆，免費就能開始。\ntripezgo.com',
];

/** 平台 → 要開的網址，以及要不要先把文案複製起來（那個平台的分享入口帶不進文字）。 */
export function shareTarget(platform, text) {
  const enc = encodeURIComponent(text);
  switch (platform) {
    case 'x': return { url: 'https://x.com/intent/post?text=' + enc, copy: false };
    case 'threads': return { url: 'https://www.threads.net/intent/post?text=' + enc, copy: false };
    case 'bluesky': return { url: 'https://bsky.app/intent/compose?text=' + enc, copy: false };
    case 'plurk': return { url: 'https://www.plurk.com/?qualifier=shares&status=' + enc, copy: false };
    case 'facebook': return { url: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SITE_URL), copy: true };
    default: return { url: '', copy: true };
  }
}
