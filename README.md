# Lead Finder (SiteOn)

A simple static lead viewer (dark/light, search, filters, CSV download) hosted on GitHub Pages from the `docs/` folder.

Live: https://21f1000419.github.io/siteon-leads/

## Add a new lead list (no code)

1. Put a file in `docs/data/` — either **CSV** or **JSON**. Columns (any can be blank):

   `score, name, website, category, city, state, country, emails, phones, whatsapp, instagram, facebook, linkedin, platform, issues, pitch, screenshot, status, notes`

   Multiple emails/phones in CSV go in one cell separated by ` | `.
   Tip: download an existing list as CSV from the site and use it as a template.
2. Add an entry to `docs/data/lists.json`:

   ```json
   { "id": "dentists-jaipur-2026-12", "title": "Dentists · Jaipur", "file": "dentists-jaipur.csv", "created": "2026-12-01", "description": "…" }
   ```
3. Commit & push (or upload via GitHub's "Add file → Upload files"). The new list shows up in the list dropdown in ~1 minute.

## Regenerate leads with the tools

```
cd tools && npm i
node shot.mjs ../shots ../data/candidates.txt ../data/scraped.jsonl   # screenshot + scrape contacts
node sheets.mjs ../data/scraped.jsonl ../shots ../sheets/wN           # 2x2 contact sheets for visual rating
python3 build.py                                                       # ratings + scrape -> docs/data/*.json
```

Ratings live in `data/ratings_*.jsonl` (one JSON per site: `host, score, issues, pitch, keep`), scored against `data/rubric.md`.
