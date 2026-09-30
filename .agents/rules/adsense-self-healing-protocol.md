# Agentic Self-Healing Protocol

Any script or automated background job that "heals", rewrites, or audits content (e.g. selfHealing.js) MUST implement the following multi-agent workflow:

1. **Agentic Deep Audit:** The script cannot rely solely on regex or word counts. It must pass the full text to an LLM with a strict prompt to read every single word and evaluate it against E-E-A-T and AdSense quality guidelines.
2. **Triaging:** The audit must return a structured decision (e.g., JSON PASS, FIX, REWRITE) along with a detailed reasoning.
3. **Targeted Action:** 
   - If FIX: Use an LLM to precisely patch the identified issues inline without destroying the overall article.
   - If REWRITE: Trigger the full grounded research pipeline.
4. **Double Verification (Mandatory):** BEFORE saving any changes to the database, the new draft MUST be passed to a second, independent LLM validation prompt (the "Quality Gatekeeper") to verify that the issues were actually fixed and no new ones were introduced. If it fails, the article must be demoted to human review.
