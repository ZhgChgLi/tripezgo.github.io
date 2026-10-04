/* 旅程時區（使用者裁定 2026-10-05：公開連結要帶旅程時區，兩邊一致）。
 * 時間欄照 App 的規則；App 的「手機時區」在網頁上是瀏覽器的時區（Playwright 的 `timezoneId`）。 */
import { test, expect } from '@playwright/test';
import { base64Encode, parseFragment } from '../../trip/core.js';
import { dated, undated, fakeCloudKit, pathOf, recordOf, useConfig } from './fake-cloudkit.mjs';

async function open(page, c) {
  await useConfig(page);
  await fakeCloudKit(page, { stores: { production: { [c.recordName]: recordOf(c) } } });
  await page.goto(pathOf(c));
  await expect(page.locator('h1')).toHaveText(c.plaintext.trip.name);
}

/** 黃金檔 dated 的明文改一改、用它自己的金鑰重新封起來——舊連結（沒有 tz）、別的旅程時區。 */
async function variant(edit) {
  const plaintext = structuredClone(dated.plaintext);
  edit(plaintext);
  const { key } = parseFragment(new URL(dated.url).hash);
  const iv = new Uint8Array(12).fill(3);
  const aes = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 }, aes, new TextEncoder().encode(JSON.stringify(plaintext))
  ));
  const payload = new Uint8Array(iv.length + sealed.length);
  payload.set(iv, 0);
  payload.set(sealed, iv.length);
  return { ...dated, plaintext, record: { ...dated.record, payload: base64Encode(payload) } };
}

const phoneClocks = (page) => page.getByTestId('phone-clock').allTextContents();

test.describe('瀏覽器在台北、旅程在東京', () => {
  test('時間表上方一格說明；每個整點底下疊一行觀看者的時刻，跨過午夜掛 +1', async ({ page }) => {
    await open(page, dated);
    await expect(page.getByTestId('zone-note')).toHaveText('目前為日本時間，與裝置時間差 +1 小時');
    await expect(page.getByTestId('zone-note').locator('b')).toHaveText(['日本時間', '+1 小時']);
    const clocks = await phoneClocks(page);
    expect(clocks[0]).toBe('08:00'); /* 東京 09:00 */
    expect(clocks).toContain('23:00'); /* 東京 24:00 */
    expect(clocks).toContain('00:00+1'); /* 東京隔天 01:00 */
    /* 半小時的刻度不疊 */
    const hourLabels = await page.locator('.tl-hr:not(.is-half)').count();
    expect(clocks.length).toBe(hourLabels);
    await expect(page.locator('.tl-hr.is-half .ph')).toHaveCount(0);
  });

  test('三語', async ({ page }) => {
    await open(page, dated);
    await page.locator('[data-lang="en"]').click();
    await expect(page.getByTestId('zone-note')).toHaveText('Times are in Japan Time, +1 h from your device’s time');
    await page.locator('[data-lang="ja"]').click();
    await expect(page.getByTestId('zone-note')).toHaveText('現在は日本標準時で表示しています。端末の時刻との差は +1時間');
  });

  test('半小時的時差：印度的旅程，說明寫「−2 小時 30 分」、副時刻落在半點', async ({ page }) => {
    await open(page, await variant((p) => { p.trip.tz = 'Asia/Kolkata'; }));
    await expect(page.getByTestId('zone-note')).toHaveText('目前為印度時間，與裝置時間差 −2 小時 30 分');
    expect((await phoneClocks(page))[0]).toBe('11:30'); /* 印度 09:00 */
  });

  test('舊連結沒有 tz：照常顯示，不畫副時刻與說明', async ({ page }) => {
    await open(page, await variant((p) => { delete p.trip.tz; }));
    await expect(page.locator('.tl-ev').first()).toBeVisible();
    await expect(page.getByTestId('zone-note')).toBeHidden();
    await expect(page.getByTestId('phone-clock')).toHaveCount(0);
  });

  test('tz 是 null（日期未定那一份）：不畫', async ({ page }) => {
    await open(page, undated);
    await expect(page.getByTestId('zone-note')).toBeHidden();
    await expect(page.getByTestId('phone-clock')).toHaveCount(0);
  });
});

