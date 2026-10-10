# screens/ — App 畫面的 HTML 複刻

官網（之後也包括 App Store）用的 App 截圖。每一支 `.html` 是一個 iPhone 17 Pro 螢幕（402×874pt），
`tools/screens.mjs` 用 3x 渲染成 1206×2622，跟模擬器截圖同尺寸。

**為什麼不直接拍模擬器**：改一句文案、換一天行程、出英日文版，都要重新在模擬器上點一遍。HTML 讀
App 內建範本的 JSON，三語一份資料，跑一次指令就重出。

**風險**：HTML 是第二份 App，會漂。這裡只當行銷素材，不准拿來當工程參考。App 改了 UI 就重拍
`ref/`、跑 `compare`，看哪幾張要跟著改。

## 指令

```
python3 tools/sync-screen-data.py                 # 從 App repo 複製範本 JSON 與行程類型名稱
node tools/screens.mjs compare calendar "day=2"   # 出 out/compare-calendar.png：HTML｜模擬器｜疊圖
node tools/screens.mjs render calendar "day=2" --lang=en
node tools/screens.mjs all                         # 依 SHOTS 清單出三語全部
```

## 規則

1. **真實資料**：行程內容一律從 `data/sanyo.<lang>.json`（App 內建範本 `jp-sanyo-hiroshima-okayama-6d`）讀。
   範本裡沒有的東西（旅伴、購物項目、掃描紀錄、照片附件）才寫在該頁的 `<script>` 裡，三語各一份。
2. **數字從 App 原始碼讀，不目測**：`~/Projects/tripezgo/App/iOS/Modules/UI/Sources/UI/DesignSystem/`
   （`Components/*/…Metrics.swift`、`Typography.swift`、`Layout.swift`、`SemanticColors.swift`）。
   系統元件（狀態列、分頁列、sheet 外觀）才照 `ref/` 量。
3. **icon 照 App 的 `Components/Foundation/DesignIcon.swift`**（它是設計稿 `<path d>` 的轉寫）。
   不准用 emoji、SF Symbols 或自己畫的近似圖。
4. **共用檔**（`screen.css`、`chrome.js`、`tools/`）只由主 session 改。要新 icon、新 token 就寫在自己那一頁
   的 `<style>`／`<script>` 裡，並在交付時列出，主 session 再收進共用檔。
5. 每頁結構照 `calendar.html`：`<div class="device" id="d">`、`import … from './chrome.js'`、最後 `chrome(d, {tab})`
   與 `ready()`。文字經過 `fmt()`（處理「–」「→」字型）。行程類型顏色用 `swatchClass(category)`。
6. 驗收：`node tools/screens.mjs compare <name> "<query>"`，打開 `out/compare-<name>.png` 看疊圖，
   差異要能說出原因。

## 坑

- Chromium 把暖白 `#fbf8f4` 當無色相，CSS `color-mix(in oklch …)` 會偏藍。行程類型色票改由 `chrome.js` 照 App 的
  `OKLCh.mix` 算好塞進來；其他要 OKLCH 混色的地方也用 JS 算，不要用 `color-mix(in oklch)`。
- 中文頁的 `-apple-system` 會被解析成 PingFang，「–」「→」變全形——一律過 `fmt()`。
- 時間欄只有一排，是因為基準圖用日本時區啟動（`SIMCTL_CHILD_TZ=Asia/Tokyo`）。
- 地圖底圖畫不出來：地圖類畫面的地圖區用 `ref/` 裡截下來的圖當背景，HTML 只畫上面的介面。

## 基準圖 `ref/zh/`

iCloud1、main＋Premium、範本山陽 6 日（第 1 天＝2026-10-10，今天＝第 1 天）、繁中、9:41。

| 檔名 | 畫面 |
|---|---|
| calendar / timeline | 旅程分頁第 2 天，行事曆／時間軸 |
| overview | 總覽分頁 |
| event | 全日行程「JR Pass」的詳情 sheet（待辦 2、附件 1） |
| leg | 第 2 天早餐→渡輪那段路程的 sheet（三個班次，選第二個） |
| map / map-place | 地圖第 2 天，宮島；map-place 多一張嚴島神社的卡片 |
| map-store | 地圖上點 7-ELEVEN 廣島若草町的卡片 |
| tools, note, scan, fx, shop | 小工具分頁（筆記列表、筆記內頁、掃描、匯率、購物清單——後三個是空的） |
| members | 設定 → 旅程共編（沒有開分享） |
