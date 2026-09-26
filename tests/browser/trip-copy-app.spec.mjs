/* 「在 TripEZGo 建立這個旅程」與加入共享：一個共用的跳轉頁 /open/（使用者要求 2026-09-26）。
 *
 * 已裝 App：按鈕是一條 www 的 Universal Link，直接進 App。
 * 沒裝：www 301 回裸網域，公開頁看到 ?open=1、加入頁（/join/）一律，轉去 /open/#<正式連結>；
 * 那一頁第一下把正式連結存進剪貼簿，第二下去下載。 */
import { test, expect } from '@playwright/test';
import { dated, fakeCloudKit, recordOf, useConfig } from './fake-cloudkit.mjs';

const hash = new URL(dated.url).hash;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const JOIN = 'https://www.tripezgo.com/join/#aHR0cHM6Ly93d3cuaWNsb3VkLmNvbS9zaGFyZS8wQUJjZF9FRi1naA';

/** 把某個正式主機名的請求轉給本機測試伺服器——頁面以為自己在那個網域上。
 *  要在 setup（假 config／CloudKit）**之前**掛：Playwright 的 route 後掛的先比對。 */
async function serveAs(page, host) {
  await page.route('https://' + host + '/**', async (route) => {
    const u = new URL(route.request().url());
    try {
      const r = await route.fetch({ url: 'http://localhost:4173' + u.pathname + u.search });
      await route.fulfill({ status: r.status(), headers: r.headers(), body: await r.body() });
    } catch (err) { /* 頁面已經關了 */ }
  });
}

/** www 的 GitHub Pages：301 到裸網域，路徑與查詢字串照帶（2026-09-26 用 curl 量過），片段由瀏覽器帶著走。 */
async function wwwRedirects(page) {
  const hits = [];
  await page.route('https://www.tripezgo.com/**', (route) => {
    const u = new URL(route.request().url());
    hits.push(u.pathname + u.search);
    return route.fulfill({ status: 301, headers: { location: 'https://tripezgo.com' + u.pathname + u.search } });
  });
  return hits;
}

async function setup(page) {
  await useConfig(page);
  await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } } });
}

test('按鈕：「在 TripEZGo 建立這個旅程」與「複製」靠右；指向 www 的 Universal Link；說明那一段拿掉了', async ({ page }) => {
  await serveAs(page, 'tripezgo.com');
  await setup(page);
  await page.goto('https://tripezgo.com/trip/' + hash);
  const app = page.getByTestId('copy-app');
  await expect(app).toHaveText('在 TripEZGo 建立這個旅程');
  await expect(app).toHaveAttribute('href', 'https://www.tripezgo.com/trip/?open=1' + hash);
  await expect(page.getByTestId('copy-text')).toHaveText('複製');
  await expect(page.getByTestId('copy-app-note')).toHaveCount(0);
  await expect(page.locator('.acts')).toHaveCSS('justify-content', 'flex-end');
  const acts = await page.locator('.acts').boundingBox();
  const text = await page.getByTestId('copy-text').boundingBox();
  expect(Math.abs(acts.x + acts.width - (text.x + text.width))).toBeLessThan(2);
  await expect(page.locator('body')).not.toContainText('開著就看得到，不需要安裝 App');
});

test('頁面在 www：按鈕指向裸網域', async ({ page }) => {
  await serveAs(page, 'www.tripezgo.com');
  await setup(page);
  await page.goto('https://www.tripezgo.com/trip/' + hash);
  await expect(page.getByTestId('copy-app')).toHaveAttribute('href', 'https://tripezgo.com/trip/?open=1' + hash);
});

test.describe('iPhone、沒裝 App', () => {
  test.use({ userAgent: IPHONE });

  test('建立這個旅程：www 301 回來 → 轉到 /open/；第一下存正式連結、第二下去下載', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await serveAs(page, 'tripezgo.com');
    await setup(page);
    const hits = await wwwRedirects(page);
    await page.goto('https://tripezgo.com/trip/' + hash);
    await page.getByTestId('copy-app').click();
    await page.waitForURL('https://tripezgo.com/open/**');
    expect(hits).toEqual(['/trip/?open=1']);
    expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe(dated.url);
    await expect(page.getByTestId('open-kind')).toHaveText('公開旅程');
    /* 頁首頁尾跟首頁同一份 */
    await expect(page.locator('footer.site-footer')).toContainText('旅行規劃、快樂出行，一次搞定。');
    await expect(page.locator('header.site-header .brand')).toHaveAttribute('href', '/');
    await expect(page.getByTestId('open-app')).toHaveAttribute('href', dated.url);

    const get = page.getByTestId('open-get');
    await expect(get).toHaveText('取得 TripEZGo');
    await get.click();
    await expect(get).toHaveText('前往下載');
    await expect(page.locator('h1')).toHaveText('連結已經存起來了');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dated.url);
    await get.click();
    await page.waitForURL('https://tripezgo.com/');
  });

  test('加入共享：/join/ 轉到同一頁，存的是那條邀請連結', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await serveAs(page, 'tripezgo.com');
    await page.goto('https://tripezgo.com/join/' + new URL(JOIN).hash);
    await page.waitForURL('https://tripezgo.com/open/**');
    await expect(page.getByTestId('open-kind')).toHaveText('旅程邀請');
    await expect(page.getByTestId('open-app')).toHaveAttribute('href', JOIN);
    await page.getByTestId('open-get').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(JOIN);
  });
});

test('/open/ 不是誰都能用的轉址器：不是我們的連結就說不完整', async ({ page }) => {
  await serveAs(page, 'tripezgo.com');
  await page.goto('https://tripezgo.com/open/#' + encodeURIComponent('https://evil.example/trip/#x'));
  await expect(page.locator('h1')).toHaveText('這條連結不完整');
  await expect(page.getByTestId('open-app')).toBeHidden();
});

test('本機測試伺服器上也指向 www', async ({ page }) => {
  await setup(page);
  await page.goto('/trip/' + hash);
  await expect(page.getByTestId('copy-app')).toHaveAttribute('href', 'https://www.tripezgo.com/trip/?open=1' + hash);
});
