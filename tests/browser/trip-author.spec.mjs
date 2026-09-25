/* 票 13：作者在網頁上登入、停止分享（場景 31）。
 * 未登入／是建立者／不是建立者／停止確認／已停止；跳轉前金鑰存 sessionStorage、回來放回去。 */
import { test, expect } from '@playwright/test';
import { AUTHOR, STRANGER, dated, fakeCloudKit, pathOf, recordOf, useConfig } from './fake-cloudkit.mjs';

/** Apple 的登入頁：直接導回 callback，帶 ?ckWebAuthToken=，**沒有 # 片段**（spike 量到的行為）。 */
async function fakeAppleSignIn(page, token) {
  const visits = [];
  await page.route('https://idmsa.apple.com/**', (route) => {
    visits.push(route.request().url());
    return route.fulfill({ status: 302, headers: { location: 'http://localhost:4173/trip/?ckWebAuthToken=' + encodeURIComponent(token) } });
  });
  return visits;
}

async function openAs(page, { token, env = 'production', creator = AUTHOR }) {
  await useConfig(page);
  const users = { [token]: token === 'tok-author' ? AUTHOR : STRANGER };
  const ck = await fakeCloudKit(page, { stores: { [env]: { [dated.recordName]: recordOf(dated, creator) } }, users });
  const apple = await fakeAppleSignIn(page, token);
  await page.goto(pathOf(dated));
  await expect(page.locator('h1')).toHaveText('沖繩・慢活潛水');
  return { ck, apple };
}

async function signIn(page) {
  await page.getByTestId('author-entry').click();
  await expect(page.getByTestId('author-signin')).toContainText('用 iCloud 登入');
  await page.getByTestId('sign-in').click();
}

test('未登入：頁尾只有一行字，按了才長出登入卡；取消收回去', async ({ page }) => {
  const { ck } = await openAs(page, { token: 'tok-author' });
  await expect(page.getByTestId('author-entry')).toHaveText('我是作者，管理這個連結');
  await expect(page.getByTestId('author-stop')).toHaveCount(0);
  await page.getByTestId('author-entry').click();
  await expect(page.getByTestId('author-signin')).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByTestId('author-entry')).toBeVisible();
  expect(ck.calls.filter((c) => c.path !== 'records/lookup')).toHaveLength(0);
});

test('是建立者：登入跳轉掉了 # 也接得回來，出現「停止分享」（次要鈕）', async ({ page }) => {
  const { ck, apple } = await openAs(page, { token: 'tok-author' });
  await signIn(page);
  await expect(page.getByTestId('author-owner')).toBeVisible();
  await expect(page.getByTestId('author-owner')).toContainText('你是這個連結的建立者');
  /* 網址放回原本的 # 片段，查詢字串拿掉 */
  expect(new URL(page.url()).hash).toBe(new URL(dated.url).hash);
  expect(new URL(page.url()).search).toBe('');
  expect(await page.evaluate(() => sessionStorage.getItem('tez.auth.hash'))).toBeNull();
  /* 跳轉前：匿名問 users/current 拿 redirectURL */
  expect(apple).toHaveLength(1);
  const who = ck.calls.filter((c) => c.path === 'users/current');
  expect(who[0]).toMatchObject({ env: 'production', webAuthToken: null });
  expect(who[1]).toMatchObject({ env: 'production', webAuthToken: 'tok-author' });
  /* 次要鈕：白底紅字，不是紅色實心 */
  const stop = page.getByTestId('author-stop');
  await expect(stop).toHaveClass(/is-danger/);
  await expect(stop).not.toHaveClass(/btn-danger/);
});

test('跳轉前把 # 片段存進 sessionStorage', async ({ page }) => {
  await useConfig(page);
  await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } } });
  await page.route('https://idmsa.apple.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<p>apple sign-in</p>' }));
  await page.goto(pathOf(dated));
  await signIn(page);
  await page.waitForURL(/idmsa\.apple\.com/);
  await expect(page.getByText('apple sign-in')).toBeVisible();
  /* 回到同一個 origin（還沒帶 token 回來）看它存了什麼 */
  await page.goto('/404.html');
  expect(await page.evaluate(() => sessionStorage.getItem('tez.auth.hash'))).toBe(new URL(dated.url).hash);
  expect(await page.evaluate(() => sessionStorage.getItem('tez.auth.env'))).toBe('production');
});

