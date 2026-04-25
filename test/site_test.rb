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

report_dirs = Dir.children(File.join(SITE, "reports")).select do |entry|
  File.directory?(File.join(SITE, "reports", entry)) && entry =~ /\A\d{4}-\d{2}\z/
end.sort
assert(!report_dirs.empty?, "Expected at least one built report under _site/reports/")
latest_report_slug = report_dirs.last

index_html = read_site_file("index.html")
report_html = read_site_file("reports/#{latest_report_slug}/index.html")
articles_html = read_site_file("articles.html")
css = read_site_file("assets/css/main.css")
index_doc = Nokogiri::HTML(index_html)
report_doc = Nokogiri::HTML(report_html)

# Homepage SEO/meta structure
assert(index_doc.at("title")&.text&.end_with?("| Tripezgo"), "Homepage title should be suffixed with site name")
assert(!index_doc.at('meta[name="description"]')&.[]("content").to_s.strip.empty?, "Homepage description should not be empty")
assert(index_doc.at('link[rel="canonical"]')&.[]("href") == "https://tripezgo.com/", "Homepage should render canonical URL")
assert(!index_doc.at('meta[property="og:title"]')&.[]("content").to_s.strip.empty?, "Homepage should render Open Graph title")
assert(index_doc.at('meta[property="og:image"]')&.[]("content")&.start_with?("https://"), "Homepage should render Open Graph image")
assert(index_doc.at('meta[name="twitter:card"]')&.[]("content") == "summary_large_image", "Homepage should render Twitter card")

index_json_ld = JSON.parse(index_doc.at('script[type="application/ld+json"]').text)
assert(index_json_ld["@type"] == "CollectionPage", "Homepage JSON-LD should describe a collection page")
assert(index_json_ld.dig("mainEntity", "@type") == "ItemList", "Homepage JSON-LD should include product item list")

# Homepage structural sections
assert(index_html.scan("立即查看商品").size >= 6, "Homepage should render product CTAs")
assert(index_html.include?("延伸旅遊文章"), "Homepage should render travel article section")
assert(!index_html.include?("本月編輯備註"), "Homepage should not render monthly editor note section")
assert(index_html.include?("KKday") && index_html.include?("聯盟行銷"), "Homepage should render KKday affiliate disclaimer")

# Latest monthly report page
assert(report_html.include?("KKday") && report_html.include?("聯盟行銷"), "Monthly report page should render KKday affiliate disclaimer")
assert(!report_html.include?("本月編輯備註"), "Monthly report page should not render monthly editor note section")
assert(report_doc.at('link[rel="canonical"]')&.[]("href") == "https://tripezgo.com/reports/#{latest_report_slug}/", "Monthly report page should render canonical URL")
assert(report_doc.at('meta[property="og:type"]')&.[]("content") == "article", "Monthly report page should render article Open Graph type")

# Older reports should link back to the latest report
older_report_slugs = report_dirs - [latest_report_slug]
older_report_slugs.each do |slug|
  older_html = read_site_file("reports/#{slug}/index.html")
  assert(older_html.include?("回到最新快報"), "Older report #{slug} should link back to latest report")
end

# Static/built artefacts
assert(articles_html.strip.empty?, "Article data source page should not render visible content")
assert(css.include?(".deal-grid"), "Compiled CSS should include editorial deal grid styles")
assert(css.include?(".masthead"), "Compiled CSS should include masthead styles")
assert(!css.include?(".editor-note"), "Compiled CSS should not include removed editor note styles")

# Countdown timestamps must always parse as ISO8601 if present
index_html.scan(/data-offer-ends-at="([^"]+)"/).flatten.each do |timestamp|
  Time.iso8601(timestamp)
end

# External link safety on product CTAs
external_ctas = index_html.scan(/<a class="deal-cta"[^>]+>/)
assert(!external_ctas.empty?, "Homepage should render at least one product CTA")
assert(external_ctas.all? { |tag| tag.include?('target="_blank"') }, "Product CTAs should open in a new tab")
assert(external_ctas.all? { |tag| tag.include?('rel="noopener noreferrer"') }, "Product CTAs should use safe external rel")

# Product/category heading structure (content-agnostic)
assert(index_doc.css("h3.cat-title").any?, "Homepage should render product categories as h3.cat-title")
assert(index_doc.css(".deal-body h4").any?, "Homepage should render product titles as h4 inside deal cards")
assert(index_html.include?("deal-tags"), "Homepage should render product tags")

# Travel article cards
assert(index_html.include?("article-photo"), "Homepage should render editorial article cards")
assert(!index_html.include?("example.com/articles"), "Homepage should not render placeholder article URLs")
assert(!index_html.include?("Z 度旅行遊記"), "Homepage should render article-specific source labels")
assert(index_html.include?('data-random-limit="3"'), "Homepage should limit random article cards to three")
assert(index_html.scan('class="article"').size > 3, "Homepage should render a pool of article cards for random selection")
visible_articles = index_doc.css("a.article").count { |node| !node.key?("hidden") }
assert(visible_articles == 3, "Homepage should render three visible fallback article cards")
assert(index_doc.css("a.article[hidden]").size > 0, "Homepage should hide extra article cards for progressive randomization")
