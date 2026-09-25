#!/usr/bin/env node
/* 從 App 的原始碼產生 trip/icons.js——行程類型的圖示（Maki）與色族，跟 App 同一張表。
 *
 * 來源（App repo `App/iOS/Modules/UI/Sources/UI/DesignSystem/`）：
 *   - Components/Foundation/EventTypeIcons.swift  `glyphs`（66 枚 path）、`makiOfType`（內建類型 → Maki）、
 *                                                  `pickable`（每一枚圖示的預設色族）
 *   - EventTypeSwatch.swift                        `typeNames`（內建類型 → 色族）、light／dark 的 OKLCH 配方
 *
 * 手抄一份遲早會跟 App 分家（設計稿那一份 MAKI 表就被壓縮器壓壞過），所以用產的。
 *
 * 用法：
 *   node tools/gen-icons.mjs [App repo 根目錄]          寫 trip/icons.js
 *   node tools/gen-icons.mjs [App repo 根目錄] --check  只比對，不一樣就 exit 1
 * 沒給路徑就找兄弟目錄 ../tripezgo；也可以用環境變數 TRIPEZGO_APP。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT = path.join(root, 'trip/icons.js');
const UI = 'App/iOS/Modules/UI/Sources/UI/DesignSystem';

export function appRoot(arg) {
  return arg || process.env.TRIPEZGO_APP || path.resolve(root, '../tripezgo');
}

export function generate(app) {
  const icons = readFileSync(path.join(app, UI, 'Components/Foundation/EventTypeIcons.swift'), 'utf8');
  const swatch = readFileSync(path.join(app, UI, 'EventTypeSwatch.swift'), 'utf8');

  const block = (text, start) => {
    const i = text.indexOf(start);
    if (i < 0) throw new Error('找不到 ' + start);
    return text.slice(i, text.indexOf('\n    ]', i));
  };

  const glyphs = {};
  for (const m of block(icons, 'private static let glyphs').matchAll(/^\s+"([a-z-]+)": \[\.path\("([^"]+)"\)\],?$/gm)) {
    glyphs[m[1]] = m[2];
  }
  const makiOfType = {};
  for (const m of block(icons, 'private static let makiOfType').matchAll(/^\s+"([a-z]+)": "([a-z-]+)",$/gm)) {
    makiOfType[m[1]] = m[2];
  }
  const iconSwatch = {};
  for (const m of block(icons, 'public static let pickable').matchAll(/Icon\(id: "([a-z-]+)", name: [^,]+, swatch: \.([a-zA-Z]+),/g)) {
    iconSwatch[m[1]] = m[2];
  }
  const typeSwatch = {};
  const names = swatch.slice(swatch.indexOf('public var typeNames'));
  for (const m of names.slice(0, names.indexOf('private static let table')).matchAll(/case \.([a-zA-Z]+)(?:, \.[a-zA-Z]+)*: \[([\s\S]*?)\]/g)) {
    for (const n of m[2].matchAll(/"([a-z]+)"/g)) typeSwatch[n[1]] = m[1];
  }
  const recipes = (name) => {
    const out = {};
    const body = swatch.slice(swatch.indexOf('private var ' + name + ': Recipe'));
    for (const m of body.slice(0, body.indexOf('\n    }')).matchAll(/case \.([a-zA-Z]+): Recipe\(l: ([\d.]+), c: ([\d.]+), h: ([\d.]+)\)/g)) {
      out[m[1]] = 'oklch(' + m[2] + ' ' + m[3] + ' ' + m[4] + ')';
    }
    return out;
  };
  const light = recipes('light');
  const dark = recipes('dark');

  if (Object.keys(glyphs).length !== 66 || Object.keys(iconSwatch).length !== 66) {
    throw new Error('圖示數量不對（' + Object.keys(glyphs).length + '／' + Object.keys(iconSwatch).length + '）——App 的格式變了，改這支產生器');
  }
  if (Object.keys(light).length !== 11 || Object.keys(dark).length !== 11) throw new Error('色族配方數量不對');

  const j = (o) => JSON.stringify(o, null, 0);
  return '/* 由 tools/gen-icons.mjs 從 App 的 EventTypeIcons.swift／EventTypeSwatch.swift 產生——不要手改。 */\n\n'
    + '/** Maki id → path（viewBox 0 0 15 15，evenodd 填色）。 */\n'
    + 'export const MAKI = ' + j(glyphs) + ';\n\n'
    + '/** 內建類型的凍結 key → Maki id（沒挑過圖示時照名字查）。 */\n'
    + 'export const MAKI_OF_TYPE = ' + j(makiOfType) + ';\n\n'
    + '/** 每一枚圖示的預設色族。 */\n'
    + 'export const ICON_SWATCH = ' + j(iconSwatch) + ';\n\n'
    + '/** 內建類型的凍結 key → 色族。 */\n'
    + 'export const TYPE_SWATCH = ' + j(typeSwatch) + ';\n\n'
    + '/** 色族 → OKLCH（淺色／深色），同 App 的 EventTypeSwatch 配方。 */\n'
    + 'export const SWATCH_LIGHT = ' + j(light) + ';\n'
    + 'export const SWATCH_DARK = ' + j(dark) + ';\n\n'
    + 'export const DEFAULT_ICON_ID = \'marker\';\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const app = appRoot(args.find((a) => a !== '--check'));
  if (!existsSync(path.join(app, UI))) {
    console.log('略過：找不到 App repo（' + app + '）');
    process.exit(0);
  }
  const text = generate(app);
  if (check) {
    const same = existsSync(OUTPUT) && readFileSync(OUTPUT, 'utf8') === text;
    console.log(same ? '一致：trip/icons.js' : 'trip/icons.js 跟 App 不一致——跑 node tools/gen-icons.mjs');
    process.exit(same ? 0 : 1);
  }
  writeFileSync(OUTPUT, text);
  console.log('寫好 ' + OUTPUT);
}
