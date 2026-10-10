#!/usr/bin/env python3
"""從繁中首頁 index.html 產生 en/index.html 與 ja/index.html。

繁中是母版：版面、區塊、截圖位置都只改 index.html，再跑這支。
英日文只換字（逐字對照表在下面）、換截圖路徑、換連結與 <head>。
表裡沒有對到的中文字串會讓這支直接失敗——寧可擋下，不要上線一頁中英夾雜。

用詞照 App 的字串表（Scripts/i18n/maps）：旅伴 Companion／旅の仲間、共編 co-edit／共同編集、
總覽 Overview／概要、附件 Files／添付、待辦 To-Dos／やることリスト、即時動態 Live Activity／ライブアクティビティ、
小工具 Tools／ツール。

用法：python3 tools/home-i18n.py
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

T = {
  # chrome
  '跳到主要內容': ('Skip to main content', 'メインコンテンツへ移動'),
  '隱私': ('Privacy', 'プライバシー'),
  '功能': ('Features', '機能'),
  '方案': ('Pricing', '料金'),
  'TripEZGo 首頁': ('TripEZGo home', 'TripEZGo ホーム'),
  '主要導覽': ('Main', 'メイン'),
  '頁尾導覽': ('Footer', 'フッター'),
  '隱私權政策': ('Privacy Policy', 'プライバシーポリシー'),
  '使用者條款': ('Terms of Use', '利用規約'),
  '聯絡我們': ('Contact', 'お問い合わせ'),
  '旅行規劃、旅途所需一次搞定。': ('Plan the trip, carry what it needs — all in one app.', '旅の計画も、旅先で要るものも、これひとつで。'),
  'Made for iPhone &amp; iPad · 支援 6 種語言': ('Made for iPhone &amp; iPad · Available in 6 languages', 'Made for iPhone &amp; iPad · 6 言語に対応'),
  # hero
  'iPhone 與 iPad 旅行規劃': ('Trip planning for iPhone and iPad', 'iPhone・iPad の旅行プランナー'),
  '旅行規劃、旅途所需': ('Plan the trip, carry what it needs —', '旅の計画も、旅先で要るものも、'),
  '一次搞定': ('all in one app', 'これひとつで'),
  '排行程、帶票券、查交通，出發後也跟著你走。': ('Plan the days, keep the tickets, check the connections — and take it all with you when you go.',
                                              '予定を組んで、チケットをまとめて、移動を調べる。出発したあとも、そのまま持ち歩けます。'),
  '在 App Store 下載': ('Download on the App Store', 'App Store でダウンロード'),
  '看看它怎麼運作': ('See how it works', '使い方を見る'),
  '免註冊': ('No sign-up', '登録不要'),
  '離線可用': ('Works offline', 'オフラインで使える'),
  '免費下載': ('Free to download', '無料でダウンロード'),
  # privacy
  '隱私與安全': ('Privacy and security', 'プライバシーと安全'),
  '你的旅程，': ('Your trips live', 'あなたの旅行は、'),
  '只在你的手機': ('only on your phone', 'あなたの iPhone と'),
  '和你的 iCloud': ('and in your iCloud', 'あなたの iCloud だけに'),
  '不用帳號，我們沒有伺服器，也看不到你的行程。備份、同步、共享都走 iCloud。':
      ('No account. We run no server and never see your trips. Backup, sync and sharing all go through iCloud.',
       'アカウントは不要。私たちはサーバーを持たず、あなたの予定を見ることもありません。バックアップ・同期・共有はすべて iCloud で。'),
  '閱讀完整隱私權政策 →': ('Read the full privacy policy →', 'プライバシーポリシー全文を読む →'),
  '這台 iPhone': ('This iPhone', 'この iPhone'),
  '全部資料': ('All your data', 'すべてのデータ'),
  '行程': ('Events', '予定'),
  '附件': ('Files', '添付'),
  '待辦': ('To-dos', 'やること'),
  '筆記': ('Notes', 'メモ'),
  '購物清單': ('Shopping list', '買い物リスト'),
  '照片': ('Photos', '写真'),
  'iCloud 加密備份與同步': ('Encrypted iCloud backup and sync', 'iCloud で暗号化バックアップ・同期'),
  '只有你的 Apple 帳號解得開': ('Only your Apple Account can open it', '開けるのはあなたの Apple アカウントだけ'),
  '旅伴共編': ('Co-editing with companions', '旅の仲間と共同編集'),
  '走 iCloud 共享': ('Through iCloud sharing', 'iCloud 共有で'),
  '沒有帳號，沒有我們的伺服器。飛機上一樣打得開。': ('No account, no server of ours. Opens just the same on a plane.', 'アカウントも、私たちのサーバーもなし。機内でもそのまま開けます。'),
  # 01
  '01 · 安排行程': ('01 · Plan events', '01 · 予定を組む'),
  '該帶的，': ('Everything you need,', '持っていくものは、'),
  '都掛在行程上': ('attached to the event', '予定にまとめて'),
  '車票、訂位、待辦跟著行程走，到現場點了就開。': ('Tickets, bookings and to-dos stay with the event. When you get there, one tap opens them.',
                                             'チケットも予約もやることも、予定と一緒に。現地ではタップするだけで開けます。'),
  '照片、檔案、電子車票連結': ('Photos, files and e-ticket links', '写真・ファイル・電子チケットのリンク'),
  '出發前逐項打勾的待辦': ('To-dos to tick off before you leave', '出発前にチェックするやること'),
  '行程之間設定交通方式': ('How you travel between events', '予定と予定のあいだの移動手段'),
  '錯過這班車，備案班次已經排好': ('Miss this train? The backup is already lined up', '乗り遅れても、次の便はもう用意済み'),
  # 02
  '02 · 行事曆／時間軸': ('02 · Calendar / Timeline', '02 · カレンダー／タイムライン'),
  '今天怎麼走，': ("Today's plan,", '今日の回り方が、'),
  '一眼看完': ('at a glance', 'ひと目でわかる'),
  '行程、空檔、路上要多久，排在同一條時間上。': ('Events, free time and travel time, laid out on a single line of time.',
                                            '予定も空き時間も移動時間も、1本の時間軸に。'),
  '停留多久、空檔多少': ('How long you stay, how much time is free', '滞在時間と空き時間'),
  '來不及先提醒你': ('A heads-up when the gap is too short', '間に合わないときは先にお知らせ'),
  '行事曆、時間軸隨時切換': ('Switch between calendar and timeline anytime', 'カレンダーとタイムラインをいつでも切り替え'),
  '行事曆': ('Calendar', 'カレンダー'),
  '時間軸': ('Timeline', 'タイムライン'),
  '行事曆與時間軸可互相切換': ('Switch between calendar and timeline', 'カレンダーとタイムラインを切り替え'),
  # 03
  '03 · 地圖模式': ('03 · Map', '03 · マップ'),
  '下一站在哪，': ("Where's next?", '次はどこへ。'),
  '地圖告訴你': ('The map shows you', 'マップが教えてくれる'),
  '每天的行程連成路線，順路的店也標在上面。': ("Each day's events join into a route, with the shops along the way marked too.",
                                          '1日の予定がルートでつながり、道沿いのお店も表示されます。'),
  '每日路線與路程': ('Daily routes and legs', '1日のルートと移動'),
  '標記想去的地方': ('Pin the places you want to go', '行きたい場所にマーカー'),
  '日本超商、百貨藥妝圖資': ('Japanese convenience stores, department stores and drugstores', '日本のコンビニ・百貨店・ドラッグストア'),
  '支援步行導航': ('Walking directions', '徒歩ナビ'),
  # 04
  '04 · 總覽模式': ('04 · Overview', '04 · 概要'),
  '整趟旅程，': ('The whole trip,', '旅行まるごと、'),
  '一頁看完': ('on one page', '1ページで'),
  '行程、附件、待辦，要找的東西點一下就到。': ('Events, files and to-dos — whatever you need is one tap away.',
                                         '予定・添付・やること。探しものはタップひとつで。'),
  # 05
  '05 · 旅伴共編': ('05 · Companions', '05 · 旅の仲間'),
  '一起排，': ('Plan together,', '一緒に組んで、'),
  '一起出發': ('travel together', '一緒に出発'),
  '旅伴一起編行程、筆記與附件。路上分享位置，走散了也找得到彼此。':
      ('Companions edit events, notes and files together. Share your location on the road, so you can find each other if you split up.',
       '旅の仲間と予定・メモ・添付を共同編集。旅先では現在地を共有して、はぐれてもお互いを見つけられます。'),
  # lock screen
  '不用打開 App': ('Without opening the app', 'アプリを開かずに'),
  '不用解鎖，': ('No unlocking —', 'ロックを解除しなくても、'),
  '下一站就在鎖定畫面': ('your next stop is on the Lock Screen', '次の行き先はロック画面に'),
  '現在在哪、還能待多久、下一站怎麼去。': ("Where you are, how long you have left, and how to get to the next stop.",
                                     '今どこにいて、あとどれだけいられて、次へどう行くか。'),
  '即時動態': ('Live Activity', 'ライブアクティビティ'),
  '鎖定畫面與動態島，隨時看進行中的行程': ('On the Lock Screen and Dynamic Island, the current event at a glance', 'ロック画面とダイナミックアイランドで、進行中の予定をいつでも'),
  '主畫面、鎖定畫面放今天的行程': ("Today's events on your Home Screen and Lock Screen", 'ホーム画面とロック画面に今日の予定'),
  '推播': ('Notifications', '通知'),
  '待辦時間到了提醒你': ("A reminder when a to-do is due", 'やることの時間になったらお知らせ'),
  '問一句就知道下一個行程': ("Ask, and hear what's next", '聞くだけで次の予定がわかる'),
  # tools
  '小工具': ('Tools', 'ツール'),
  '路上用得到的，': ('What you need on the road,', '旅先で使うものは、'),
  '都帶著': ('all in one place', 'ぜんぶここに'),
  '圖文都能記，日文萬用句幫你念': ('Text and photos, with Japanese phrases read aloud for you', '写真も文字も。フレーズは読み上げも'),
  '匯率換算': ('Currency', '為替換算'),
  '沒網路也能算': ('Works without a connection', '通信がなくても計算できる'),
  '待購清單': ('Shopping list', '買い物リスト'),
  '拍照記下，哪家便宜一看就知道': ('Snap it to save it, and see which shop is cheapest', '写真で記録、どの店が安いかひと目で'),
  'QR Code 掃描': ('QR code scanner', 'QR コードスキャン'),
  '網址、文字掃了就存，旅伴一起看': ('Scanned links and text are saved for your companions too', '読み取った URL やテキストを保存、旅の仲間とも共有'),
  # AI
  '讓 AI': ('Let AI', 'AI に'),
  '幫你排行程': ('plan it for you', '予定を組んでもらう'),
  '內建 MCP，接上你的 AI Agent，說一句「幫我排京都第二天」，行程就進來了。':
      ('Built-in MCP connects your AI agent. Say "Plan day two in Kyoto for me" and the events appear.',
       'MCP を内蔵。AI エージェントにつないで「京都の2日目を組んで」と頼めば、予定が入ります。'),
  '對話示意 · 已連線 TripEZGo': ('Example chat · Connected to TripEZGo', '会話の例 · TripEZGo に接続済み'),
  '幫我排京都第二天：早上去伏見稻荷，下午想逛錦市場。': ('Plan day two in Kyoto: Fushimi Inari in the morning, Nishiki Market in the afternoon.',
                                                 '京都の2日目を組んで。朝は伏見稲荷、午後は錦市場に行きたい。'),
  'TripEZGo · 已在第 2 天新增 2 個行程與 1 段路程': ('TripEZGo · Added 2 events and 1 leg to day 2', 'TripEZGo · 2日目に予定 2 件と移動 1 件を追加'),
  '排好了，打開 App 就看得到。': ("Done — open the app and it's there.", 'できました。アプリを開けば入っています。'),
  # plans
  '免費開始，': ('Start free,', '無料ではじめて、'),
  '需要再升級': ('upgrade when you need to', '必要なときにアップグレード'),
  '免費版': ('Free', '無料版'),
  '旅程數': ('Trips', '旅行の数'),
  '3 趟': ('3', '3 件'),
  '垃圾桶也算': ('trash included', 'ゴミ箱の分も含む'),
  '不限': ('Unlimited', '無制限'),
  '每趟旅伴': ('Companions per trip', '旅行ごとの旅の仲間'),
  '3 位': ('3', '3 人'),
  '廣告': ('Ads', '広告'),
  '有': ('Yes', 'あり'),
  '無廣告': ('No ads', '広告なし'),
  '行事曆／時間軸、地圖、總覽': ('Calendar / timeline, map, overview', 'カレンダー／タイムライン・マップ・概要'),
  '附件、待辦、路程與班次備案': ('Files, to-dos, legs and backup departures', '添付・やること・移動と代わりの便'),
  '旅伴共編、分享位置': ('Co-editing and location sharing', '共同編集・現在地の共有'),
  '小工具（筆記、匯率、待購清單）': ('Tools (notes, currency, shopping list)', 'ツール（メモ・為替・買い物リスト）'),
  'iCloud 同步與備份': ('iCloud sync and backup', 'iCloud 同期とバックアップ'),
  '匯入匯出': ('Import and export', '読み込み・書き出し'),
  'AI Agent 整合': ('AI agent integration', 'AI エージェント連携'),
  'Apple／Google 行事曆整合': ('Apple / Google Calendar integration', 'Apple／Google カレンダー連携'),
  'Premium 提供週、月、年自動續訂或一次買斷，可隨時在 App Store 的訂閱設定取消。':
      ('Premium is available as a weekly, monthly or yearly subscription, or a one-time purchase. Cancel anytime in your App Store subscription settings.',
       'Premium は週・月・年の自動更新サブスクリプション、または買い切り。App Store のサブスクリプション設定からいつでも解約できます。'),
  '不支援': ('Not included', '対象外'),
  '支援': ('Included', '対象'),
  # alt text
  '地圖模式：第 2 天在宮島，行程依序連成步行路線，嚴島神社的卡片上有步行導航鈕':
      ("Map: day 2 on Miyajima, with events joined into a walking route and Itsukushima Shrine's card showing a walking-directions button",
       'マップ：2日目の宮島。予定が徒歩ルートでつながり、厳島神社のカードに徒歩ナビのボタン'),
  '行事曆模式：山陽 6 日的第 2 天，行程沿時間排開，早餐與渡輪之間標著 JR 山陽本線的班次':
      ('Calendar: day 2 of the six-day San\'yō trip, events laid out by time, with the JR San\'yō Line departure between breakfast and the ferry',
       'カレンダー：山陽 6 日間の2日目。予定が時間順に並び、朝食とフェリーのあいだに JR 山陽本線の便'),
  '總覽：今天的行程依時間列出，行程之間標著步行時間與間隔': ("Overview: today's events listed by time, with walking time and gaps between them",
                                                    '概要：今日の予定が時間順に並び、予定のあいだに徒歩時間と間隔'),
  '示意圖：這台 iPhone 裡有全部資料——行程、附件、待辦、筆記、購物清單、照片；用你的 Apple 帳號加密備份與同步到 iCloud，旅伴共編也走 iCloud 共享':
      ('Diagram: this iPhone holds all your data — events, files, to-dos, notes, shopping list and photos; it is encrypted, backed up and synced to iCloud with your Apple Account, and co-editing runs on iCloud sharing',
       '図：この iPhone にすべてのデータ（予定・添付・やること・メモ・買い物リスト・写真）。Apple アカウントで暗号化して iCloud にバックアップ・同期し、共同編集も iCloud 共有で'),
  '行程詳情：JR Pass 的待辦清單與附件，附件有網頁連結、PDF 電子票券與照片':
      ('Event details: the JR Pass with its to-dos and files — a web link, a PDF e-ticket and a photo',
       '予定の詳細：JR パスのやることリストと添付。Web リンク、PDF の電子チケット、写真'),
  '路程：三個班次並排，選中的那一班顯示發車、抵達與候車時間':
      ('Leg: three departures side by side; the selected one shows departure, arrival and waiting time',
       '移動：3つの便が並び、選んだ便の発車・到着・待ち時間を表示'),
  '時間軸模式：第 2 天的行程依序排成一條線，標出停留時間與路程':
      ('Timeline: day 2 as a single line of events, with time spent at each stop and the legs between',
       'タイムライン：2日目の予定が1本の線に並び、滞在時間と移動を表示'),
  '地圖：宮島一天的步行路線，沿途標出行程與距離': ("Map: a day's walking route on Miyajima, with events and distances along the way",
                                           'マップ：宮島の1日の徒歩ルート。道沿いに予定と距離'),
  '地圖：點開附近的 7-ELEVEN，顯示 24 小時營業與步行導航鈕': ('Map: a nearby 7-Eleven opened, showing it is open 24 hours, with a walking button',
                                                    'マップ：近くのセブン-イレブンを開くと、24 時間営業と徒歩ナビのボタン'),
  '步行導航中：沿著地圖上的路線走向 7-ELEVEN，卡片顯示繼續直行 360 公尺、還有 710 公尺約 9 分':
      ('Walking directions to the 7-Eleven along the route on the map: continue straight, about 9 minutes to go',
       '徒歩ナビ中：マップのルートに沿ってセブン-イレブンへ。カードに「直進 360 m・残り 710 m・9 分」'),
  '旅程共編：分享開關、邀請連結與 QR Code，下方列出旅伴': ('Trip sharing: the sharing switch, invite link and QR code, with companions listed below',
                                                   '旅程の共同編集：共有スイッチ、招待リンクと QR コード、その下に旅の仲間'),
  '分享位置：旅伴的位置出現在地圖上，標示多久前更新': ("Location sharing: companions on the map, showing how long ago each was updated",
                                              '現在地の共有：旅の仲間の位置がマップに表示され、何分前の更新かもわかる'),
  '鎖定畫面上的即時動態：嚴島神社進行中、剩餘時間與下一站': ('Live Activity on the Lock Screen: Itsukushima Shrine under way, time left and the next stop',
                                                     'ロック画面のライブアクティビティ：厳島神社が進行中、残り時間と次の行き先'),
  '主畫面 Widget：今天的行程與匯率換算': ("Home Screen widgets: today's events and a currency converter", 'ホーム画面のウィジェット：今日の予定と為替換算'),
  '筆記：圖文筆記，@ 連到行程，日文句子可以朗讀': ('Notes: text and photos, @ links to events, and Japanese phrases that can be read aloud',
                                          'メモ：写真と文字のメモ。@ で予定にリンクし、フレーズは読み上げも'),
  '匯率換算：台幣與日圓互換，下方是最近的換算紀錄': ('Currency: converting between two currencies, with recent conversions below', '為替換算：2つの通貨を換算し、下に最近の換算履歴'),
  '購物清單：待購、已購、不買了的件數，商品依分類排成照片格': ('Shopping list: counts of to-buy, bought and skipped items, with items in a photo grid by category',
                                                    '買い物リスト：購入予定・購入済み・やめたの件数と、カテゴリ別の写真グリッド'),
  'QR Code 掃描：掃過的網址與文字留在紀錄裡，旅伴也看得到': ('QR code scanner: scanned links and text kept in a history your companions can see too',
                                                     'QR コードスキャン：読み取った URL やテキストが履歴に残り、旅の仲間も見られる'),
  '對話示意：使用者請 AI 排京都第二天，AI 透過 TripEZGo 新增行程': ('Example chat: the user asks AI to plan day two in Kyoto, and the AI adds events through TripEZGo',
                                                       '会話の例：AI に京都の2日目を頼むと、AI が TripEZGo を通じて予定を追加'),
}

HEAD = {
    'en': dict(title='TripEZGo — Plan the trip, carry what it needs, all in one app',
               desc="TripEZGo is a trip planner for iPhone and iPad. Events on a calendar and a timeline, with tickets, files and to-dos attached; a map of each day's route and Japan's convenience stores and department stores; co-edit with companions and share your location on the road; your next stop on the Lock Screen. Your data stays on your device and in your own iCloud."),
    'ja': dict(title='TripEZGo — 旅の計画も、旅先で要るものも、これひとつで',
               desc='TripEZGo は iPhone・iPad の旅行プランナー。予定はカレンダーとタイムラインに、チケット・添付・やることは予定に。マップで1日のルートと日本のコンビニ・百貨店をチェックし、旅の仲間と共同編集、旅先では現在地を共有。次の行き先はロック画面に。データはあなたの端末と iCloud だけに。'),
}

def build(lang):
    i = 0 if lang == 'en' else 1
    old = open(os.path.join(ROOT, lang, 'index.html'), encoding='utf-8').read()
    head = old[:old.index('<link rel="stylesheet"')]
    h = HEAD[lang]
    head = re.sub(r'<title>[^<]*</title>', f'<title>{h["title"]}</title>', head)
    for attr in ('name="description"', 'property="og:description"'):
        head = re.sub(rf'<meta {attr} content="[^"]*">', f'<meta {attr} content="{h["desc"]}">', head)
    head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{h["title"]}">', head)
    head += '<link rel="stylesheet" href="/assets/css/home.css">\n'
    jsonld = old[old.index('<script type="application/ld+json">'):]
    jsonld = jsonld[:jsonld.index('</script>') + 9]
    jsonld = re.sub(r'"description": "[^"]*"', '"description": ' + json.dumps(h['desc'], ensure_ascii=False), jsonld)

    body = SRC[SRC.index('<body>'):SRC.index('</body>')]
    body = re.sub(r'<!--.*?-->\n?', '', body, flags=re.S)  # 註解是繁中的設計說明，英日頁不帶
    missing = set()
    def tr(t):
        if t in T: return T[t][i]
        if re.search(r'[一-鿿]', t): missing.add(t)
        return t
    def text(m):
        raw = m.group(1); t = raw.strip()
        return '>' + raw.replace(t, tr(t)) + '<' if t else m.group(0)
    body = re.sub(r'>([^<>]+)<', text, body)
    body = re.sub(r'(alt|aria-label)="([^"]+)"', lambda m: f'{m.group(1)}="{tr(m.group(2))}"', body)
    if lang == 'en':
        # 中文標題的片段之間不需要空白，英文要：nb 片段、<em> 前面補一個
        body = re.sub(r'(?<=[^\s>])(<span class="nb">|<em>)', r' \1', body)
        body = body.replace('</span><span class="nb">', '</span> <span class="nb">')
    # 連結與語言切換
    body = body.replace('/assets/img/shots/v2/zh/', f'/assets/img/shots/v2/{lang}/')
    body = body.replace('href="/privacy.html"', f'href="/{lang}/privacy.html"').replace('href="/terms.html"', f'href="/{lang}/terms.html"')
    body = body.replace('class="brand" href="/"', f'class="brand" href="/{lang}/"')
    zh_link = '<a class="lang" href="/" hreflang="zh-Hant" lang="zh-Hant">中文</a>'
    if lang == 'en':
        body = body.replace('<a class="lang" href="/en/" hreflang="en" lang="en">EN</a>', zh_link)
        body = body.replace('<a href="/en/" hreflang="en" lang="en">English</a>', '<a href="/" hreflang="zh-Hant" lang="zh-Hant">繁體中文</a>')
    else:
        body = body.replace('<a class="lang" href="/ja/" hreflang="ja" lang="ja">日本語</a>', '<a class="lang" href="/en/" hreflang="en" lang="en">EN</a>')
        body = body.replace('<a class="lang" href="/en/" hreflang="en" lang="en">EN</a>', zh_link, 1)
        body = body.replace('<a href="/ja/" hreflang="ja" lang="ja">日本語</a>', '<a href="/" hreflang="zh-Hant" lang="zh-Hant">繁體中文</a>')
    # 語言名稱本身要留原文（中文／繁體中文／日本語），上面替換後再檢查一次
    missing -= {'中文', '繁體中文', '日本語'}
    if missing:
        sys.exit(f'{lang}: 沒有對照的中文字串：\n' + '\n'.join(sorted(missing)))
    out = head + jsonld + '\n</head>\n' + body + '</body>\n</html>\n'
    open(os.path.join(ROOT, lang, 'index.html'), 'w', encoding='utf-8').write(out)
    print('wrote', lang)

for l in ('en', 'ja'):
    build(l)
