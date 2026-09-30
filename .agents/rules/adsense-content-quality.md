

# AdSense Content Quality — News Sites

## The #1 Rejection Cause: News Aggregation
Google rejects news sites that rewrite existing sources without adding original value.
The test: "Why would a user visit THIS site instead of reading BBC/Reuters directly?"
If there's no answer → it's rejected as "low value content."

## AI Footprint Detection — Banned Section Headers
NEVER end articles with these formulaic sections (they are detected as AI templates):
- "What Happens Next" / "What to Watch Next" / "What Comes Next"
- "Why It Matters"
- "What Is Coming Next"
- "The Bottom Line" (generic)
- "Editor's Analysis" (when the by-line doesn't match the article author)

Instead use SPECIFIC titles relevant to the article topic:
✅ "Analysis: What Rising Rates Mean for Mortgage Holders"
✅ "The Road Ahead for CRISPR in Clinical Trials"
✅ "Key Factors That Will Determine the Season's Outcome"

## Thin Content Thresholds
- Under 400 words → CRITICAL: noindex or expand immediately
- Under 600 words → HIGH: must expand before AdSense submission
- Under 800 words → MEDIUM: borderline for YMYL topics (health, finance)
- 800–1200+ words → Acceptable IF content is original

## YMYL Articles (Your Money or Your Life)
Health, finance, legal articles require EXTRA scrutiny:
- MUST have a medical/legal disclaimer ("for informational purposes only")
- MUST cite verifiable, authoritative sources (not just restate them)
- SHOULD ideally reference expert credentials or real case studies

## Slug / Title Consistency
- Slug year and title year MUST match (2024 slug + 2026 title = proof of AI hallucination)
- Check: does the slug accurately reflect the current article content?
- Mismatches prove unreviewed AI generation → guaranteed rejection

## Author Credibility (EEAT Signals)
- Author name in article metadata MUST match the signature in any "Editor's Analysis" blocks
- Author social links MUST point to individual profiles, not generic @publication accounts
- Author photos MUST be real/relevant — initials avatars reduce trust score

## Internal Linking
- Every article MUST have at least 2–3 links to other articles on the same site
- Links should be contextual (within prose) not just "Related Reading" widgets
- 89% of articles with zero internal links = clear content farm signal

## Site Credibility
- Physical business address required on About/Contact pages for EEAT
- Author pages need real photos + individual social profiles
- Homepage must show article thumbnails — text-only card grids look like content farms

## Pre-Insert Quality Gate for Subagent-Written Articles

BEFORE inserting ANY article written by a content-writer subagent into MongoDB, verify ALL 5 points:

1. **No placeholder text** — search the content for `[RELATED_LINK` or `[PLACEHOLDER` — if found, resolve all links before inserting
2. **No banned headers** — none of: "What Happens Next", "Why It Matters", "What to Watch", "The Bottom Line", "Looking Ahead", "In Conclusion"
3. **Specific data present** — at least 3 concrete figures, named organisations, case studies, or cited sources
4. **Content is complete** — not truncated mid-sentence (check article ends with `</ul>`, `</p>`, or complete closing tag)
5. **Minimum substance** — 700+ words of body text (rough check: 5+ paragraphs of real depth)

If ANY check fails → request the corrected article from the subagent before inserting.

## Before Resubmitting to AdSense
1. Remove or noindex all purely aggregated articles
2. Keep only articles that add original analysis, data, or perspective
3. Ensure NO article ends with the banned formulaic section headers
4. Verify all thin articles (under 600w) have been expanded
5. Check author hallucinations: Editor's Analysis signature must match article author
6. Confirm site:domain.com returns results in Google Search
7. Only then resubmit
