/* 一則行程的類型長什麼樣——同 App 的 `EventTypeLooks`（1.0.0 (185) 起，ADR-0024）。
 *
 * 類型是一份固定清單，**類型決定圖示與顏色**：公開版本每一則只帶 `type`（凍結的 ASCII key，如 `museum`）。
 * 舊版 App 發佈、還沒更新過的公開版本另外帶著 `icon`／`swatch`（自訂類型自己挑的圖示與色票）——
 * App 讀的時候視而不見，這裡也不看。
 *
 *   圖示：照 key 查 → 通用圖釘（marker）
 *   色族：照 key 查 → 雜項（misc）
 * 清單外的名字（舊版的自訂類型）因此跟 App 的「其他」長得一樣。
 */
import { DEFAULT_ICON_ID, MAKI, MAKI_OF_TYPE, TYPE_SWATCH } from './icons.js';

const own = (table, key) => (key && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null);

export function swatchOf(item) {
  return own(TYPE_SWATCH, item.type) || 'misc';
}

export function iconOf(item) {
  const id = own(MAKI_OF_TYPE, item.type);
  return id && MAKI[id] ? id : DEFAULT_ICON_ID;
}

export function iconPath(id) {
  return MAKI[id] || MAKI[DEFAULT_ICON_ID];
}