test.describe('瀏覽器也在東京', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });

  test('偏移相同：不出現', async ({ page }) => {
    await open(page, dated);
    await expect(page.locator('.tl-ev').first()).toBeVisible();
    await expect(page.getByTestId('zone-note')).toBeHidden();
    await expect(page.getByTestId('phone-clock')).toHaveCount(0);
  });
});

test.describe('瀏覽器在首爾', () => {
  test.use({ timezoneId: 'Asia/Seoul' });

  test('識別碼不同、偏移相同：也不出現（比偏移不比識別碼）', async ({ page }) => {
    await open(page, dated);
    await expect(page.locator('.tl-ev').first()).toBeVisible();
    await expect(page.getByTestId('zone-note')).toBeHidden();
    await expect(page.getByTestId('phone-clock')).toHaveCount(0);
  });
});

/* review F1：時間欄是幾天共用的，跨夏令時間就畫錯。紐約的旅程、2026-10-31 起三天、瀏覽器在台北：
 * 第 1 天差 −12；第 2 天 02:00 撥回之後與第 3 天差 −13。時差會變的旅程，每一天在自己的欄內畫裝置時刻，
 * 共用時間欄只留旅程時間——不管多寬、捲到哪裡，畫面上沒有一個數字是別天的。 */
const newYork = () => variant((p) => { p.trip.tz = 'America/New_York'; p.trip.start = '2026-10-31'; });
const dayClocks = (page, n) => page.getByTestId('day-' + n).getByTestId('phone-clock').allTextContents();

for (const width of [375, 1280]) {
  test.describe('紐約的旅程跨夏令時間、瀏覽器在台北，' + width + 'px 寬', () => {
    test.use({ viewport: { width, height: 900 } });

    test('每一天的裝置時刻畫在那一天的欄裡、各用各的時差；共用時間欄不畫', async ({ page }) => {
      await open(page, await newYork());
      await expect(page.locator('.tl-ax').getByTestId('phone-clock')).toHaveCount(0);
      /* 時間表 09:00–26:00：每一天 18 個整點 */
      const d1 = await dayClocks(page, 1), d2 = await dayClocks(page, 2), d3 = await dayClocks(page, 3);
      expect(d1).toHaveLength(18);
      expect(d1[0]).toBe('21:00'); /* 10/31 09:00 EDT */
      expect(d1[15]).toBe('12:00+1'); /* 11/1 00:00 EDT */
      expect(d1[17]).toBe('15:00+1'); /* 11/1 02:00 EST（已撥回） */
      expect(d2[0]).toBe('22:00'); /* 11/1 09:00 EST */
      expect(d3[0]).toBe('22:00'); /* 11/2 09:00 EST */
      expect(d3[17]).toBe('15:00+1'); /* 11/3 02:00 EST */
    });

    test('說明寫第一段時差＋「部分日子不同」；捲到最後一天也不變', async ({ page }) => {
      await open(page, await newYork());
      const note = '目前為東部時間，與裝置時間差 −12 小時（部分日子不同，以每一天欄內左側的裝置時刻為準）';
      await expect(page.getByTestId('zone-note')).toHaveText(note);
      await page.locator('.tl-sc').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await expect(page.getByTestId('day-3').getByTestId('phone-clock').first()).toBeInViewport();
      await expect(page.getByTestId('zone-note')).toHaveText(note);
      expect((await dayClocks(page, 3))[0]).toBe('22:00');
    });
  });
}

test.describe('紐約的旅程整趟都在標準時間（11/5 起）', () => {
  test('時差每天一樣：照舊畫在共用時間欄，欄內不畫', async ({ page }) => {
    await open(page, await variant((p) => { p.trip.tz = 'America/New_York'; p.trip.start = '2026-11-05'; }));
    await expect(page.getByTestId('zone-note')).toHaveText('目前為東部時間，與裝置時間差 −13 小時');
    expect((await phoneClocks(page))[0]).toBe('22:00');
    await expect(page.locator('.tl-day').getByTestId('phone-clock')).toHaveCount(0);
  });
});
