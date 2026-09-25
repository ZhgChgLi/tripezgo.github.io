/* 票 12：封面、地圖（一次一天）、地點卡、複製純文字（場景 29、32）。 */
import { test, expect } from '@playwright/test';
import { dated, undated, fakeCloudKit, pathOf, recordOf, useConfig } from './fake-cloudkit.mjs';
import { fakeMapKit } from './fake-mapkit.mjs';

async function open(page, c, config = {}) {
  await useConfig(page, config);
  await fakeCloudKit(page, { stores: { production: { [c.recordName]: recordOf(c) } } });
  await page.goto(pathOf(c));
  await expect(page.locator('h1')).toHaveText(c.plaintext.trip.name);
}

test('封面：在標題上面，是公開版本裡那張 JPEG', async ({ page }) => {
  await open(page, dated);
  const cover = page.getByTestId('cover');
  await expect(cover).toBeVisible();
  const bg = await cover.evaluate((el) => el.style.backgroundImage);
  expect(bg).toContain('data:image/jpeg;base64,' + dated.plaintext.trip.cover);
  const coverBox = await cover.boundingBox();
  const titleBox = await page.locator('h1').boundingBox();
  expect(coverBox.y + coverBox.height).toBeLessThanOrEqual(titleBox.y);
});

test('沒有封面就不佔位', async ({ page }) => {
  await open(page, undated);
  await expect(page.getByTestId('cover')).toHaveCount(0);
});

test('沒有 MapKit token：沒有地圖框、不載 MapKit，清單照列、切天照切', async ({ page }) => {
  const mk = await fakeMapKit(page);
  await open(page, dated);
  await expect(page.getByTestId('map-section')).toBeVisible();
  await expect(page.getByTestId('map')).toHaveCount(0);
  const rows = page.getByTestId('map-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('–');
  await expect(rows.nth(0)).toContainText('台北 → 那霸');
  await expect(rows.nth(0)).toContainText('沒有座標，不在地圖上');
  await expect(rows.nth(1).locator('.no')).toHaveText('1');
  await expect(rows.nth(1)).toContainText('16:00');

  await page.locator('[data-mday="2"]').click();
  await expect(page.locator('[data-mday="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('青之洞窟浮潛');
  await expect(rows.nth(1).locator('.no')).toHaveText('2');
  await expect(rows.nth(1)).toContainText('屋台村・宵夜');

  await page.locator('[data-mday="3"]').click();
  await expect(rows).toHaveCount(0);
  await expect(page.getByTestId('map-section')).toContainText('這一天沒有標了位置的行程。');
  expect(mk.requests).toHaveLength(0);
});

test('類型圖示與色族照 App 的規則：挑過的圖示 → 圖示那一族；認不得的名字 → 通用圖釘＋雜項', async ({ page }) => {
  await open(page, dated);
  await page.locator('[data-mday="2"]').click();
  const rows = page.getByTestId('map-row');
  /* 青之洞窟：icon swimming、swatch "sea"（不是一個色族）→ 退回 swimming 那一族 seeNature */
  await expect(rows.nth(0).locator('svg.ty')).toHaveAttribute('data-icon', 'swimming');
  await expect(rows.nth(0)).toHaveAttribute('style', /--sw-seeNature/);
  /* 屋台村：類型「餐廳」不是內建 key → marker、misc */
  await expect(rows.nth(1).locator('svg.ty')).toHaveAttribute('data-icon', 'marker');
  await expect(rows.nth(1)).toHaveAttribute('style', /--sw-misc/);
});

test('有 MapKit token：一次畫一天的點，類型色＋當天順序號，切天換點', async ({ page }) => {
  const mk = await fakeMapKit(page);
  await open(page, dated, { mapkitToken: 'test-mapkit-jwt' });
  await expect(page.getByTestId('map')).toHaveAttribute('data-fake-map', '1');
  expect(await page.evaluate(() => window.__mk.token)).toBe('test-mapkit-jwt');
  await expect.poll(() => page.evaluate(() => window.__mk.current())).toEqual([
    expect.objectContaining({ glyph: '1', title: '國際通・散策', lat: 26.2153, lng: 127.6856 }),
  ]);
  await page.locator('[data-mday="2"]').click();
  await expect.poll(() => page.evaluate(() => window.__mk.current().map((a) => a.glyph + ' ' + a.title))).toEqual([
    '1 青之洞窟浮潛',
    '2 屋台村・宵夜',
  ]);
  const colors = await page.evaluate(() => window.__mk.current().map((a) => a.color));
  expect(colors[0]).not.toEqual(colors[1]); /* seeNature 對 misc */
  expect(mk.requests.length).toBe(1);

  /* 點地圖上的點 → 地點卡 */
  await page.evaluate(() => window.__mk.select(1));
  await expect(page.getByTestId('place-card')).toContainText('屋台村・宵夜');
});

test('地點卡：有座標的兩顆鈕帶座標；點時間表的方塊也開得了', async ({ page }) => {
  await open(page, dated);
  await page.locator('.tl-ev', { hasText: '國際通・散策' }).click();
  const card = page.getByTestId('place-card');
  await expect(card).toBeVisible();
  await expect(card.locator('h3')).toHaveText('國際通・散策');
  await expect(card).toContainText('第 1 天 · 16:00–18:00');
  await expect(card.locator('.loc')).toHaveText('那霸市');
  await expect(page.getByTestId('open-apple')).toHaveAttribute('href',
    'https://maps.apple.com/?ll=26.2153,127.6856&q=' + encodeURIComponent('國際通・散策'));
  await expect(page.getByTestId('open-google')).toHaveAttribute('href',
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('26.2153,127.6856'));
  await expect(page.getByTestId('open-apple')).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: '關閉' }).click();
  await expect(card).toHaveCount(0);
});

test('地點卡：沒有座標就用地點名稱查；Esc 關掉', async ({ page }) => {
  await open(page, dated);
  await page.getByTestId('map-row').first().click();
  await expect(page.getByTestId('open-apple')).toHaveAttribute('href', 'https://maps.apple.com/?q=' + encodeURIComponent('桃園 T1 · CI120'));
  await expect(page.getByTestId('open-google')).toHaveAttribute('href',
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('桃園 T1 · CI120'));
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('place-card')).toHaveCount(0);
});

test('複製純文字行程：toast，剪貼簿裡跟 App 的純文字逐字相同，跟著語言走', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, dated);
  await page.getByTestId('copy-text').click();
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('已複製純文字行程，貼進訊息或 LINE 就能讀');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dated.plainText.zh);

  await page.locator('[data-lang="ja"]').click();
  await page.getByTestId('copy-text').click();
  await expect(page.locator('#toast')).toContainText('旅程をテキストでコピーしました');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dated.plainText.ja);

  await page.locator('[data-lang="en"]').click();
  await page.getByTestId('copy-text').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dated.plainText.en);
});

test('日期未定的純文字也逐字相同', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, undated);
  await page.getByTestId('copy-text').click();
  await expect(page.locator('#toast')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(undated.plainText.zh);
});
