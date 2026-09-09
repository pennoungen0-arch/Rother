# JKPRO Property Automation + Website + Dashboard V2 Handoff

**Generated:** 2026-06-29  
**Project context:** Auto Upload Properti / JKPRO property automation  
**Primary owner context:** JKPRO / PT. Janlus Kaeng Propertindo  
**Purpose:** Comprehensive handoff for continuing the JKPRO property website, listing extraction, Dashboard V2/control-panel, and automation workflow in a fresh chat or coding session.

---

## 0. Very Short Current State

The current active work is **not adding another new listing yet**.

```text
Automation repo: clean
Website repo: clean
Current export intake batch: complete
Unprocessed Edge export folders: none
Public website listing count: 24
Latest public listing: id 31 / rumah-klender-001
Latest website commit: 2923644 feat: add rumah-klender-001 listing
Latest automation docs commit: bbb6c89 docs: record existing listings audit
Latest website tag shown by helper snapshot: auto-export-014
Cloudflare live site: https://jkpro.pages.dev
Current deploy ZIP: 21.57 MB, accepted by Cloudflare during Klender upload despite helper warning
```

Current milestone:

```text
5AP ✅ Existing Listings Audit / Polish Planning — completed and committed
5AQ 🔲 Next — Review kost-kelapadua-001 Polish Scope
```

The immediate next action should be **inspection only** for `kost-kelapadua-001`, because the audit identified it as the only high-priority review item.

Do **not** bulk edit 17 medium-priority listings.  
Do **not** start Phase 1.  
Do **not** rebuild deploy ZIP.  
Do **not** upload to Cloudflare.  
Do **not** tag.  
Do **not** edit website data until `kost-kelapadua-001` polish scope is inspected and explicitly planned.

---

## 1. Big Picture: The Four Sub-Projects

The project has grown into a larger JKPRO real-estate operating system. There are currently three active sub-projects and one planned future sub-project.

### 1.1 Real Estate Listings / Catalogue Website

Goal:

```text
A static, fast, mobile-friendly JKPRO public property catalogue website.
```

Current public URL:

```text
https://jkpro.pages.dev
```

Main properties:

- Fully static website.
- No backend.
- No public login.
- No CMS yet.
- No online payment.
- No auto Cloudflare upload.
- Contact through WhatsApp CTA.
- Hosted through Cloudflare Pages by manual upload.
- Public data lives in `data/listings.json`.
- Images live under `images/properties/<slug>/optimized/`.

Current known status:

```text
Public listings: 24
Latest listing id: 31
Latest listing slug: rumah-klender-001
Latest website commit: 2923644 feat: add rumah-klender-001 listing
Latest helper-reported tag: auto-export-014
```

Current live-verified latest listing:

```text
id: 31
slug: rumah-klender-001
title: Rumah Second Strategis di Duren Sawit Klender Jakarta Timur
priceLabel: Rp 4,9 Miliar
location: Duren Sawit Klender, Jakarta Timur
landSize: 300
area: 190
bedrooms: 3
bathrooms: 3
floors: 2
carport: 1
garage: 1
certificate: SHM + IMB
electricityText: 2200 Watt
waterSourceText: Jetpump & PAM
dimensionText: Dimensi 15 x 20 m
orientation: Arah Timur
accessRoad: Akses 2 mobil
image count: 24
agent: Olga Vera Kaeng / 628111741976 / Marketing
```

### 1.2 Real Estate Auto Extract Google Groups Listings Project

Goal:

```text
Take Google Groups / Gmail-style listing text and attachments, then create local draft listing data.
```

Main source folder:

```powershell
D:\Downloads (D)\JKPRO-Extracts
```

Workflow:

```text
Edge extension export folder
→ source.txt + images
→ Phase 1 draft-listing.json
→ human review/edit
→ Phase 2 dry-run/apply to website JSON
```

Current current export batch status:

```text
All export folders under D:\Downloads (D)\JKPRO-Extracts are FOUND in website data.
No NOT FOUND export folders remain.
Current intake batch is complete.
```

Important helper result from 5AO:

```text
No unprocessed export folders found.
```

### 1.3 Real Estate Auto Upload Systems Project

Goal:

```text
Eventually help prepare or upload listing content to other real estate marketplaces and social media.
```

Current status:

```text
Not active for auto-posting yet.
No marketplace auto-posting.
No spam posting.
No auto-upload.
No platform automation without future review.
```

