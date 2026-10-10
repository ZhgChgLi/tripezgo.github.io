#!/usr/bin/env python3
"""把 App repo 的範本旅程與行程類型名稱複製進 screens/data/。

用法：python3 tools/sync-screen-data.py [App repo 路徑，預設 ~/Projects/tripezgo]
範本或類型名稱在 App 裡改了，就重跑這支——screens/data/ 裡的檔案不要手改。
"""
import json, os, shutil, sys

app = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else '~/Projects/tripezgo')
here = os.path.join(os.path.dirname(__file__), '..', 'screens', 'data')
tpl = os.path.join(app, 'App/iOS/Modules/TripEZGoData/Sources/TripEZGoData/TripTemplateResources')
LANGS = ['zh-Hant-TW', 'en', 'ja']

for l in LANGS:
    shutil.copy(os.path.join(tpl, l, 'jp-sanyo-hiroshima-okayama-6d.json'), os.path.join(here, f'sanyo.{l}.json'))

domain = json.load(open(os.path.join(app, 'Scripts/i18n/maps/Domain.json')))
cats = {l: {} for l in LANGS}
for e in domain['entries']:
    k = e['key']
    if k.startswith('domain.eventtype.'):
        for l in LANGS:
            cats[l][k.split('.')[-1]] = e.get(l)
json.dump(cats, open(os.path.join(here, 'categories.json'), 'w'), ensure_ascii=False, indent=1)
print('synced', LANGS, len(cats['en']), 'categories')
