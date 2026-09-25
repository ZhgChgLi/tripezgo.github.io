#!/usr/bin/env node
/* 黃金檔的副本（tests/fixtures/golden-v1.json）跟 App repo 那一份一不一致。
 *
 * 黃金檔由 App repo 的 `PublicLinkGoldenTests` 在每次 `make test` 重算（`docs/public-link/golden-v1.json`）。
 * 這裡的網頁與清理工具拿副本當測試 fixture——App 改了格式而副本沒跟上，網頁測試照樣會綠，
 * 所以要有這一支把兩份對一次。
 *
 * 用法：
 *   node tools/check-golden.mjs [App repo 的黃金檔路徑]
 *   TRIPEZGO_GOLDEN=/path/to/golden-v1.json node tools/check-golden.mjs
 * 沒給路徑就找兄弟目錄 `../tripezgo/docs/public-link/golden-v1.json`。
 * 找不到那一份（CI 上、或 App repo 不在這台機器）就**略過並印出原因**，不算失敗。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE = path.join(root, 'tests/fixtures/golden-v1.json');
export const DEFAULT_APP_GOLDEN = path.resolve(root, '../tripezgo/docs/public-link/golden-v1.json');

/** → `{ status: 'same' | 'different' | 'skipped', reason }` */
export function compareGolden(appPath) {
  const source = appPath || process.env.TRIPEZGO_GOLDEN || DEFAULT_APP_GOLDEN;
  if (!existsSync(source)) {
    return { status: 'skipped', reason: '找不到 App repo 的黃金檔：' + source };
  }
  const app = readFileSync(source, 'utf8');
  const copy = readFileSync(FIXTURE, 'utf8');
  if (app === copy) return { status: 'same', reason: source };
  return {
    status: 'different',
    reason: '副本跟 App repo 那一份不一樣——把 ' + source + ' 複製到 ' + FIXTURE + ' 再跑一次測試',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = compareGolden(process.argv[2]);
  if (result.status === 'skipped') console.log('略過：' + result.reason);
  else if (result.status === 'same') console.log('一致：' + result.reason);
  else {
    console.error('不一致：' + result.reason);
    process.exit(1);
  }
}
