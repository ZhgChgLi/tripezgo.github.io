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
