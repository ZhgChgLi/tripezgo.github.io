# tripezgo.com

TripEZGo iOS App 的官方網站。純靜態 HTML + CSS，沒有建置步驟，部署在 GitHub Pages。

## 結構

```
index.html            首頁（繁體中文）
privacy.html          隱私權政策（繁體中文）
terms.html            使用者條款（繁體中文）
en/index.html         首頁（English）
en/privacy.html       Privacy Policy
en/terms.html         Terms of Use
404.html
assets/css/site.css   全站唯一一份樣式，色票沿用 TripEZGo 品牌識別 token
assets/img/           標誌、App 截圖（webp）、功能插圖（明暗各一份）、OG 圖
CNAME                 tripezgo.com
.nojekyll             關掉 GitHub Pages 的 Jekyll 處理
robots.txt / sitemap.xml
```

送 App Store 審查時填的兩個網址：

- 隱私權政策：`https://tripezgo.com/privacy.html`（英文版 `https://tripezgo.com/en/privacy.html`）
- 使用者條款：`https://tripezgo.com/terms.html`（英文版 `https://tripezgo.com/en/terms.html`）

## 公開連結頁 `trip/`

`https://tripezgo.com/trip/#<id>.<key>`——App 的「公開連結」（App repo 的 ADR-0023、
`.scratch/public-trip-share/spec.md`）。頁面用 CloudKit Web Services 匿名讀 public database、
WebCrypto 在瀏覽器裡解密，金鑰只在 `#` 片段裡、不會送到伺服器。版面照 Open Design 稿
`trip-share-public.html`。

```
trip/index.html     版面與樣式（設計稿的 token）
trip/app.js         讀取、狀態、繪製
trip/core.js        純函式：網址、解密、驗章、逐日分桶、純文字——瀏覽器、測試、清理工具共用
trip/cloudkit.js    Web Services（只用 fetch，不載 CloudKit JS）
trip/config.js      API token（Production → Development 依序查）、MapKit JS token
trip/strings.js     三語字典
```

### 測試

網站本身沒有建置步驟；`package.json` 只為了測試（`node_modules/` 已 gitignore，不會被發布）。

```bash
npm ci
npx playwright install chromium
npm test                  # node 單元測試＋Playwright 瀏覽器測試
npm run golden:check      # 黃金檔副本 vs App repo 那一份（預設找 ../tripezgo，可給路徑）
```

- `tests/fixtures/golden-v1.json` 是 App repo `docs/public-link/golden-v1.json` 的副本——App 的程式碼
  加密、簽章、產純文字的那一份。解密與三語純文字都跟它逐字對。App 那一份變了就複製過來。
- 瀏覽器測試把 CloudKit 在 HTTP 邊界上假掉（`page.route` 攔 `api.apple-cloudkit.com`）。
- `.github/workflows/test.yml` 在 push 時跑同一套，**不擋部署**。

### 每日清理 `tools/cleanup/`

`.github/workflows/cleanup.yml` 每天 03:23（台北）跑一次、也能手動觸發（手動預設**試跑**：只列不刪）。
它用 server-to-server key 列出 **Production** public database 的 `TripEZGoPublicItinerary`，
刪掉格式版本不認得、payload 壞格式、沒簽、或 HMAC 在目前接受的任一把金鑰下都驗不過的——
那些不是 App 寫的（任何登入 iCloud 的人都能直接用 Web Services 建這個 type 的 record，吃的是
container 共用的 public 額度）。每一筆刪了什麼、為什麼，寫在 log 與 job summary。

- **為什麼放這個 repo**：App repo 沒有 CI（本機出貨）；驗章跟公開頁共用 `trip/core.js`，同一份黃金檔測試。
- **為什麼只碰 Production（寫死）**：Development 是模擬器與 debug build 的測試資料。
- **換鑰**：`TEZ_SIGNING_KEYS` 放逗號分隔的多把，新舊並列一段時間，等舊版 App 寫的都更新過再拿掉舊的。
- **App 升格式版本之前**，先讓清理認得新版本並上線，否則新版 App 寫的每一筆都會被刪。

要設的 Actions secrets（沒設之前每天跳過，不算失敗）：

| secret | 內容 |
|---|---|
| `CK_S2S_KEY_ID` | CloudKit Console › Production 的 server-to-server key 的 Key ID |
| `CK_S2S_PRIVATE_KEY` | 那一把的 EC P-256 私鑰（PEM 全文） |
| `TEZ_SIGNING_KEYS` | App 內嵌的簽章金鑰（base64），換鑰期間逗號分隔多把 |

server-to-server key 以建立它的開發者身分存取、連同身上的 security role：開發者的 user record
要掛上自訂角色 `Moderator`（Write），才刪得動別人建的 record（2026-09-25 spike 量過）。

## 本機預覽

沒有相依套件，起一個靜態伺服器即可：

```bash
python3 -m http.server 4000
```

開 <http://127.0.0.1:4000>。注意頁面內連結都是**絕對路徑**（`/assets/...`），
直接用 `file://` 開會找不到資源，一定要透過 http server 看。

## 部署

`main` 有 push 就由 `.github/workflows/pages.yml` 部署整個根目錄到 GitHub Pages。
Workflow 在上傳前會把所有 HTML 的站內連結對一次，斷掉就讓 build 失敗。

GitHub repo 的 `Settings → Pages → Source` 要選 **GitHub Actions**。

## 素材來源

首頁的手機截圖與功能插圖來自設計稿專案
（Open Design `e0f396c1-0fb8-48ff-9a11-996200cddadc`），已轉成 webp 並縮到網頁尺寸。
標誌是設計稿切出的三份 SVG（圖標／字標／組合標），用 CSS `mask` 上色，
所以同一個檔案在深淺色模式下各自跟著 `currentColor` 走。

## 待辦

- App Store 上架後，把首頁 hero 的「即將於 App Store 上架」`<span class="btn">`
  換成指向 App Store 的 `<a class="btn btn-primary">`（中英各一處）。
- App 內 `PremiumLinks.privacyURL` 目前指向 `https://zhgchg.li/tripezgo/privacy`，
  應改為 `https://tripezgo.com/privacy.html`；`termsURL` 目前是 Apple 標準 EULA，
  可改為 `https://tripezgo.com/terms.html`（本站條款已包含 Apple EULA 的連結與必要條文）。