Current philosophy:

```text
Manual review first.
Human approval required.
Respect platform rules.
No direct public auto-publish in MVP.
```

### 1.4 Future Lead / Client Database + Auto Reply Project

Future goal:

```text
Quickly save incoming leads from WhatsApp/social apps,
sort them into a tidy lead/client database,
auto-reply safely,
and alert the admin or related real estate agent.
```

Current status:

```text
Planned future sub-project only.
No implementation yet in JKPRO automation repo.
```

Safety note:

```text
No customer lead automation without proper consent and clear privacy handling.
```

---

## 2. Active Repository Paths

Main parent:

```powershell
D:\Documents (D)\Softwares\test website\properti-projects
```

Automation repo:

```powershell
D:\Documents (D)\Softwares\test website\properti-projects\properti_automation-v0.3.0
```

Website repo:

```powershell
D:\Documents (D)\Softwares\test website\properti-projects\properti_website
```

Live site:

```text
https://jkpro.pages.dev
```

Deploy package:

```powershell
D:\Documents (D)\Softwares\test website\properti-projects\properti_website\deploy\jkpro-pages-upload-latest-small.zip
```

Small deploy folder:

```powershell
D:\Documents (D)\Softwares\test website\properti-projects\properti_website\deploy\properti_website_public_small
```

Important upload rule:

```text
Upload the contents of deploy\properti_website_public_small as the flat Cloudflare root.
Avoid uploading a wrapper folder.
```

---

## 3. Current Latest Commits and Milestones

### 3.1 Automation Repo Latest Known Commits

Latest confirmed log from the current conversation:

```text
bbb6c89 docs: record existing listings audit
44be5a8 docs: record no remaining export candidates
be0f9c6 docs: record post-live monitoring after rumah klender
ac2c85a docs: record rumah klender live verification
da75fb0 docs: record rumah klender deploy package
937c02b docs: record rumah klender apply milestone
ed79ff5 docs: record post-live monitoring after rumah padurenan
621b3df docs: record rumah padurenan live verification
d427265 docs: record rumah padurenan deploy package
74df217 docs: record rumah padurenan apply milestone
```

Current automation repo state after `bbb6c89`:

```text
git status --short: clean
```

### 3.2 Website Repo Latest Known Commit

```text
2923644 feat: add rumah-klender-001 listing
```

Current website repo state during recent helper snapshots:

```text
git status short: clean
```

### 3.3 Latest Website Tag

Helper option 24 recently showed:

```text
latest website repo tag: auto-export-014
```

Important:

```text
Do not create a new tag unless a specific later milestone asks for it.
```

---

## 4. Helper Menu Current Options

