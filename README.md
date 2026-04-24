# Tripezgo

一頁式旅遊商品導購網站，以每月優惠快報形式展示商品與延伸文章。網站使用 Jekyll，可部署到 GitHub Pages。

## 本機開發

```bash
bin/setup
bin/dev
```

開啟 `http://127.0.0.1:4000`。`bin/dev` 會啟動 Jekyll live reload，修改 markdown、layout、CSS 或 JS 後會自動重新產生。

可用環境變數調整 host 與 port：

```bash
PORT=4100 bin/dev
HOST=0.0.0.0 PORT=4100 bin/dev
LIVERELOAD_PORT=35731 bin/dev
```

## 本地測試與 Debug

```bash
bin/doctor
bin/test
```

- `bin/doctor`：確認 Ruby、Bundler、gems 與範例快報狀態。
- `bin/test`：用 production 環境執行 `jekyll build --strict_front_matter --trace`，再檢查首頁、月報頁、商品 CTA、倒數 ISO 時間與文章欄目。
- `make dev`、`make test`、`make build` 也可以使用。

清除 Jekyll 輸出：

```bash
make clean
```

## 新增每月快報

在 `_reports` 新增 `YYYY-MM.md`，並用 YAML front matter 維護商品與文章資料。首頁會自動依 `month` 取最新月份。

商品欄位：

- `name`
- `image`
- `description`
- `tags`
- `price`
- `sale_price`
- `url`
- `offer_ends_at`，選填，ISO 時間字串
- `category`，選填，用來分組顯示商品
- `category_en`，選填，分類英文短標
- `category_hint`，選填，分類說明文字

文章欄位：

- `title`
- `image`
- `url`
- `source`，選填
