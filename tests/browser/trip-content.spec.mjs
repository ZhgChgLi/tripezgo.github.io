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

/* 地圖在第二個 tab（使用者決定 2026-09-26：行事曆／地圖兩個 tab）。 */
async function showMap(page) {
  await page.locator('[data-view="map"]').click();
  await expect(page.getByTestId('map-section')).toBeVisible();
}

test('兩個 tab：預設行事曆，地圖藏著；切到地圖換成地圖、行事曆藏起來；切語言不跳回', async ({ page }) => {
  await open(page, dated);
  const tabs = page.getByTestId('view-tabs');
  await expect(tabs.getByRole('tab')).toHaveText(['行事曆', '地圖']);
  await expect(page.locator('[data-view="cal"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#timeline')).toBeVisible();
  await expect(page.getByTestId('map-section')).toHaveCount(0);

  await page.locator('[data-view="map"]').click();
  await expect(page.locator('[data-view="map"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('map-section')).toBeVisible();
  await expect(page.locator('#timeline')).toHaveCount(0);

  await page.locator('[data-lang="en"]').click();
  await expect(tabs.getByRole('tab')).toHaveText(['Schedule', 'Map']);
  await expect(page.getByTestId('map-section')).toBeVisible();

  await page.locator('[data-view="cal"]').click();
  await expect(page.locator('#timeline')).toBeVisible();
  await expect(page.getByTestId('map-section')).toHaveCount(0);
});

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
  await showMap(page);
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

test('地圖夠高；全螢幕鈕：按了佔滿視窗、切天還在全螢幕、Esc 或再按一次回來', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fakeMapKit(page);
  await open(page, dated, { mapkitToken: 'test-mapkit-jwt' });
  await showMap(page);
  const map = page.getByTestId('map');
  expect((await map.boundingBox()).height).toBeGreaterThanOrEqual(480);

  const full = page.getByTestId('map-full');
  await expect(full).toHaveAttribute('aria-label', '全螢幕');
  await full.click();
  await expect(page.getByTestId('map-wrap')).toHaveCSS('position', 'fixed');
  const box = await map.boundingBox();
  expect(box.width).toBeGreaterThan(1200);
  expect(box.height).toBeGreaterThan(700);
  await expect(page.getByTestId('map-full')).toHaveAttribute('aria-label', '結束全螢幕');

  await page.locator('[data-mday="2"]').click();
  await expect(page.getByTestId('map-wrap')).toHaveCSS('position', 'fixed');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('map-wrap')).not.toHaveCSS('position', 'fixed');

  await page.getByTestId('map-full').click();
  await page.getByTestId('map-full').click();
  await expect(page.getByTestId('map-wrap')).not.toHaveCSS('position', 'fixed');
});

test('類型圖示與色族照 App 的規則：挑過的圖示 → 圖示那一族；認不得的名字 → 通用圖釘＋雜項', async ({ page }) => {
  await open(page, dated);
  await showMap(page);
  await page.locator('[data-mday="2"]').click();
  const rows = page.getByTestId('map-row');
  /* 青之洞窟：icon swimming、swatch "sea"（不是一個色族）→ 退回 swimming 那一族 seeNature */
  await expect(rows.nth(0).locator('svg.ty')).toHaveAttribute('data-icon', 'swimming');
  await expect(rows.nth(0)).toHaveAttribute('style', /--sw-seeNature/);
  /* 屋台村：類型「餐廳」不是內建 key → marker、misc */
  await expect(rows.nth(1).locator('svg.ty')).toHaveAttribute('data-icon', 'marker');
  await expect(rows.nth(1)).toHaveAttribute('style', /--sw-misc/);
});