Start helper:

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_automation-v0.3.0"
python scripts\jkpro_helper.py
```

Current helper menu:

```text
1. Show git status for both repos
2. List newest Edge extension export folders
3. Process an exact export folder name through Phase 1
4. Inspect a draft summary
5. Run Phase 2 dry-run for a selected draft
6. Apply Phase 2 export only after explicit confirmation
7. Validate latest website listing image paths
8. Print safe next-step checklist
9. Exit
10. Edit draft review fields
11. Edit draft location/title
12. Edit draft enrichment fields
13. Fix latest website m2 encoding
14. Show latest website listing JSON summary
15. Preview website detail sections for latest listing
16. Reorder draft images / choose cover image
17. Check if listing already exists in website data
18. List export folders with website existence status
19. Build Cloudflare deploy package
20. Final local safety check
21. Show Cloudflare ZIP info / open deploy folder
22. Print post-upload live verification checklist
23. Print full deploy workflow guide
24. Print project status snapshot
25. Check project documentation status
26. Print new listing start checklist
27. Run pre-Phase-2 draft quality check
28. Print website commit commands for latest listing
29. Edit draft section fields
30. Audit existing listings for missing section data
31. Evaluate parser samples
32. Re-scan source.txt and suggest missing draft fields
33. Dry-run update existing website listing from draft
34. Apply existing website listing update after confirmation
35. Batch re-scan existing drafts and create enrichment report
36. Create manual source.txt from pasted text
37. Process manual source.txt into draft
38. Create staged Google Groups intake folder
```

---

## 5. Standard Safety Rules

These are non-negotiable.

```text
- Always check both repos are clean before write operations.
- Never use --latest automatically unless explicitly intended and verified.
- Always process exact listing code/folder name.
- Never bulk export.
- Never auto-deploy.
- Never auto-upload to Cloudflare.
- Never auto-commit or auto-tag from helper/dashboard.
- Never apply Phase 2 if needs_review has blocking items.
- Never apply if website repo is dirty.
- Never apply if slug/image folder already exists unless doing a planned existing-listing update.
- Always validate JSON after website data changes.
- Always validate image paths.
- Always preview locally before website commit.
- Keep terminal/helper as fallback even after Dashboard V2 exists.
- Do not send sensitive raw emails or private owner/customer archives to free public models.
```

Special Cloudflare rule:

```text
Build ZIP locally only.
Cloudflare upload is manual only.
Dashboard/helper must not upload for the user.
```

Special docs rule:

```text
Documentation milestones should be committed separately from code/data milestones.
```

---

## 6. Recent Listing Milestone Chain: Rumah Klender

This is the most recent complete listing flow.

### 6.1 5AJ — Select Next Candidate

Result:

```text
Candidate selected: rumah-klender-001
```

### 6.2 5AK — Apply + Website Commit

Final cleaned draft values:

```text
title: Rumah Second Strategis di Duren Sawit Klender Jakarta Timur
price_text: Rp 4,9 Miliar
location_raw: Duren Sawit Klender, Jakarta Timur
property_type: rumah
transaction_type: dijual
land_area_m2: 300
building_area_m2: 190
bedrooms: 3
bathrooms: 3
floors: 2
carport: 1
garage: 1
certificate_type: SHM + IMB
electricity: 2200 Watt
water_source: Jetpump & PAM
agent: Olga Vera Kaeng / 628111741976 / Marketing
dimensionText: Dimensi 15 x 20 m
orientation: Arah Timur
accessRoad: Akses 2 mobil
image count: 24
```

Review flags cleared after human review:

```text
image_filename_mismatch
agent_phone_conflict
```

Phase 2 apply:

```text
new id: 31
slug: rumah-klender-001
backup: listings.backup-20260628-232941.json
```

Website commit:

```text
2923644 feat: add rumah-klender-001 listing
```

### 6.3 5AL — Build Deploy Package

Helper option 19 built deploy package.

Key result:

```text
Images processed: 557
Images replaced with smaller files: 557
Image MB before compression: 81.25
Image MB after compression: 20.99
ZIP size: 21.57 MB
Build printed: SAFE TO UPLOAD
Warning: ZIP above 20 MB warning threshold
```

Docs commit:

```text
da75fb0 docs: record rumah klender deploy package
```

### 6.4 5AM — Cloudflare Manual Upload + Live Verification

Result:

```text
Cloudflare accepted 21.57 MB ZIP.
Live site verified after upload and hard refresh.
```

Live checks passed:

```text
Homepage card visible
Listings card visible
Detail page id=31 visible
Main image/gallery load
Description visible
Specs visible
Legalitas visible
Facilities/selling points visible
Nearby facilities visible
Agent card visible
WhatsApp CTA visible
Footer visible
Live data JSON contains id 31
```

Docs commit:

```text
ac2c85a docs: record rumah klender live verification
```

### 6.5 5AN — Post-Live Monitoring

Result:

```text
Post-live monitoring passed.
No stale data observed.
No broken images observed.
No live page failure observed.
Both repos clean.
```

Helper option 24 still recommended rebuild/compress because ZIP was above 20 MB threshold, but that warning is now stale/over-cautious because Cloudflare accepted the package and live verification passed.

Docs commit:

```text
be0f9c6 docs: record post-live monitoring after rumah klender
```

### 6.6 5AO — No Remaining Export Candidate

Helper option 18 listed all export folders as FOUND.

Result:

```text
No unprocessed export folders found.
Current Edge export intake batch complete.
```

Docs commit:

```text
44be5a8 docs: record no remaining export candidates
```

### 6.7 5AP — Existing Listings Audit / Polish Planning

Helper options used:

```text
1
24
30
```

Audit output:

```text
High priority review: 1
Medium priority review: 17
Looks okay: 3
Missing source/draft files: 3
Top recommended listing to review next: kost-kelapadua-001
```

Report path:

```powershell
reports\listing-section-audit-20260629-095155.md
```

Git status after report:

```text
clean
```

The report appears ignored/untracked.

Docs commit:

```text
bbb6c89 docs: record existing listings audit
```

---

## 7. Current Next Milestone: 5AQ

### 7.1 Name

```text
5AQ — Review kost-kelapadua-001 Polish Scope
```

### 7.2 Purpose

This is **not** a website edit milestone yet.

It is an inspection/planning milestone to decide the exact polish scope for the only high-priority audit item.

### 7.3 Why Kost Kelapa Dua

Audit found:

```text
id 25 | kost-kelapadua-001
High priority review
missing optional fields: bonusItems
suspicious mixing:
- Fully furnished duplicate/mixing
- Token listrik tiap kamar duplicate/mixing
- Dispenser air otomatis tiap lantai dengan filter RO appears spec-like
- Kamar mandi dengan shower dan water heater appears bonus/promo-like
```

Important existing context for `kost-kelapadua-001`:

```text
property_type should be kost, not rumah.
This listing is investment-sensitive.
It contains occupancy, net income, ROI, room price, and extra income potential.
bedrooms should not appear like normal house "Kamar Tidur 35".
Better label: Kamar Kost: 34 + 1.
bathrooms may need label: Kamar Mandi: 12 + 1.
Income/ROI claims should trigger careful human review.
The long facility list is valuable and should not be over-compressed.
```

### 7.4 First 5AQ Commands

Start with inspection only:

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_automation-v0.3.0"

python scripts\jkpro_helper.py
```

