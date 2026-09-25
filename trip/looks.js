/* 一則行程的類型長什麼樣——同 App 的 `EventTypeLook.resolvedSwatch` / `resolvedShapes`。
 *
 * 公開版本每一則帶三格：`type`（類型名；內建類型是凍結的 ASCII key，如 `museum`，自訂類型是使用者打的字）、
 * `icon`（那個類型挑過的 Maki id，沒挑過是 null）、`swatch`（挑過的色族，null ＝跟著圖示走）。
 *
 *   色族：挑過的 → 圖示那一族的 → 照名字查內建的 → 雜項
 *   圖示：挑過的 → 照名字查內建的 → 通用圖釘（marker）
 */
import { DEFAULT_ICON_ID, ICON_SWATCH, MAKI, MAKI_OF_TYPE, SWATCH_LIGHT, TYPE_SWATCH } from './icons.js';

export function swatchOf(item) {
  if (item.swatch && SWATCH_LIGHT[item.swatch]) return item.swatch;
  if (item.icon && ICON_SWATCH[item.icon]) return ICON_SWATCH[item.icon];
  return (item.type && TYPE_SWATCH[item.type]) || 'misc';
}

export function iconOf(item) {
  if (item.icon) return MAKI[item.icon] ? item.icon : DEFAULT_ICON_ID;
  const id = item.type && MAKI_OF_TYPE[item.type];
  return id && MAKI[id] ? id : DEFAULT_ICON_ID;
}

export function iconPath(id) {
  return MAKI[id] || MAKI[DEFAULT_ICON_ID];
}
