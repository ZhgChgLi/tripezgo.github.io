/* 分享活動頁的各平台分享入口。現成文案在 strings.js（三語，每一則都帶 tripezgo.com）。 */

export const SITE_URL = 'https://tripezgo.com/';

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