test('有 MapKit token：鏡頭對準當天第一個點、底部只列沒地點的、點之間連線並標路程（照 App）', async ({ page }) => {
  await fakeMapKit(page);
  await open(page, dated, { mapkitToken: 'test-mapkit-jwt' });
  await showMap(page);
  /* 第 1 天：只有國際通有座標 → 鏡頭對準它、50 公里見方；航班與租車沒地點 → 列在底下 */
  await expect.poll(() => page.evaluate(() => window.__mk && window.__mk.region())).toEqual(
    expect.objectContaining({ lat: 26.2153, lng: 127.6856 }));
  const dLat = await page.evaluate(() => window.__mk.region().dLat);
  expect(dLat).toBeCloseTo(50000 / 111320, 3);
  const rows = page.getByTestId('map-row');
  await expect(rows).toHaveText([/租車（OTS 那霸店）/, /台北 → 那霸/]);
  await expect(rows.nth(0)).toContainText('全日');
  await expect(rows.nth(1)).toContainText('11:00');
  await expect(page.getByTestId('map-list-head')).toHaveText('沒有地點的行程');
  expect(await page.evaluate(() => window.__mk.lines())).toEqual([]);

  /* 第 2 天：兩個點連一條實線，線上標「步行 · 12 分」；沒有沒地點的 → 不列 */
  await page.locator('[data-mday="2"]').click();
  /* 線的樣式跟 App 的步行導航一樣（WalkingRouteRenderer 的魚骨線）：6pt、tzWalkingRoute、0.85 */
  await expect.poll(() => page.evaluate(() => window.__mk && window.__mk.lines())).toEqual([
    { points: [[26.4447, 127.7716], [26.215, 127.689]], dashed: false, width: 6, color: '#5cc6c3', opacity: 0.85 },
  ]);
  /* 箭頭：沿線每 40 個螢幕點一個、第一個在 20 點，都朝行進方向（往下偏左） */
  const chev = await page.evaluate(() => window.__mk.chevrons());
  expect(chev.length).toBeGreaterThan(3);
  const box = await page.getByTestId('map').boundingBox();
  const start = { x: box.x + (127.7716 - 127.6) * 2000, y: box.y + (26.5 - 26.4447) * 2000 };
  const d = chev.map((c) => Math.hypot(c.x - start.x, c.y - start.y)).sort((a, b) => a - b);
  expect(d[0]).toBeCloseTo(20, 0);
  expect(d[1] - d[0]).toBeCloseTo(40, 0);
  const angle = Math.atan2((26.4447 - 26.215) * 2000, (127.689 - 127.7716) * 2000) * 180 / Math.PI;
  for (const c of chev) {
    expect(c.x).toBeGreaterThanOrEqual(box.x - 10);
    expect(c.y).toBeLessThanOrEqual(box.y + box.height + 10);
    expect(c.turn).toBe('rotate(' + angle.toFixed(2) + 'deg)');
  }
  const labels = await page.evaluate(() => window.__mk.labels());
  expect(labels).toHaveLength(1);
  expect(labels[0].text).toContain('步行');
  expect(labels[0].text).toContain('12 分');
  expect(labels[0].lat).toBeCloseTo((26.4447 + 26.215) / 2, 4);
  await expect(page.getByTestId('map-row')).toHaveCount(0);
  await expect(page.getByTestId('map-list-head')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__mk && window.__mk.region())).toEqual(
    expect.objectContaining({ lat: 26.4447, lng: 127.7716 }));
});

test('有 MapKit token：一次畫一天的點，類型色＋當天順序號，切天換點', async ({ page }) => {
  const mk = await fakeMapKit(page);
  await open(page, dated, { mapkitToken: 'test-mapkit-jwt' });
  await showMap(page);
  await expect(page.getByTestId('map')).toHaveAttribute('data-fake-map', '1');
  expect(await page.evaluate(() => window.__mk.token)).toBe('test-mapkit-jwt');
  await expect.poll(() => page.evaluate(() => window.__mk && window.__mk.current())).toEqual([
    expect.objectContaining({ glyph: '1', title: '國際通・散策', lat: 26.2153, lng: 127.6856 }),
  ]);
  await page.locator('[data-mday="2"]').click();
  await expect.poll(() => page.evaluate(() => ((window.__mk && window.__mk.current()) || []).map((a) => a.glyph + ' ' + a.title))).toEqual([
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
  await showMap(page);
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
