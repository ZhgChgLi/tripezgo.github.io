/* 票 11：「複製成我的旅程」指向另一個網域；沒裝 App 寫剪貼簿、按鈕換成「前往下載」（場景 30）。 */
import { test, expect } from '@playwright/test';
import { dated, fakeCloudKit, recordOf, useConfig } from './fake-cloudkit.mjs';

const hash = new URL(dated.url).hash;

/** 把某個正式主機名的請求轉給本機測試伺服器——頁面以為自己在那個網域上。
 *  要在 setup（假 config／CloudKit）**之前**掛：Playwright 的 route 後掛的先比對。 */
async function serveAs(page, host) {
  await page.route('https://' + host + '/**', async (route) => {
    const u = new URL(route.request().url());
    /* 測試結束時首頁的圖片可能還在路上：那時 route 已經收掉了，錯誤不算數。 */
    try {
      const r = await route.fetch({ url: 'http://localhost:4173' + u.pathname });
      await route.fulfill({ status: r.status(), headers: r.headers(), body: await r.body() });
    } catch (err) { /* 頁面已經關了 */ }
  });
}

async function setup(page) {
  await useConfig(page);
  await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } } });
}

test('頁面在裸網域：按鈕指向 www（同一條 # 片段）', async ({ page }) => {
  await serveAs(page, 'tripezgo.com');
  await setup(page);
  await page.goto('https://tripezgo.com/trip/' + hash);
  await expect(page.getByTestId('copy-app')).toHaveText('複製成我的旅程');
  await expect(page.getByTestId('copy-app')).toHaveAttribute('href', 'https://www.tripezgo.com/trip/' + hash);
  await expect(page.getByTestId('copy-app-note')).toContainText('已經有 TripEZGo 會直接打開 App');
});

test('頁面在 www：按鈕指向裸網域', async ({ page }) => {
  await serveAs(page, 'www.tripezgo.com');
  await setup(page);
  await page.goto('https://www.tripezgo.com/trip/' + hash);
  await expect(page.getByTestId('copy-app')).toHaveAttribute('href', 'https://tripezgo.com/trip/' + hash);
});

test('沒裝 App：按下寫剪貼簿、照 href 走；被 www 帶回來之後按鈕換成「前往下載」', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await serveAs(page, 'tripezgo.com');
  await setup(page);
  /* www 的 GitHub Pages：301 到裸網域（Location 沒有 #，瀏覽器帶著原本的片段走） */
  const wwwHits = [];
  await page.route('https://www.tripezgo.com/**', (route) => {
    wwwHits.push(route.request().url());
    return route.fulfill({ status: 301, headers: { location: 'https://tripezgo.com/trip/' } });
  });
  await page.goto('https://tripezgo.com/trip/' + hash);
  await page.getByTestId('copy-app').click();
  await expect(page.getByTestId('copy-app')).toHaveText('前往下載');
  expect(wwwHits).toHaveLength(1);
  expect(page.url()).toBe('https://tripezgo.com/trip/' + hash);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dated.url);
  await expect(page.getByTestId('copy-app-note')).toContainText('連結已經存起來了');
  /* App 還沒上架：跟 join/ 一樣先去首頁 */
  await expect(page.getByTestId('copy-app')).toHaveAttribute('href', '/');

  await page.locator('[data-lang="en"]').click();
  await expect(page.getByTestId('copy-app')).toHaveText('Go to the download');
  await expect(page.getByTestId('copy-app')).toHaveAttribute('href', '/en/');
  await page.locator('[data-lang="zh"]').click();

  /* 第二下：再寫一次剪貼簿，然後去下載 */
  await page.evaluate(() => navigator.clipboard.writeText('something else'));
  await page.getByTestId('copy-app').click();
  await page.waitForURL('https://tripezgo.com/');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dated.url);
});

test('本機測試伺服器上也指向 www', async ({ page }) => {
  await setup(page);
  await page.goto('/trip/' + hash);
  await expect(page.getByTestId('copy-app')).toHaveAttribute('href', 'https://www.tripezgo.com/trip/' + hash);
});
