# HVAC Second Opinion — Custom Domain Migration Runbook & Experiment Freeze Rules

## 1. Pre-Migration Checklist (Before Merging This Branch)
1. Register **`hvac-second-opinion.com`** (Cloudflare Registrar recommended for instant DNS setup). Do **not** wait for `hvacsecondopinion.com`.
2. In **Cloudflare Dashboard → Workers & Pages → `hvac-second-opinion` → Custom domains**:
   - Add `hvac-second-opinion.com` (apex, primary)
   - Add `www.hvac-second-opinion.com` (automatically 301-redirected to apex by `functions/_middleware.ts`)
3. Confirm TLS certificates show **Active** for both `hvac-second-opinion.com` and `www.hvac-second-opinion.com`.

## 2. One-Shot Migration Deploy Commands
Once custom domains are Active in Cloudflare Pages:

```bash
cd /Users/hemrmicloud.com/Developer/antigravity-ai-scratch/hvac-second-opinion
git checkout main
git merge --ff-only migration/custom-domain
npm run typecheck && npm run build && npm test
grep -rn "pages\.dev" dist/ || echo "ZERO_PAGES_DEV_HITS"
git push origin main

CI=true CLOUDFLARE_ACCOUNT_ID=f3058e60c84ec0cbd9c7c8bf8965069a \
  npx --yes wrangler@4.162.0 pages deploy dist \
  --project-name=hvac-second-opinion --branch=main --commit-dirty=true
```

> Note: Keeping `functions/_middleware.ts` in the project root ensures Wrangler bundles it automatically with `dist/` to enforce:
> - `https://hvac-second-opinion.pages.dev/*` → **301** `https://hvac-second-opinion.com/*` (preserving path & query)
> - `https://www.hvac-second-opinion.com/*` → **301** `https://hvac-second-opinion.com/*` (preserving path & query)
> - `https://<hash>.hvac-second-opinion.pages.dev/*` preview deployments → `X-Robots-Tag: noindex, nofollow`

## 3. Post-Deploy Verification Script (Step 3 Acceptance)

```bash
# 1. Verify all 11 .com URLs return 200 and self-referencing canonicals
for path in "/" "/guides/" "/guides/how-to-read-hvac-quote/" "/guides/5000-rule/" \
  "/guides/r22-refrigerant/" "/guides/seer2-explained/" \
  "/guides/how-to-vet-hvac-contractor/" "/guides/signs-your-hvac-is-dying/" \
  "/about/" "/privacy/" "/contact/"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://hvac-second-opinion.com${path}")
  canon=$(curl -s "https://hvac-second-opinion.com${path}" | grep -o '<link rel="canonical"[^>]*>')
  echo "${path} -> HTTP ${code} | ${canon}"
done

# 2. Verify all 11 old pages.dev URLs return single-hop 301 to .com + 200 final
for path in "/" "/guides/" "/guides/how-to-read-hvac-quote/" "/guides/5000-rule/" \
  "/guides/r22-refrigerant/" "/guides/seer2-explained/" \
  "/guides/how-to-vet-hvac-contractor/" "/guides/signs-your-hvac-is-dying/" \
  "/about/" "/privacy/" "/contact/"; do
  curl -sI "https://hvac-second-opinion.pages.dev${path}" | grep -iE '^(HTTP/|location:)'
done

# 3. Verify www -> apex 1-hop 301, /about slash normalization, fake path 404, preview noindex
curl -sI "https://www.hvac-second-opinion.com/x/" | grep -iE '^(HTTP/|location:)'
curl -sI "https://hvac-second-opinion.com/about" | grep -iE '^(HTTP/|location:)'
curl -sI "https://hvac-second-opinion.com/non-existent-test-path/" | head -n 3
curl -sI "https://hvac-second-opinion.com/sitemap.xml" | head -n 3
curl -s "https://hvac-second-opinion.com/sitemap.xml" | grep -c '<loc>https://hvac-second-opinion.com/'
```

## 4. Search Engine Setup Order (Step 4 — User in GSC & Bing)
1. Create a **Domain property** for `hvac-second-opinion.com` in Google Search Console (DNS TXT verification).
2. After Section 3 verification passes, submit `https://hvac-second-opinion.com/sitemap.xml`.
3. Run URL Inspection on `https://hvac-second-opinion.com/`.
4. Request Indexing for **8 URLs** across 1–2 days if daily quota hits (priority order: `/`, `/guides/5000-rule/`, `/guides/r22-refrigerant/`, `/guides/`, plus remaining 4 guides). Record dates & any quota limit.
5. Attempt GSC **Change of Address** (`hvac-second-opinion.pages.dev` → `hvac-second-opinion.com`); if Google rejects cross-property move for `.pages.dev`, record result (HTTP 301 remains primary signal).
6. Import verified `hvac-second-opinion.com` domain into **Bing Webmaster Tools** with `.com` sitemap (optionally enable Cloudflare Crawler Hints / IndexNow).
7. Keep the old `pages.dev` GSC property active to monitor redirect handling.

## 5. Experiment Freeze & Review Rules (Step 5)
- **Target Go-Live Deadline**: Before `2026-12-01` (if live date slips significantly past `2026-12-01`, shift the `2027-01-26` review date forward by the same number of days).
- **Freeze Window (Go-Live → `2027-01-26`)**:
  - **Do NOT** add new guides, redesign visuals, or add new features (including Phase 2 regional fair-price checks).
  - **Only** fix documented issues (uptime/access, indexing configuration, calculator bugs, broken links) and log each change with its date in the Change Log below.
- **Scheduled Technical Checks**:
  - **Check #1 (~`2026-12-08`, 7 days post-launch)** & **Check #2 (`2026-12-15`)**: verify 301s still active, sitemap status, ≥1 `.com` URL indexed, and check for `"Google chose different canonical"` warnings. Fix technical errors only.
- **`2027-01-26` Experiment Decision**:
  - Measure using the **latest complete 28-day GSC window** (record exact window dates; do not use rigid dates cut off by GSC lag).
  - **Continue condition**: **`>= 8/11` `.com` URLs indexed AND `>= 100` organic impressions in 28 days**. Otherwise park the project (keep site up, stop development, do not renew domain).
  - **Scale-up bar** (for Phase 2 regional fair-price check & Check D expansion): experiment passed AND **`>= 150` impressions** AND **`>= 1` relevant query at average position <= 20**.
- **Documented Technical Fault Policy**: Record any verified technical crawl/indexing outage with evidence and dates; user decides whether to re-evaluate after repair (optional Feb 23 clause pending user sign-off).

## 6. Post-Launch Change Log
| Date | Scope | Evidence / Reason |
|---|---|---|
| `YYYY-MM-DD` | `.com` Cutover Launch | Initial custom domain deployment (`commit` / GSC verification) |
