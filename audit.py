import urllib.request
import urllib.error
import json
import time

urls = {
    "Authors": [
        "https://newsbuzz.site/author/Sarah%20Mitchell",
        "https://newsbuzz.site/author/Rachel%20Chen",
        "https://newsbuzz.site/author/David%20Walsh",
        "https://newsbuzz.site/author/Priya%20Sharma",
        "https://newsbuzz.site/author/James%20Whitfield"
    ],
    "Articles": [
        "https://newsbuzz.site/article/anthony-davis-nba-superstars-impact-on-court-business-and-global-basketball-v7azty",
        "https://newsbuzz.site/article/the-open-championship-2026-44d15y",
        "https://newsbuzz.site/article/mikel-merino-the-complete-midfielder-shaping-spains-future-5a0ixd",
        "https://newsbuzz.site/article/jacob-bethells-meteoric-rise-from-warwickshire-prospect-to-england-international-sensation-bm91un",
        "https://newsbuzz.site/article/man-utd-nearing-tielemans-signing-after-villa-release-clause-trigger-1jlynb",
        "https://newsbuzz.site/article/apple-retakes-the-crown-from-nvidia-as-ai-trade-rotates-r9rwl2",
        "https://newsbuzz.site/article/gold-44d15y",
        "https://newsbuzz.site/article/gold-rally-2025-how-geopolitics-and-inflation-fuel-global-demand-ul0ymh",
        "https://newsbuzz.site/article/tcs-lands-jfk-airport-abb-ai-deals-amid-32percent-stock-slide-jyxuxf",
        "https://newsbuzz.site/article/scotusblog-explained-influence-coverage-and-impact-on-supreme-court-reporting-aga1xk",
        "https://newsbuzz.site/article/texas-flash-floods-kill-two-force-200-rescues-one-year-after-deadly-camp-mystic-disaster-vcdys8",
        "https://newsbuzz.site/article/pakistan-beats-sri-lanka-in-asia-cup-2025-both-get-direct-asian-games-2026-entry-mde98g",
        "https://newsbuzz.site/article/crispr-gene-editing-human-disease-clinical-trials-2025-2026",
        "https://newsbuzz.site/article/cyclospora-outbreaks-surge-understanding-the-parasite-behind-rising-foodborne-illness-z34d6o",
        "https://newsbuzz.site/article/ozempic-wegovy-glp1-weight-loss-drugs-science-2026",
        "https://newsbuzz.site/article/flipkarts-evolution-from-startup-giant-to-indias-ecommerce-powerhouse-u6es4x",
        "https://newsbuzz.site/article/four-day-work-week-global-trials-results-data-2025-2026",
        "https://newsbuzz.site/article/habit-formation-science-routines-behaviour-change-research-2025"
    ],
    "Categories": [
        "https://newsbuzz.site/category/sports",
        "https://newsbuzz.site/category/business",
        "https://newsbuzz.site/category/world",
        "https://newsbuzz.site/category/health",
        "https://newsbuzz.site/category/technology"
    ]
}

results = {}

for category, url_list in urls.items():
    for url in url_list:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8')
                status = response.getcode()
                results[url] = {"status": status, "html": html}
        except urllib.error.HTTPError as e:
            results[url] = {"status": e.code, "html": ""}
        except Exception as e:
            results[url] = {"status": str(e), "html": ""}
        time.sleep(0.5)

with open("audit_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("Done fetching URLs")
