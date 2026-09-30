---
trigger: always_on
---

# AdSense & Web Publishing Best Practices

## HTML: Never Nest `<a>` Inside `<a>`
Nested anchor tags are **invalid HTML** — browsers silently drop the inner link.
- ✅ If a card is `<a href="/article">`, show author as styled `<span>` text  
- ❌ Never `<a href="/article"><a href="/author">Author</a></a>`
- Next.js server components also reject `onClick` handlers — use CSS-only solutions

## robots.txt Must Explicitly Allow AdSense Crawler
Always include in `robots.js` or `robots.txt`:
```
User-Agent: Mediapartners-Google
Allow: /
```
Without this, Google's AdSense crawler may be blocked by wildcard deny rules.

## Check Google Indexing BEFORE AdSense Submission
Run `site:domain.com` in Google Search. If results = 0:
1. Verify site in Google Search Console
2. Submit sitemap.xml
3. Request indexing for key pages
4. Wait 3–14 days for articles to appear
5. Only then resubmit to AdSense

## Article Timestamps
- Set to ACTUAL publish time, not backdated
- Google Analytics has no data for fake past dates → looks fraudulent
- Articles published same day: use 2-minute natural gaps (e.g. 14:47, 14:49, 14:51)
- Do NOT use midnight or identical timestamps for multiple articles

## AdSense Minimum Quality Signals
Before submitting/resubmitting:
- [ ] Privacy policy: GDPR, DoubleClick, aboutads.info, google.com/settings/ads, legal basis
- [ ] Author bylines on every article (linked to author profile pages)
- [ ] Author profile pages with bio + expertise + social links
- [ ] About page with founding year + editorial mission
- [ ] Editorial guidelines page
- [ ] Contact page with email or form
- [ ] robots.txt: allows Mediapartners-Google + Googlebot
- [ ] Sitemap submitted to Google Search Console
- [ ] No noindex on public article/about/privacy pages
- [ ] Google Consent Mode v2 with default denied for ad_storage
- [ ] Cookie banner has Accept AND Decline buttons
- [ ] site:domain.com returns results in Google

## External Links & Citations
- **Must Be Organic:** Never dump external links into a bulleted "Sources" list at the bottom of the article.
- **No Mechanical Appending:** Do not mechanically append (Source: <link>) to the end of paragraphs.
- **Inline Weaving:** External links MUST be woven organically into the prose, just as a human journalist would write it.
  - ? 'According to <a href="..." target="_blank" rel="noopener">The National Weather Service</a>, the floods...'
  - ? '...a distinctive feature of the current market is what <a href="..." target="_blank" rel="noopener">economists at Freddie Mac call</a> the lock-in effect.'
  - ? 'The market is locked. (Source: <a href="...">Freddie Mac</a>)'

## Internal Linking
- **Must Be Contextual:** Every article MUST contain at least 2 organic internal links woven naturally into the body paragraphs (e.g., "For further context, see our analysis on [topic](/article/slug)").
- **Never Footer Only:** Do not rely solely on "Read Next" or "Related Reading" blocks at the bottom of the article. AdSense considers contextual in-body links mandatory.

## External Linking (Wikipedia Policy)
- **Wikipedia is Allowed:** You may use Wikipedia as a source.
- **NO Search URLs:** NEVER link to "https://en.wikipedia.org/wiki/Special:Search?search=...".
- **Direct URLs Only:** You must resolve the URL to the exact article page.