Choose:

```text
1
4
```

For option 4, enter:

```text
kost-kelapadua-001
```

Then inspect current website data for id 25:

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_website"

node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/listings.json','utf8')); const x=data.find(i=>i.id===25 || i.slug==='kost-kelapadua-001'); console.log(JSON.stringify({id:x.id,slug:x.slug,title:x.title,priceLabel:x.priceLabel,type:x.type,status:x.status,features:x.features,bonusItems:x.bonusItems,specHighlights:x.specHighlights,nearbyFacilities:x.nearbyFacilities,sellingPoints:x.sellingPoints,availableUnits:x.availableUnits,description:x.description},null,2));"
```

Send:

```text
- option 4 output
- Node output
```

### 7.5 5AQ Safety Rules

```text
No edits yet.
No bulk changes.
No deploy.
No upload.
No tag.
No Phase 1.
No Phase 2 apply.
No website data modification until exact changes are reviewed.
```

---

## 8. Existing Listings Audit Summary

### 8.1 High Priority

```text
id 25 | kost-kelapadua-001
```

Reason:

```text
Only high-priority audit result.
Likely needs section classification polish.
Potential income/ROI/investment claims require careful human review.
```

### 8.2 Medium Priority

17 listings were medium priority. Most warnings are low-priority duplicate/mixing warnings, not live blockers.

Common medium issues:

```text
- missing optional dimensionText
- missing optional accessRoad
- features duplicate structured legal/spec fields
- nearby facilities placed in sellingPoints
- spec-like items placed in features
```

Important:

```text
Do not bulk-fix all 17 medium items.
```

### 8.3 Looks Okay

```text
id 23 | rumah-pasarrebo-001
id 26 | gudang-cileungsi-001
id 28 | tanah-pondokgede-001
```

### 8.4 Missing Source/Draft Files

```text
id 8 | rumah-second-tanah-luas-limo-cinere-depok
id 9 | rumah-second-tanah-luas-bojong-kulur-gunung-putri-bogor
id 10 | apartemen-montblanc-fully-furnished-btc-bekasi
```

Important:

```text
Do not edit ids 8, 9, or 10 yet unless doing a special/manual source-less workflow.
```

---

## 9. Dashboard V1 and Dashboard V2 Status

### 9.1 V1 Dashboard

V1 dashboard evolved into top-level workflow tabs:

```text
Home
New Listing
Existing Listings
Deploy
Tools
```

It includes:

```text
Import from Extension
Manual Source Intake
Draft Intake Queue
Draft Form Editor
Existing listings audit/table/detail
Deploy ZIP guidance
Post-upload checklist
Tools/diagnostics/parser samples
```

V1 is useful but can feel bloated and developer-like.

### 9.2 Why Dashboard V2 Was Started

The V2 decision:

```text
V1 is useful, but it became a developer dashboard rather than an operator dashboard.
V2 should feel like a guided listing production app.
```

Core V2 mental model:

```text
Source → Draft → Review → Images → Preview → Export → Build Upload Package
```

V2 principles:

```text
- local-only
- privacy-safe
- no public CMS/login/backend
- no auto Cloudflare deploy
- no marketplace auto-posting
- no auto commit/tag
- terminal helper stays as backend/fallback
- progressive disclosure
- one clear next safe action
- hide diagnostics/tools from normal workflow
- desktop-first but responsive
- accessible 44px controls
- Indonesian labels
- fast vanilla HTML/CSS/JS
- no React/Tailwind/framework for now
```

### 9.3 V2 Docs and Shell History

Known V2 planning/implementation milestones from sources:

```text
d860692 docs: plan dashboard v2 guided workflow
be6e582 feat: add dashboard v2 guided shell
```

V2 had separate files:

```text
dashboard-v2/index.html
dashboard-v2/app.js
dashboard-v2/style.css
```

Important route issue was fixed:

```text
scripts/jkpro_dashboard.py served V1 only at first.
dashboard-v2 static serving was later added safely.
```

API issue was fixed:

```text
dashboard-v2/app.js originally used hardcoded localhost:9877 and broken /data/... calls.
It was changed to same-origin relative API paths and /api/status usage.
```

Safety/UX copy fixes:

```text
Paket Unggah no longer implies auto-deploy.
Pengaturan no longer exposes editable API endpoint / localhost:9877.
```

Later Dashboard V2 read-only phase reached a good stopping point after multiple polish/doc commits. The next recommendation from the Dashboard V2 development source was:

```text
Milestone 4A — Controlled real listing workflow test
```

Meaning:

```text
Do not add new UI features first.
Run one real listing through V2 and record what actually happens.
```

However, the current listing intake batch is now complete, so the more immediate active milestone in the latest conversation is:

```text
5AQ — Review kost-kelapadua-001 Polish Scope
```

### 9.4 Dashboard V2 Desired Future Form Section

The “form type section” idea:

```text
After a listing is auto-extracted or manually created,
the data should go into a form-style editable section
where each field can be reviewed and edited.
```

Correct future location:

```text
After Periksa Draf and before Gambar / Pratinjau / Ekspor.
```

Possible V2 workflow naming:

```text
1. Impor
2. Periksa Draf
3. Edit Data
4. Gambar
5. Pratinjau
6. Ekspor
7. Paket Unggah
```

This form should support both:

```text
- extension-imported listings
- manual source intake listings
```

Safety:

```text
It should edit only draft-listing.json.
It must create backups before saving.
It must require exact SAVE DRAFT confirmation.
It must not edit website data directly.
```

---

## 10. Data Model / Section Philosophy

Recent important decision:

```text
Keep sections based on the original JKPRO listing sections.
```

Reason:

```text
Auto-extract/sorting is still imperfect.
Over-normalizing too early causes duplicated data across sections.
JKPRO listing source format is already somewhat unique and useful.
```

Recommended approach:

```text
- Spec section content stays in spec/specHighlights/structured spec fields.
- Legalitas stays in legalItems/certificate/legal section.
- Bonus Unit stays in bonusItems.
- Available Type Unit stays in availableUnits.
- Booking Fee stays in bookingFeeText.
- Indent stays in indentText.
- Selling Point / Keunggulan stays in sellingPoints.
- Nearby facilities stay in nearbyFacilities.
- Property facilities/features stay in features.
```

Avoid:

```text
- copying specs into features just to fill a feature list
- copying legalitas into features
- copying bonus items into features
- duplicating carport/garage/floors in multiple sections unless intentional for display
```

This is directly relevant to `kost-kelapadua-001`, because its audit issue is mostly section classification/mixing.

---

## 11. Website Public Detail Layout Philosophy

Current desired website detail sections:

```text
1. Deskripsi
2. Spesifikasi
3. Legalitas
4. Fasilitas Properti / Fasilitas Gedung / Fasilitas Kost when applicable
5. Keunggulan & Fasilitas Sekitar
```

For apartments/commercial/kost, labels should be type-aware.

Examples:

```text
Apartment: Fasilitas Unit / Gedung
Commercial: Fasilitas Bangunan
Kost: Fasilitas Kost / Data Investasi / Keunggulan
Land: avoid house-style fields like KT/KM if not applicable
```

Important future polish:

```text
Kost listings need special treatment for room count, income/ROI, occupancy, and investment claims.
```

---

## 12. Current Known Website Deploy Caveats

### 12.1 ZIP Warning Threshold

Latest ZIP:

```text
21.57 MB
```

Helper warning:

```text
ZIP <= 20 MB warning threshold: no
```

But Cloudflare accepted it during Klender upload.

Interpretation:

```text
The warning is not a blocker after successful upload.
Still watch package growth in future deploys.
```

### 12.2 Cloudflare Upload Root Pitfall

Past deployment pitfall:

```text
Uploading a wrapper folder caused CSS/JS MIME errors.
```

Correct approach:

```text
Upload flat contents of deploy\properti_website_public_small.
```

Check after upload:

```text
- CSS loads as CSS
- JS loads as JS
- no text/html MIME errors for css/js
- homepage loads
- listing detail loads
- data/listings.json contains latest id
```

### 12.3 Extensionless vs .html Routes

Both patterns have appeared:

```text
https://jkpro.pages.dev/property?id=31
https://jkpro.pages.dev/property.html?id=31
```

Current routing has worked. If checking detail pages, prefer testing both when doing deploy/live verification.

---

## 13. Important Commands

### 13.1 Check Automation Repo

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_automation-v0.3.0"
git status --short
git log --oneline -10
```

