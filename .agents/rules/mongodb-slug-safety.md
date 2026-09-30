---
name: mongodb-slug-safety
description: >
  Safety constraint for MongoDB article insert/update scripts.
  Always verify actual slugs from the DB before writing any update scripts.
---

# MongoDB Slug Safety Rule

## The Problem

Slugs stored in MongoDB may differ from slugs in external audit reports, user-provided lists, or earlier session notes.
Assuming they match without verification causes `update_one()` calls to silently find 0 matching documents — wasting time and requiring extra SSH round-trips to diagnose.

During a live session this caused 8 of 41 update scripts to silently fail (no error, just "0 matched") because:
- Slugs had changed format between audit and insert
- DB slugs had different trailing IDs (e.g. `c44x68` vs `vj93z9`)
- Articles had been renamed/deleted in earlier sessions

## Mandatory Pre-Insert Slug Verification

**BEFORE writing any insert/update script that targets articles by slug, ALWAYS first run this slug dump:**

```python
# slug_dump.py — run this FIRST, before writing any insert script
import pymongo
client = pymongo.MongoClient('mongodb://admin:password123@localhost:27017/ai_news?authSource=admin')
col = client['ai_news']['articles']
for doc in col.find({}, {'slug': 1, 'title': 1, '_id': 0}):
    print(f"{doc['slug']} | {doc.get('title','')[:50]}")
client.close()
```

Then map each target article to its **actual slug** in the DB before writing the insert script.

## Workflow

1. Write `slug_dump.py` locally
2. SCP to server: `scp ... slug_dump.py ubuntu@IP:/tmp/slug_dump.py`
3. SSH run: `ssh ... "python3 /tmp/slug_dump.py 2>&1"`
4. Match targets to actual slugs (fuzzy match on title/keyword if needed)
5. THEN write the insert script with confirmed slugs

## NEVER

- NEVER copy-paste slugs from audit reports or external lists into insert scripts without DB verification
- NEVER assume a slug with the same prefix is the same slug (trailing ID may differ)
- NEVER assume a slug exists just because it was in the DB in a previous session

## Also: Batch verification script pattern

When targeting many slugs at once, use this verification loop:

```python
TARGETS = ['slug-one-abc123', 'slug-two-def456', ...]
for slug in TARGETS:
    doc = col.find_one({'slug': slug}, {'slug': 1, 'title': 1, '_id': 0})
    if doc:
        print(f"✅ {slug[:60]}")
    else:
        print(f"❌ NOT FOUND: {slug[:60]}")
```

Run this BEFORE the actual update loop. If any are NOT FOUND, dump all slugs and fix the mapping before proceeding.
