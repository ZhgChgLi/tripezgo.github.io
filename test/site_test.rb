# frozen_string_literal: true

require "time"
require "json"
require "nokogiri"

ROOT = File.expand_path("..", __dir__)
SITE = File.join(ROOT, "_site")

def assert(condition, message)
  raise "FAILED: #{message}" unless condition
end

def read_site_file(path)
  full_path = File.join(SITE, path)
  assert(File.file?(full_path), "Expected #{path} to exist")
  File.read(full_path)
end

index_html = read_site_file("index.html")
report_html = read_site_file("reports/2026-04/index.html")
articles_html = read_site_file("articles.html")
css = read_site_file("assets/css/main.css")
js = read_site_file("assets/js/countdown.js")
index_doc = Nokogiri::HTML(index_html)
report_doc = Nokogiri::HTML(report_html)

assert(index_html.include?("2026 四月春夏出走優惠"), "Homepage should render the latest report title")
assert(index_doc.at("title")&.text == "2026 四月春夏出走優惠 | Tripezgo", "Homepage title should use latest report title")
assert(index_doc.at('meta[name="description"]')&.[]("content")&.include?("韓國、日本、港澳"), "Homepage description should use latest report intro")
assert(index_doc.at('link[rel="canonical"]')&.[]("href") == "https://tripezgo.com/", "Homepage should render canonical URL")
assert(index_doc.at('meta[property="og:title"]')&.[]("content") == "2026 四月春夏出走優惠", "Homepage should render Open Graph title")
assert(index_doc.at('meta[property="og:image"]')&.[]("content")&.start_with?("https://"), "Homepage should render Open Graph image")
assert(index_doc.at('meta[name="twitter:card"]')&.[]("content") == "summary_large_image", "Homepage should render Twitter card")
index_json_ld = JSON.parse(index_doc.at('script[type="application/ld+json"]').text)
assert(index_json_ld["@type"] == "CollectionPage", "Homepage JSON-LD should describe a collection page")
assert(index_json_ld.dig("mainEntity", "@type") == "ItemList", "Homepage JSON-LD should include product item list")
assert(index_html.scan("立即查看商品").size >= 6, "Homepage should render product CTAs")
assert(index_html.include?("延伸旅遊文章"), "Homepage should render travel article section")
assert(!index_html.include?("本月編輯備註"), "Homepage should not render monthly editor note section")
assert(report_html.include?("回到最新快報"), "Monthly report page should link back to latest report")
assert(!report_html.include?("本月編輯備註"), "Monthly report page should not render monthly editor note section")
assert(report_doc.at('link[rel="canonical"]')&.[]("href") == "https://tripezgo.com/reports/2026-04/", "Monthly report page should render canonical URL")
assert(report_doc.at('meta[property="og:type"]')&.[]("content") == "article", "Monthly report page should render article Open Graph type")
assert(index_html.include?("KKday") && index_html.include?("聯盟行銷"), "Homepage should render KKday affiliate disclaimer")
assert(report_html.include?("KKday") && report_html.include?("聯盟行銷"), "Monthly report page should render KKday affiliate disclaimer")
assert(articles_html.strip.empty?, "Article data source page should not render visible content")
assert(css.include?(".deal-grid"), "Compiled CSS should include editorial deal grid styles")
assert(css.include?(".masthead"), "Compiled CSS should include masthead styles")
assert(!css.include?(".editor-note"), "Compiled CSS should not include removed editor note styles")
assert(js.include?("node.hidden = true"), "Countdown script should hide expired offer countdowns")
assert(js.include?("randomizeArticles"), "Main script should randomize article cards")

index_html.scan(/data-offer-ends-at="([^"]+)"/).flatten.each do |timestamp|
  Time.iso8601(timestamp)
end

external_ctas = index_html.scan(/<a class="deal-cta"[^>]+>/)
assert(external_ctas.all? { |tag| tag.include?('target="_blank"') }, "Product CTAs should open in a new tab")
assert(external_ctas.all? { |tag| tag.include?('rel="noopener noreferrer"') }, "Product CTAs should use safe external rel")
assert(index_html.include?("cat-title"), "Homepage should render product category headings")
assert(index_html.include?("<h3 class=\"cat-title\">韓國計畫機票</h3>"), "Homepage should render product categories as h3")
assert(index_html.include?("<h4>易斯達航空桃園出發首爾濟州釜山清州計畫機票</h4>"), "Homepage should render product titles as h4")
assert(index_html.include?("article-photo"), "Homepage should render editorial article cards")
assert(index_html.include?("北海道札幌6日遊攻略"), "Homepage should render imported travel articles")
assert(!index_html.include?("example.com/articles"), "Homepage should not render placeholder article URLs")
assert(!index_html.include?("Z 度旅行遊記"), "Homepage should render article-specific source labels")
assert(index_html.include?('data-random-limit="3"'), "Homepage should limit random article cards to three")
assert(index_html.scan('class="article"').size > 3, "Homepage should render a pool of article cards for random selection")
visible_articles = index_doc.css("a.article").count { |node| !node.key?("hidden") }
assert(visible_articles == 3, "Homepage should render three visible fallback article cards")
assert(index_doc.css("a.article[hidden]").size > 0, "Homepage should hide extra article cards for progressive randomization")
assert(index_html.include?("deal-tags"), "Homepage should render product tags")