test('停止分享：確認視窗裡才是紅色實心；返回不刪；確認之後刪掉、換成「已停止分享」', async ({ page }) => {
  const { ck } = await openAs(page, { token: 'tok-author' });
  await signIn(page);
  await page.getByTestId('author-stop').click();
  const dlg = page.getByTestId('stop-confirm');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('h3')).toHaveText('停止分享這趟行程？');
  await expect(page.getByTestId('stop-go')).toHaveClass(/btn-danger/);
  await dlg.getByRole('button', { name: '返回' }).click();
  await expect(dlg).toHaveCount(0);
  expect(ck.calls.filter((c) => c.path === 'records/modify')).toHaveLength(0);

  await page.getByTestId('author-stop').click();
  await page.getByTestId('stop-go').click();
  await expect(page.getByTestId('stopped')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('已停止分享');

  const modify = ck.calls.find((c) => c.path === 'records/modify');
  expect(modify.env).toBe('production');
  expect(modify.body).toEqual({
    operations: [{ operationType: 'delete', record: { recordName: dated.recordName, recordChangeTag: recordOf(dated).recordChangeTag } }],
  });
  /* 每用一次就換一把：刪除用的是 users/current 回的下一把，不是登入時那一把 */
  expect(modify.webAuthToken).toMatch(/^rotated-/);
  const who = ck.calls.filter((c) => c.path === 'users/current').pop();
  expect(modify.webAuthToken).not.toBe(who.webAuthToken);

  /* 重新整理：record 已經不在 → 失效 */
  await page.reload();
  await expect(page.getByTestId('gone')).toBeVisible();
});

test('不是建立者：講他能做什麼，沒有停止鈕；登出回到登入卡', async ({ page }) => {
  await openAs(page, { token: 'tok-stranger' });
  await signIn(page);
  await expect(page.getByTestId('author-not-owner')).toBeVisible();
  await expect(page.getByTestId('author-not-owner')).toContainText('這個 iCloud 帳號不是建立者');
  await expect(page.getByTestId('author-stop')).toHaveCount(0);
  await page.getByTestId('author-not-owner').getByRole('button', { name: '登出' }).click();
  await expect(page.getByTestId('author-signin')).toBeVisible();
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('tez.auth.token')).map((k) => sessionStorage.getItem(k)).filter(Boolean))).toEqual([]);
});

test('Development 的連結：登入與刪除都打 Development', async ({ page }) => {
  const { ck } = await openAs(page, { token: 'tok-author', env: 'development' });
  await signIn(page);
  await page.getByTestId('author-stop').click();
  await page.getByTestId('stop-go').click();
  await expect(page.getByTestId('stopped')).toBeVisible();
  const authCalls = ck.calls.filter((c) => c.path !== 'records/lookup');
  expect(authCalls.map((c) => c.env)).toEqual(['development', 'development', 'development']);
});

test('token 失效：回到登入卡，不假裝登入了', async ({ page }) => {
  await useConfig(page);
  await fakeCloudKit(page, { stores: { production: { [dated.recordName]: recordOf(dated) } }, users: {} });
  await fakeAppleSignIn(page, 'tok-expired');
  await page.goto(pathOf(dated));
  await signIn(page);
  await expect(page.getByTestId('author-signin')).toBeVisible();
  await expect(page.getByTestId('author-owner')).toHaveCount(0);
});

test('停止失敗：留在建立者卡片、toast 說沒成功', async ({ page }) => {
  await openAs(page, { token: 'tok-author' });
  await signIn(page);
  await page.route('https://api.apple-cloudkit.com/**/records/modify**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ records: [{ recordName: dated.recordName, serverErrorCode: 'CONFLICT' }] }),
    }));
  await page.getByTestId('author-stop').click();
  await page.getByTestId('stop-go').click();
  await expect(page.locator('#toast')).toContainText('沒有停止成功，請再試一次');
  await expect(page.getByTestId('author-owner')).toBeVisible();
});