### 13.2 Check Website Repo

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_website"
git status --short
git log --oneline -10
```

### 13.3 Start Helper

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_automation-v0.3.0"
python scripts\jkpro_helper.py
```

### 13.4 Start Dashboard

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_automation-v0.3.0"
python scripts\jkpro_dashboard.py
```

Open:

```text
http://127.0.0.1:8787/
http://127.0.0.1:8787/dashboard-v2/
```

### 13.5 Validate Website JSON

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_website"
python -m json.tool data\listings.json | Out-Null
```

### 13.6 Preview Website Locally

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_website"
python -m http.server 8000
```

Open:

```text
http://localhost:8000/
http://localhost:8000/listings.html
http://localhost:8000/property.html?id=<id>
```

### 13.7 General Validation Commands

Run from automation repo unless noted:

```powershell
node --check dashboard-v2\app.js
node --check dashboard\app.js
python -m py_compile scripts\jkpro_dashboard.py
python -m py_compile scripts\jkpro_helper.py
python -m py_compile phase2_properti_auto_upload\scripts\export_to_website.py
python -m unittest discover -s tests -v
python scripts\evaluate_parser_samples.py --no-write-report
python scripts\audit_listing_sections.py --no-write-report
git diff --check
git status --short
```

CRLF warnings are common and non-blocking unless actual whitespace errors appear.

---

## 14. Normal Listing Workflow

Only use this after a candidate exists.

```text
1. Option 1 — check both repos clean.
2. Option 18 — confirm candidate is NOT FOUND in website data.
3. Option 3 — process exact export folder through Phase 1.
4. Option 4 — inspect draft.
5. Option 10/11/12/29/32 — edit/re-scan draft as needed.
6. Option 27 — pre-Phase-2 quality check.
7. Option 5 — Phase 2 dry-run.
8. Option 6 — apply only after exact confirmation and clean dry-run.
9. Option 7 — validate latest image paths.
10. Option 14/15 — inspect website JSON/detail sections.
11. Validate website JSON directly.
12. Preview website locally.
13. Commit website listing.
14. Build deploy package only when ready for deployment batch.
15. Final local safety check.
16. Manual Cloudflare upload.
17. Live verification.
18. Post-live monitoring.
19. Document/commit each milestone.
```

Current warning:

```text
There is currently no NOT FOUND export candidate left.
So do not start this workflow unless new exports are created.
```

---

## 15. Documentation / Commit Pattern

### 15.1 Documentation Milestone Pattern

Use docs agent/prompt to update:

```text
AGENTS.md
docs/current-system-status.md
docs/dashboard-cms-checkpoint.md
docs/dashboard-demo-checklist.md
docs/dashboard-v2-draft-save-operating-policy-4n.md
docs/dashboard-v2-implementation-roadmap.md
```

Then commit:

```powershell
git add AGENTS.md docs/current-system-status.md docs/dashboard-cms-checkpoint.md docs/dashboard-demo-checklist.md docs/dashboard-v2-draft-save-operating-policy-4n.md docs/dashboard-v2-implementation-roadmap.md
git commit -m "<docs commit message>"
git status --short
git log --oneline -10
```

Current recent docs commit style examples:

```text
docs: record rumah klender live verification
docs: record post-live monitoring after rumah klender
docs: record no remaining export candidates
docs: record existing listings audit
```

### 15.2 Website Commit Pattern

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_website"

git status --short
git add data/listings.json images/properties/<slug>/
git commit -m "feat: add <slug or listing name> listing"
git status --short
git log --oneline -10
```

