# Visual & UX Verification Rule

## Never Assume Regex or Bulk DB Fixes Are Safe
When making structural changes to the frontend code (Next.js components) or bulk updating database schemas (like user avatars, links, or metadata):
1. **Never assume it worked perfectly just because the script exited 0.**
2. **Deeply Preview:** You MUST use the rowser subagent (or equivalent visual inspection tool) to load the affected pages and verify the layout did not break.
3. **Check for Bleeding Data:** Specifically look for broken images, raw URL text spilling into the DOM, or unescaped HTML. Quality takes time; do it right rather than fast.
