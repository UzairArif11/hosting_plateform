
## Phase 1.5: Programmatic Health Check (Required)
Before moving to Phase 2 (Live Visual Verification), the agent MUST run a Python-based health check script against the MongoDB database for the newly generated articles.

The script MUST programmatically verify:
1. `wc >= 400` (Word count is sufficient).
2. `len(int_links) > 0` (Internal links exist).
3. `len(ext_links) > 0` (External links exist).
4. `len(wiki_special_search) == 0` (No broken Wikipedia links).

If the script returns `FAIL`, the agent must fix the database payload and re-run the health check before triggering a Next.js rebuild.

## Phase 3: Self-Healing Maintenance & Cache Invalidaton
If utilizing the backend /utils/selfHealing.js script to automatically audit and fix articles:

1. **Monitor the API:** Watch the script's output. If the unifiedAI service returns "Service temporarily overloaded", manually apply the fixes to MongoDB instead of waiting for the script to hang.
2. **Mandatory Cache Purge:** After any article is 'healed' in the database, you MUST execute the following command to make the fixes live:
   `ssh -i "KEY" ubuntu@IP "cd /home/ubuntu/ai-news/frontend && rm -rf .next/cache && npm run build && pm2 restart ai-news-frontend"`
3. **Visual Re-Verification:** Always run the `browser` subagent post-rebuild to ensure the LLM's inline fixes didn't break HTML formatting.

## Phase 4: Over-Correction and Hallucination Risks
1. **Perfect Content Paradox:** If an article is already exceptionally high-quality and only requires minor technical SEO fixes (e.g., fixing a broken link), the self-healing LLM may attempt to "over-correct" the text, leading to fabricated statistics, hallucinated dates, or placeholder domains (like `example.com`).
2. **Double-Verify Reliance:** Always ensure the `llmDoubleVerify` step is active. It is highly effective at catching these hallucinations and will correctly demote the article to `review` status to protect the live site.
3. **Manual Override:** If an article is demoted to `review` due to a hallucinated fix, bypass the self-healing LLM and apply the minor technical fixes manually via database scripts, then restore the status to `published`.