Current policy:

```text
No tag unless specifically requested by milestone.
```

---

## 16. Known Important Listing History

The website has grown beyond the original old handoff count of 7 automated exports. Current website count is 24.

Known recent listing sequence includes:

```text
id 23 | rumah-pasarrebo-001
id 24 | gedung-setiabudi-001
id 25 | kost-kelapadua-001
id 26 | gudang-cileungsi-001
id 27 | ruko-kalimalang-001
id 28 | tanah-pondokgede-001
id 29 | apartemen-kalimalang-001
id 30 | rumah-padurenan-001
id 31 | rumah-klender-001
```

Current latest listing:

```text
id 31 | rumah-klender-001
```

Important old source-less listings:

```text
id 8
id 9
id 10
```

These should be handled carefully because their source/draft files are missing.

---

## 17. Key Technical Lessons

### 17.1 Location Parsing

Known location parsing improvements included:

```text
Kabupaten Bekasi support
Bogor/Kabupaten Bogor handling
Jakarta Timur/Cipinang/Jatinegara handling
Cikini Menteng/Jakarta Pusat handling
structured location fields respected by Phase 2
```

### 17.2 m² Encoding / Mojibake

Past issue:

```text
mÂ² / mA² / mAÂ
```

Helper option 13 exists to fix latest website m² encoding.

