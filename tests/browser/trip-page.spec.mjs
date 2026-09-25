/* 票 04：公開頁讀得到——載入中、正常、日期未定、失效、網址殘缺、三語（場景 28、32）。 */
import { test, expect } from '@playwright/test';
import { dated, undated, fakeCloudKit, pathOf, recordOf, useConfig } from './fake-cloudkit.mjs';

test('載入中：查 record 的時候先佔好版面，回來之後原地換上', async ({ page }) => {
  await useConfig(page);
  const ck = await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } }, hold: true });
  await page.goto(pathOf(dated));
  await expect(page.getByTestId('loading')).toBeVisible();
  await expect(page.getByTestId('loading')).toContainText('正在打開這趟行程');
  ck.release();
  await expect(page.getByTestId('trip')).toBeVisible();
  await expect(page.getByTestId('loading')).toHaveCount(0);
});

test('正常：抬頭、時間表、全日橫條、路程標籤', async ({ page }) => {
  await useConfig(page);
  const ck = await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } } });
  await page.goto(pathOf(dated));
  await expect(page.locator('h1')).toHaveText('沖繩・慢活潛水');
  await expect(page).toHaveTitle('沖繩・慢活潛水 · TripEZGo');
  await expect(page.getByTestId('dates')).toContainText('7/30（四） – 8/1（六）');
  await expect(page.getByTestId('day-count')).toContainText('3 天');
  await expect(page.getByTestId('place')).toHaveText('沖繩・那霸');
  /* 2026-09-24T13:45:00Z 在台北是 21:45 */
  await expect(page.getByTestId('updated')).toHaveText('最後更新 9/24（四） 21:45');
  await expect(page.locator('.tl-day')).toHaveCount(3);
  await expect(page.getByTestId('day-1')).toContainText('第 1 天7/30（四）');
  await expect(page.getByTestId('day-1')).toContainText('台北 → 那霸');
  await expect(page.getByTestId('day-2')).toContainText('屋台村・宵夜');
  await expect(page.getByTestId('day-3')).toContainText('這一天還沒有安排。');
  await expect(page.getByTestId('allday')).toHaveText('租車（OTS 那霸店）');
  /* 路程：開車 40 分（國際通前面那一段）；空檔（mode null）不畫標籤 */
  await expect(page.getByTestId('leg')).toHaveCount(2);
  await expect(page.getByTestId('leg').first()).toContainText('開車 · 40 分');
  await expect(page.getByTestId('leg').nth(1)).toContainText('步行 · 12 分');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  /* 匿名、只打 public database、Production 先 */
  expect(ck.calls[0]).toMatchObject({ env: 'production', path: 'records/lookup', apiToken: 'prod-token', webAuthToken: null });
  expect(ck.calls[0].container).toBe('iCloud.com.zhgchgli.tripezgo');
  expect(ck.calls[0].body).toEqual({ records: [{ recordName: dated.recordName }] });
});

test('Production 查不到就查 Development（debug build 寫的連結）', async ({ page }) => {
  await useConfig(page);
  const ck = await fakeCloudKit(page, { stores: { development: { [dated.recordName]: recordOf(dated) } } });
  await page.goto(pathOf(dated));
  await expect(page.locator('h1')).toHaveText('沖繩・慢活潛水');
  expect(ck.calls.map((c) => c.env)).toEqual(['production', 'development']);
});

test('沒有 token 的環境跳過：正式設定裡 Production 還沒有 token', async ({ page }) => {
  const ck = await fakeCloudKit(page, { stores: { development: { [dated.recordName]: recordOf(dated) } } });
  await page.goto(pathOf(dated));
  await expect(page.locator('h1')).toHaveText('沖繩・慢活潛水');
  expect(ck.calls.map((c) => c.env)).toEqual(['development']);
});

test('日期未定：欄頭只寫「第 N 天」、抬頭寫「日期未定」、沒有目的地就不寫', async ({ page }) => {
  await useConfig(page);
  await fakeCloudKit(page, { stores: { production: { [undated.recordName]: recordOf(undated) } } });
  await page.goto(pathOf(undated));
  await expect(page.locator('h1')).toHaveText('京都五日');
  await expect(page.getByTestId('dates')).toHaveText('日期未定');
  await expect(page.getByTestId('day-count')).toContainText('2 天');
  await expect(page.getByTestId('place')).toHaveCount(0);
  await expect(page.getByTestId('day-1').locator('.tl-hd')).toHaveText('第 1 天');
  await expect(page.getByTestId('day-2').locator('.tl-hd')).toHaveText('第 2 天');
});

test('失效：兩個環境都說沒有這一筆', async ({ page }) => {
  await useConfig(page);
  await fakeCloudKit(page, { stores: {} });
  await page.goto(pathOf(dated));
  await expect(page.getByTestId('gone')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('讀不到這趟行程');
  await expect(page.getByTestId('gone').locator('a')).toHaveAttribute('href', '/');
});

test('網址殘缺：沒有金鑰就不打 API', async ({ page }) => {
  await useConfig(page);
  const ck = await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } } });
  await page.goto('/trip/#' + dated.recordName);
  await expect(page.getByTestId('bad')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('這條連結不完整');
  expect(ck.calls).toHaveLength(0);
});

test('網址殘缺：金鑰被截掉一段', async ({ page }) => {
  await useConfig(page);
  const ck = await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } } });
  await page.goto(pathOf(dated).slice(0, -5));
  await expect(page.getByTestId('bad')).toBeVisible();
  expect(ck.calls).toHaveLength(0);
});

test('解不開：record 在，但金鑰不對', async ({ page }) => {
  await useConfig(page);
  await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } } });
  const otherKey = new URL(undated.url).hash.split('.')[1];
  await page.goto('/trip/#' + dated.recordName + '.' + otherKey);
  await expect(page.getByTestId('bad')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('這條連結不完整');
});

test('三語切換：字典、日期寫法、語言記住', async ({ page }) => {
  await useConfig(page);
  await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } } });
  await page.goto(pathOf(dated));
  await expect(page.getByTestId('day-count')).toContainText('3 天');

  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('dates')).toContainText('Thu 7/30 – Sat 8/1');
  await expect(page.getByTestId('day-count')).toContainText('3 days');
  await expect(page.getByTestId('updated')).toHaveText('Last updated Thu 9/24 21:45');
  await expect(page.getByTestId('day-1').locator('.tl-hd')).toContainText('Day 1');
  await expect(page.getByTestId('leg').first()).toContainText('Driving · 40 min');

  await page.locator('[data-lang="ja"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByTestId('dates')).toContainText('7/30（木） – 8/1（土）');
  await expect(page.getByTestId('day-count')).toContainText('3 日間');
  await expect(page.getByTestId('day-1').locator('.tl-hd')).toContainText('1 日目');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});

test('失效畫面也跟著語言走', async ({ page }) => {
  await useConfig(page);
  await fakeCloudKit(page, { stores: {} });
  await page.goto(pathOf(dated));
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('h1')).toHaveText('This trip could not be loaded');
  await expect(page.getByTestId('gone').locator('a')).toHaveAttribute('href', '/en/');
});
