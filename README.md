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