Always check:

```text
areaUnit
description
seoDescription
dimensionText
specHighlights
```

### 17.3 Agent Contact

Common confirmed agent:

```text
Olga Vera Kaeng
628111741976
Marketing
```

But rule:

```text
Do not blindly guess agent phone.
If agent_phone_conflict appears, confirm manually.
```

### 17.4 Section Mixing

Audit warnings often include low-priority duplicates:

```text
SHM + IMB duplicated in features
Carport duplicated in features/spec
Floors duplicated in features/spec
Furnished status duplicated in features/spec
```

These are polish issues, not necessarily blockers.

But for `kost-kelapadua-001`, review is higher priority because investment claims and room/facility structure need careful display.

---

## 18. Tooling / AI Usage Notes

Preferred tool for risky code changes:

```text
Codex in VS Code
```

Backup/low-risk tools discussed:

```text
OpenCode + DeepSeek V4 Flash Free
Gemini Flash / Gemini Flash Lite
Claude Code when available
```

Guideline:

```text
Use stronger/more reliable agents for code that can affect website data, export logic, or dashboard writes.
Use free models only for controlled docs/tests/low-risk edits.
Do not send sensitive private email archives/raw customer data to free external models.
```

Prompting pattern:

```text
Use @existing-file-or-folder references for existing files/folders.
Do not use @ for files that should be newly created.
Always state allowed files and forbidden files.
Always state validation commands.
Always say do not commit/tag unless that is the requested milestone.
```

---

## 19. /PITFALLS

### 19.1 Current Biggest Pitfalls

```text
1. Accidentally starting Phase 1 when no NOT FOUND exports remain.
2. Bulk-fixing 17 medium-priority audit items.
3. Editing source-less ids 8/9/10 without a manual workflow.
4. Treating duplicate/mixing warnings as urgent bugs.
5. Rebuilding/uploading deploy ZIP unnecessarily.
6. Creating tags too early.
7. Trusting helper ZIP warning as a blocker after Cloudflare already accepted the 21.57 MB package.
8. Letting Dashboard V2 become another developer cockpit instead of a guided operator workflow.
9. Exposing auto-deploy/auto-upload wording in UI.
10. Mixing original JKPRO sections into duplicated website fields too aggressively.
```

### 19.2 Specific 5AQ Pitfalls

```text
- Do not edit kost-kelapadua-001 immediately.
- First compare draft vs website JSON.
- Treat income/ROI/occupancy claims as sensitive.
- Do not compress the long kost facility/investment value list too much.
- Do not display 35 bedrooms like a normal house without reviewing labels.
- Preserve original JKPRO sections where possible.
```

### 19.3 Deployment Pitfalls

```text
- Do not upload wrapper folder.
- Do not assume /property?id and /property.html?id are both okay without checking.
- Do not deploy after a polish edit until local preview and final safety check pass.
- Do not forget live JSON check after upload.
```

### 19.4 Dashboard V2 Pitfalls

```text
- Do not replace V1 until V2 is proven.
- Do not add write actions casually.
- Do not turn helper options into 1:1 UI buttons.
- Do not make Tools/Diagnostics dominate the main operator workflow.
- Do not add public login/CMS/backend yet.
```

---

## 20. /KILLCRITIC Verdict

The current system is in a strong but delicate phase.

What is strong:

```text
- The public website is live and has 24 listings.
- The full Klender listing workflow completed through upload and monitoring.
- The current Edge export batch is complete.
- The audit found only one high-priority polish item.
- The helper menu is broad and useful.
- Dashboard V2 has a good guiding direction.
- Safety documentation and milestone documentation are much better now.
```

What is still delicate:

```text
- Section classification still needs polish.
- Kost/investment listing display needs special handling.
- Dashboard V2 should be validated against real daily workflows, not just UI structure.
- Deploy package size is slowly growing.
- Source-less old listings need special manual handling.
```

Best next move:

```text
Continue 5AQ: inspect kost-kelapadua-001 only.
Plan exact edits.
Do not bulk-fix.
Do not deploy.
```

Best short-term roadmap:

```text
5AQ — Review kost-kelapadua-001 Polish Scope
5AR — If needed, safely update kost-kelapadua-001 draft/website fields
5AS — Local validation + website commit if changes are made
5AT — Build deploy package only if a public update is needed
5AU — Manual Cloudflare upload + live verification only if package is built
Dashboard V2 4A — Controlled real workflow test after current listing polish direction is clear
```

---

## 21. Suggested Opening Message for Next Chat

Use this in a new conversation:

```text
Please read the attached JKPRO_PROPERTY_AUTOMATION_FULL_HANDOFF_2026-06-29.md first.

Current state:
- Automation repo clean after bbb6c89 docs: record existing listings audit.
- Website repo clean after 2923644 feat: add rumah-klender-001 listing.
- Public site https://jkpro.pages.dev has 24 listings.
- Latest listing is id 31 / rumah-klender-001, live verified and post-live monitored.
- Current Edge export batch is complete; helper option 18 found no NOT FOUND exports.
- Existing listing audit found 1 high-priority item: id 25 / kost-kelapadua-001.
- Current milestone is 5AQ — Review kost-kelapadua-001 Polish Scope.
- Do not start Phase 1, deploy, upload, tag, or bulk-fix.
- First step should be inspection only: helper option 1, helper option 4 for kost-kelapadua-001, and a website JSON read-only check for id 25.
Please guide me one step at a time with /PITFALLS /KILLCRITIC.
```

---

## 22. Exact Next Step After This Handoff

Run the 5AQ inspection:

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_automation-v0.3.0"

python scripts\jkpro_helper.py
```

Choose:

```text
1
4
```

For option 4:

```text
kost-kelapadua-001
```

Then run website JSON read-only check:

```powershell
cd "D:\Documents (D)\Softwares\test website\properti-projects\properti_website"

node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/listings.json','utf8')); const x=data.find(i=>i.id===25 || i.slug==='kost-kelapadua-001'); console.log(JSON.stringify({id:x.id,slug:x.slug,title:x.title,priceLabel:x.priceLabel,type:x.type,status:x.status,features:x.features,bonusItems:x.bonusItems,specHighlights:x.specHighlights,nearbyFacilities:x.nearbyFacilities,sellingPoints:x.sellingPoints,availableUnits:x.availableUnits,description:x.description},null,2));"
```

Send both outputs before making any change.

---

## 23. Source Basis for This Handoff

This handoff is based on:

```text
- current conversation terminal outputs through 5AP
- prior JKPRO_AUTOMATION_HANDOFF.md
- chat-session1.md and chat-session2.md
- codex-session2-200626-1641.md
- Dashboard-V2-Development (1).md
- recent pasted helper outputs and live verification screenshots
```

It updates older handoffs that stopped around v0.6.0 / auto-export-007 by including the later Dashboard V2 work, listing pipeline progress, Klender live deploy, no remaining export candidates, and current 5AQ focus.

