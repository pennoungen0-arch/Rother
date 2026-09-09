> From: https://chatgpt.com/g/g-p-6a5e3733d5108191b31ec4c0388d1cba-potential-client-job-2/c/6a9259b6-b458-83ec-9220-56eff144cee9

# you asked

message time: 2026-08-29 11:02:26

/PITFALLS /KILLCRITIC can you tell me again about gmb everywhere?

---

# chatgpt response

Yes. In the context of our **Rother / GBP Competitor Review Monitor**, we were using **GMB Everywhere** as the reference point for what a mature Google Business Profile research/analysis tool can do.

At a high level, **GMB Everywhere is a browser-based Google Maps/Google Business Profile analysis tool**. It adds functionality around Google Maps and Business Profiles that Google itself does not provide as a convenient research interface.

### What GMB Everywhere is useful for

Think of it roughly as:

**Google Maps / GBP page → browser extension → extract + analyze business information**

It can be used for things such as:

- Business/profile information
- Google Maps search results analysis
- Reviews and review-related information
- Competitor research
- Local SEO analysis
- Business/category comparisons
- Search-result analysis
- Exporting/researching collected business data
- Other GBP-oriented SEO/research functions

The important distinction is that **GMB Everywhere isn't simply a scraper**. The value comes from combining:

1. **Data extraction**
2. **Analysis**
3. **Presentation**
4. **Browser integration**
5. **Convenience for local SEO research**

---

## How this relates to Rother

Our Rother project is narrower right now.

The current technical plan explicitly defines the first phase as:

> Automated scraping of competitor Google Business Profile reviews, per branch

with:

**Spider → Playwright → Scrapy/Parsel → JSON snapshots → delta detection → scheduled execution**



So our current system is essentially trying to build the **monitoring/data-collection foundation** rather than immediately recreating every feature of GMB Everywhere.

### The current Rother pipeline

```text
Google Maps
     │
     ▼
Discovery
     │
     ▼
Playwright
     │
     ├── open GBP
     ├── dismiss UI
     ├── open reviews
     ├── scroll reviews
     └── capture HTML
     │
     ▼
Parser
     │
     └── Review records
     │
     ▼
Storage
     │
     ├── snapshots
     └── new reviews
     │
     ▼
Delta Detection
     │
     └── "what changed?"
     │
     ▼
Orchestration
     │
     └── all branches × competitors
     │
     ▼
GitHub Actions
     │
     └── daily monitoring
```

That architecture is explicitly documented in the project plan. 

---

# The key difference

I'd separate them like this:

| | GMB Everywhere | Current Rother |
|---|---|---|
| Google Maps integration | **Yes** | No browser extension yet |
| Business extraction | **Yes** | Limited/current scope |
| Review extraction | **Yes** | **Core objective** |
| Competitor monitoring | Research-oriented | **Automated monitoring** |
| Historical snapshots | Tool-dependent | **Core architecture** |
| New-review detection | Not the primary architectural concept | **Core feature** |
| Scheduled scraping | Not the primary concept | **Core feature** |
| Dashboard | Yes / analysis UI | Future phase |
| Local SEO analysis | **Broad** | Not current scope |
| AI analysis | Potentially available depending on feature/product | **Explicitly forbidden for current phase** |
| Paid scraping APIs | Not relevant to our architecture | **Forbidden** |
| Self-hosted | Not the same architecture | **Yes** |
| GitHub Actions automation | Not the core product model | **Yes** |

The Rother plan deliberately keeps the first version much smaller. 

---

# But there is an important realization

If your ultimate goal is:

> **"Build our own software for clients and companies that can do something comparable to GMB Everywhere."**

then **the current Rother architecture is only the foundation**, not the final product.

I would *not* recommend trying to clone GMB Everywhere feature-for-feature immediately.

Instead, I'd think of the product in layers:

```text
                    ROTHER
                       │
        ┌──────────────┴──────────────┐
        │                             │
   DATA ENGINE                   USER PRODUCT
        │                             │
        ▼                             ▼
 Google Maps/GBP                Dashboard
 extraction                     Search
        │                        Comparison
        ▼                        Reports
 Business data                  Alerts
        │                        Exports
        ▼
 Reviews
        │
        ▼
 Historical snapshots
        │
        ▼
 Change detection
        │
        ▼
 Monitoring
```

The **data engine** is the difficult part.

And this is exactly why we've been so strict about verification.

Your execution rules say that we cannot simply assume a Google Maps selector works. It has to be observed against real output, and an unverified implementation must remain **UNPROVEN**. 

That matters enormously for something like GMB Everywhere because Google Maps is an external system whose DOM can change.

---

## And this is where our previous discussion about Place IDs comes in

A **Place ID alone is not enough** to build something like GMB Everywhere.

A robust system needs some combination of:

```text
Business identity
    ↓
Google Maps URL / Place ID / CID / other identifiers
    ↓
Discovery
    ↓
Business page
    ↓
Rendered page
    ↓
Structured extraction
    ↓
Reviews
    ↓
Historical state
    ↓
Monitoring
```

And potentially:

```text
Search query
   ↓
Google Maps results
   ↓
Businesses discovered
   ↓
Business profiles
   ↓
Competitor set
```

So when we previously asked:

> "What things are needed or must-have to achieve data scraping, tracking and monitoring other than Place IDs?"

the answer is essentially **an entire data acquisition + identity + historical state + verification system**, not merely Place IDs.

---

# One major warning

I would **not** use GMB Everywhere as the technical blueprint.

Use it as the **product capability benchmark**.

That's a very important distinction.

### Bad approach

> "Let's copy how GMB Everywhere probably scrapes Google."

That leads to brittle selectors, undocumented assumptions, and potentially a huge React/Next.js application before the underlying data engine is reliable.

### Better approach

> "What capabilities does GMB Everywhere give a user, and which of those capabilities should Rother provide?"

Then independently design the architecture.

That is much closer to what we're doing now.

---

## Where I would ultimately take Rother

If the client wants a serious commercial product, I'd envision something more like:

### Phase 1
**Reliable GBP data engine**

- Business identification
- GBP capture
- Review extraction
- Historical snapshots
- New-review detection
- Failure isolation
- Verification
- Scheduled runs

### Phase 2
**Monitoring**

- Review changes
- Rating changes
- Review volume
- Competitor changes
- Monitoring history
- Alerts

### Phase 3
**Dashboard**

- Businesses
- Competitors
- Reviews
- Trends
- Comparison
- Monitoring status
- Run health

### Phase 4
**GMB Everywhere-like research tools**

- Maps search extraction
- Business discovery
- Competitor discovery
- Bulk extraction
- Export
- Local SEO metrics
- Research workflows

### Phase 5
**Advanced intelligence**

Only if the client wants it:

- Sentiment
- Categorization
- Summaries
- Review themes
- Recommendations

Our current project plan specifically says **AI/LLM is deferred**, so we should not sneak Phase 5 into the current implementation. 

---

### The short version

**GMB Everywhere = the capability/product benchmark.**

**Rother = our own underlying data/monitoring system.**

Right now Rother is intentionally much narrower:

> **"Automatically monitor competitor Google Business Profile reviews and detect new reviews reliably at zero recurring cost."**

That is actually a **very good first product slice**, because if we can make the data engine reliable, we can build increasingly GMB-Everywhere-like capabilities on top of it later.

And importantly, our current `CHANGELOG.md` has **no proven implementation entries yet**, so we should not confuse the architecture/plan with a working equivalent of GMB Everywhere.

---

# you asked

message time: 2026-08-29 11:10:41

/PITFALLS /KILLCRITIC can you tell what are the features of gmb everywhere as of august 2026?

---

# chatgpt response

Yes. I checked the **current GMB Everywhere listing and its current roadmap**, specifically for **August 2026**, rather than relying on our older discussion.

The current Chrome Web Store listing is **version 5.8.0, updated August 21, 2026**, so this is a good snapshot of what it officially advertises right now. ([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

## GMB Everywhere, as of August 2026

The easiest way to understand it is that GMB Everywhere is **not just a Google Maps scraper**. It is a **Google Business Profile / Local SEO research and auditing tool that operates inside Google Search, Google Maps, and Local Finder**. ([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

Its currently advertised feature set is:

### 1. GMB Categories

Shows a business's Google Business Profile categories directly on:

- Google Business pages
- Google Search results
- Google Business pages with the bottom selector
- Local Finder
- Local Finder search results

It also **highlights the primary category** separately with a star. ([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

This is particularly useful for competitor research.

Example:

```text
Competitor
├── Primary category ⭐
├── Secondary category
├── Secondary category
└── Secondary category
```

---

# 2. Basic GMB Audit

This is one of its core features.

It extracts/links various GBP information, including:

- Business claimed status
- Location information
- Place ID
- CID
- Business Profile ID
- Knowledge Panel link
- Google review request link
- Google review display link
- Post link
- Other businesses at the same address
- Other businesses using the same website
- Various website-audit shortcuts

The current official listing explicitly describes these capabilities. ([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

So **Place ID is only one piece of the information GMB Everywhere works with**.

---

# 3. Teleport / Rank Checking

This is a particularly important feature for what we're building.

GMB Everywhere recognizes that Google Maps rankings depend heavily on **where the search is being performed**.

Teleport allows the user to:

- enter a search term
- select a location
- perform a search from that location
- see the business's ranking
- see competitors at that location
- calculate/draw distance from the selected location

([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

Conceptually:

```text
Keyword:
"hotel bali"

Location:
Seminyak

             ↓

Google local search simulation

             ↓

1. Competitor A
2. Competitor B
3. Your Business
4. Competitor C
...
```

This is much closer to a **local rank intelligence tool** than simple scraping.

---

# 4. Review Audit

This is probably the feature most directly related to our current Rother project.

GMB Everywhere's Review Audit provides analysis around:

- Review quantity
- Review rating
- Review history over time
- Graphical representation of reviews
- Review-content analysis
- Review-quality analysis
- Strategic insights based on the reviews

([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

So conceptually:

```text
Reviews
   │
   ├── Total reviews
   ├── Average rating
   ├── Rating distribution
   ├── Reviews over time
   ├── Review content
   └── Quality analysis
```

This is important because our current Rother project is essentially building the **raw review collection + historical/delta foundation** that could eventually support something like this.

Our current plan explicitly limits Phase 1 to automated competitor review scraping, delta detection, scheduled execution, and structured data. 

---

# 5. Post Audit

GMB Everywhere also analyzes Google Business Profile posts.

It provides things such as:

- Post strategy visualization
- Posting frequency analysis
- Post-content analysis
- Strategic information about posting

([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

So the system isn't limited to:

```text
Reviews
```

It also examines:

```text
GBP
 ├── Categories
 ├── Reviews
 └── Posts
```

---

# 6. Category Finder

This is a separate research tool.

You can provide a category and use it to investigate:

- Related categories
- Search traffic associated with categories
- Services associated with categories
- Seasonal search changes through an external-tool shortcut

([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

Conceptually:

```text
"Hotel"

     ↓

Related categories
     ↓
Search opportunity
     ↓
Associated services
```

This is more **SEO research** than scraping.

---

# 7. Local Scan

This is the **newer and very important feature**.

GMB Everywhere calls Local Scan its most powerful feature for competitor analysis.

It allows the user to compare **multiple businesses in Google Maps search results side-by-side**. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

It currently analyzes:

### Categories

Compare your categories against competitors.

### Services

Identify services competitors are using that you may not have.

### Reviews

Compare:

- Review quantity
- Rating

### Location / proximity

Understand how geographic proximity affects the businesses' rankings.

([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

So:

```text
                 LOCAL SCAN

       Your Business    Competitor A    Competitor B
       ─────────────    ────────────    ────────────
Category     ✓               ✓               ✓
Services     12              18              15
Reviews      243             581             392
Rating       4.6             4.8             4.7
Location     0.8 km          0.3 km          1.1 km
```

That is a substantially more advanced concept than simply downloading reviews.

---

# 8. Competitor Intelligence

This is really the **umbrella capability** tying everything together.

GMB Everywhere is designed to let someone inspect competitors directly while browsing Google.

The extension places categories/audit functionality onto Google pages rather than requiring the user to manually copy information into another application. ([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

So their workflow is roughly:

```text
Google Search / Maps
        │
        ▼
See business
        │
        ├── Categories
        ├── Basic Audit
        ├── Review Audit
        ├── Post Audit
        ├── Teleport
        ├── Category Finder
        └── Local Scan
```

---

# 9. It works across several Google surfaces

The current extension specifically says it works with:

- Google Business pages
- Google Search results
- Google Maps
- Local Finder
- Local Finder search results

([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

This is a very important architectural observation.

**GMB Everywhere isn't simply opening one GBP URL and scraping it.**

It has to understand multiple Google interfaces and contexts.

---

# 10. It does NOT officially provide Google Maps data export

This is a very important correction to something people can easily misunderstand.

The current Chrome Web Store listing explicitly says:

> they do **not** allow users to export data from Google Maps.

So **"GMB Everywhere" should not be interpreted as a Google Maps bulk-export scraper**. ([Chrome Web Store](https://chromewebstore.google.com/detail/gmb-everywhere-gbp-audit/oibcaeeplepnjfjhokfcabnaafodppik?utm_source=chatgpt.com))

That's a significant distinction for our product planning.

---

# 11. Current roadmap also reveals newer functionality

I also checked the **August 2026 roadmap**.

The roadmap currently shows shipped functionality including:

- Category Dilution or Not
- Rank Check update
- Prospecting / Client Finder features
- Photo generator
- Local Scan improvements
- Total number of photos in Basic Audit
- Rank Check rename

And currently in development:

- Photo generator
- AI Visibility Tool

([GMB Everywhere](https://roadmap.gmbeverywhere.com/roadmap?utm_source=chatgpt.com))

There are also feature ideas around:

- White-label functionality
- Prospecting / client finder
- Sharing categories/services with clients
- Additional photo-generator capabilities

([GMB Everywhere](https://roadmap.gmbeverywhere.com/b/dvd1ry6v/feature-ideas?utm_source=chatgpt.com))

**Important:** those roadmap items should not automatically be treated as existing production features. The distinction between **Shipped**, **In Development**, **Planned**, and **Under consideration** matters.

---

# So the feature map is roughly this

```text
                    GMB EVERYWHERE
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
    DISCOVERY            AUDIT              RANKING
       │                   │                   │
       ▼                   ▼                   ▼
 Categories          Basic Audit           Teleport
 Category Finder     Review Audit          Rank Check
 Local Scan          Post Audit
       │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
                  COMPETITOR ANALYSIS
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          Categories     Services     Reviews
              │            │            │
              └────────────┼────────────┘
                           ▼
                     LOCAL SEO
                     intelligence
```

## And this changes how I would think about Rother

This is where the **KILLCRITIC** part is important.

Our previous thinking could easily become:

> "We need to build a GMB Everywhere clone."

I don't think that's the correct immediate objective.

GMB Everywhere currently has **several distinct products/features inside one browser extension**.

Our Rother project currently targets only one slice:

```text
              GMB EVERYWHERE
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    Categories     Reviews       Posts
       │             │             │
       │       ┌─────┴─────┐       │
       │       │           │       │
       │    collection   analysis  │
       │       │           │       │
       │       └─────┬─────┘       │
       │             │             │
       └─────────────┼─────────────┘
                     │
                   ROTHER
                 Phase 1
```

And **our current Rother architecture is actually underneath that Review Audit concept**:

```text
Google Maps
     ↓
Capture
     ↓
Parse reviews
     ↓
Store snapshot
     ↓
Compare snapshot
     ↓
Detect new reviews
     ↓
Historical dataset
     ↓
[future]
Review analytics
     ↓
[future]
Competitor dashboard
```

That is why I would **not throw away the current architecture simply because GMB Everywhere has many more features**.

The architecture is a reasonable foundation.

The real question we should answer next is:

> **Which GMB Everywhere capabilities should Rother actually reproduce, which should it improve, and which should we deliberately NOT build?**

That is the point where we can do a proper **feature-by-feature GMB Everywhere vs Rother capability matrix**, including **scraping difficulty, required data, Google anti-bot risk, zero-cost feasibility, technical architecture, and client value**. That would be much more useful than blindly cloning it.

And one particularly important finding from this August 2026 check: **Local Scan + Teleport + Basic Audit + Review Audit + Post Audit + Category Finder are separate capabilities.** We should architect Rother so that adding those later doesn't force us to rebuild the data engine.

---

# you asked

message time: 2026-08-29 11:12:17

/PITFALLS /KILLCRITIC now tell me how each of the features works in detail.

---

# chatgpt response

Absolutely. Since you asked for **how each feature actually works**, rather than just a feature list, I checked GMB Everywhere's current material and I'll separate **what GMB Everywhere explicitly documents** from **my technical inference about how the feature must work internally**.

That distinction matters for our Rother project. We should not mistake a UI description for knowledge of their private implementation.

As of the current August 2026 information, GMB Everywhere exposes its functionality primarily through buttons inserted into **Google Maps, Google Search's 3-pack, and Local Finder**. The user opens a business/search result and launches the relevant audit from there. ([GMB Everywhere](https://www.gmbeverywhere.com/guides/quick-gbp-audit-30-minutes-to-better-results?utm_source=chatgpt.com))

---

# 1. Basic Audit

This is essentially:

> **"Give me a comprehensive snapshot of this GBP."**

### User workflow

```text
Google Maps
    ↓
Search for business
    ↓
GMB Everywhere detects listing
    ↓
"Basic Audit"
    ↓
Audit page
    ↓
GBP information + categories + services +
attributes + links + other data
```

GMB Everywhere says Basic Audit exposes **40+ additional data points/tools**, including Place ID, Knowledge ID, CID, services, attributes, categories and various GBP links. ([GMB Everywhere](https://www.gmbeverywhere.com/guides/last-minute-booking-miami?utm_source=chatgpt.com))

### What it gathers

Among the advertised information:

- Place ID
- Knowledge ID
- CID
- Categories
- Services
- Attributes
- GBP links
- Review-request link
- Service/product links
- Business coordinates
- Other GBP information
- Photo count
- Information useful for external map comparison

It also has specific tools for finding things such as businesses at the same address and the business's coordinates. ([GMB Everywhere](https://www.gmbeverywhere.com/features/find-businesses-at-same-address?utm_source=chatgpt.com))

### What is actually happening conceptually?

The extension sees a Google business listing:

```text
Business listing
       │
       ├── Name
       ├── Address
       ├── Rating
       ├── Reviews
       └── Google identifiers
              │
              ▼
        GMB Everywhere
              │
              ▼
       extract/derive data
              │
              ▼
         Audit display
```

Some fields can be obtained directly from the page/context, while others may require following Google links or deriving identifiers.

**Important:** GMB Everywhere does not publicly document its complete extraction algorithm or DOM selectors. So we should not claim, for example, "they use selector X" unless we inspect the extension itself.

### Why this matters for Rother

This is much broader than our current scraper.

Our current project primarily wants:

```text
GBP → Reviews → Historical snapshots
```

Basic Audit is closer to:

```text
GBP
 ├── identity
 ├── categories
 ├── services
 ├── attributes
 ├── coordinates
 ├── links
 ├── photos
 ├── reviews
 └── other metadata
```

---

# 2. Review Audit

This is probably the **closest GMB Everywhere feature to what we're currently building**.

Its purpose is:

> **Turn the reviews of a GBP into an analyzable dataset.**

GMB Everywhere advertises:

- Review/rating trends over time
- Detailed review analysis
- Keyword discovery
- Review filtering
- Rating filtering
- Date filtering
- Review search
- Identification of reviews without text
- Other review analysis features

([GMB Everywhere](https://www.gmbeverywhere.com/features/find-keywords-in-reviews?utm_source=chatgpt.com))

---

## How the user uses it

```text
Google Maps
     ↓
Open business
     ↓
Review Audit
     ↓
Review Analysis
```

The user can then search/filter the reviews.

For example:

```text
Search:
"staff"

Rating:
1–3 stars

Date:
Last 12 months
```

GMB Everywhere says the review search can locate reviews containing specific keywords, phrases or topics. ([GMB Everywhere](https://www.gmbeverywhere.com/features/search-google-reviews?utm_source=chatgpt.com))

It also supports filtering by star rating and date ranges. ([GMB Everywhere](https://www.gmbeverywhere.com/features/search-google-reviews?utm_source=chatgpt.com))

---

## The interesting part: historical trends

GMB Everywhere advertises **review and rating trends over time**.

That means it isn't merely displaying the reviews currently visible on the page.

Conceptually, something like:

```text
             Historical Review Data

2024 ────────●────────●────────●
              100      130      155 reviews

2025 ────────●────────●────────●
              180      230      290 reviews

2026 ────────●────────●
              340      410
```

This requires some form of historical observation/storage.

And **this is exactly where Rother's snapshot architecture becomes valuable**.

Our plan currently does:

```text
Run #1
  ↓
snapshot A

Run #2
  ↓
snapshot B
  ↓
compare A vs B
  ↓
new reviews
```



So our architecture is already pointed toward the data foundation required for this kind of feature.

---

# 3. Review keyword analysis

This deserves separate attention.

GMB Everywhere can search reviews for particular terms and identify common keywords. ([GMB Everywhere](https://www.gmbeverywhere.com/features/find-keywords-in-reviews?utm_source=chatgpt.com))

For example:

```text
Business: Hotel Bali

Reviews
──────────────

"friendly staff"
"great location"
"clean room"
"friendly staff"
"great breakfast"
"dirty bathroom"
```

The analysis could conceptually produce:

```text
Keyword          Frequency

staff               87
location            65
breakfast           52
room                49
clean               43
```

The exact internal keyword algorithm isn't publicly specified in the sources I found, so we should treat that part as **implementation unknown**, not assume NLP/TF-IDF/etc.

---

# 4. Review filtering

The review engine can narrow the dataset.

For example:

```text
ALL REVIEWS
     │
     ├── 5 stars
     ├── 4 stars
     ├── 3 stars
     ├── 2 stars
     └── 1 star
```

and:

```text
ALL REVIEWS
     │
     ├── All time
     ├── Last month
     ├── 1–12 months
     └── Custom period
```

The official feature documentation explicitly describes star-rating and date-range filtering. ([GMB Everywhere](https://www.gmbeverywhere.com/features/search-google-reviews?utm_source=chatgpt.com))

This is extremely useful for competitor research because you can ask:

> "What are customers complaining about in the competitor's 1–2 star reviews during the last year?"

---

# 5. Teleport

This is one of GMB Everywhere's most important features.

Its purpose is:

> **Check what a Google Maps result looks like from another geographic location.**

GMB Everywhere describes Teleport as being able to find:

- GBP rank at any location
- Rank for any search term
- Competitors at that location
- Customizable locations
- Locations worldwide

([GMB Everywhere](https://www.gmbeverywhere.com/guides/last-minute-booking-miami?utm_source=chatgpt.com))

---

## Why Teleport exists

Google Maps results are geographically dependent.

Imagine:

```text
                 NORTH

             Competitor A
                  ▲
                  │
        Competitor B
                  │
WEST ─────── YOUR BUSINESS ─────── EAST
                  │
             Competitor C

                 SOUTH
```

Your business might rank:

```text
Downtown       → #2
Airport        → #8
Beach          → #15
North district → #4
```

So asking:

> "What is my ranking?"

is incomplete.

You really need:

> **"What is my ranking for keyword X from location Y?"**

---

## Teleport workflow

Conceptually:

```text
Keyword
   +
Location
   ↓
Google local search
   ↓
Results
   ↓
Find target business
   ↓
Determine position
```

Example:

```text
Keyword:
"hotel in Seminyak"

Location:
Seminyak Square

        ↓

Google Maps search

        ↓

1. Hotel A
2. Hotel B
3. Hotel C
4. Your Hotel
...
```

GMB Everywhere describes this as finding a GBP's rank for a search term from a selected location. ([GMB Everywhere](https://www.gmbeverywhere.com/guides/last-minute-booking-miami?utm_source=chatgpt.com))

---

# 6. Teleport is really a geo-grid concept

This is an important architectural insight.

A serious implementation doesn't have to check only one location.

It can become:

```text
        ●────●────●
        │    │    │
        ●────●────●
        │    │    │
        ●────●────●
```

Each point represents a search location.

Then:

```text
Location       Rank

Point 1          3
Point 2          5
Point 3          8
Point 4          2
Point 5          4
...
```

Eventually you can visualize:

```text
3   4   8
2   3   7
1   2   5
```

That becomes a **local ranking heatmap**.

The official material confirms the ability to perform rank checks at selected locations, but the full internal methodology of how their location simulation is implemented is not publicly documented in the sources I checked.

---

# 7. Local Scan

This is probably the **most strategically important feature for us to study**.

GMB Everywhere describes Local Scan as:

> side-by-side competitor insights directly inside Google Maps.

You search for something like:

```text
dentist in Miami
```

then click **Local Scan**.

It analyzes the businesses appearing in the search results. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

---

## The workflow

```text
Google Maps

"dentist in Miami"

        ↓

Search results

Business A
Business B
Business C
Business D
Business E

        ↓

LOCAL SCAN

        ↓

Compare businesses
```

And the current Local Scan has these tabs:

1. Categories
2. Services
3. Reviews
4. Location
5. Open Times
6. Attributes

([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

---

# 8. Local Scan: Categories

This asks:

> **What categories are competitors using that I am not?**

Conceptually:

```text
             Your     Competitor A   Competitor B

Primary       Dentist     Dentist       Dentist
Cosmetic      ✓           ✓             ✓
Orthodontist  —           ✓             ✓
Emergency     —           ✓             —
Pediatric     —           —             ✓
```

The user can identify category gaps.

GMB Everywhere explicitly says this tab compares your categories against competitors. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

---

# 9. Local Scan: Services

Same idea, but for services.

```text
                    You    A    B    C

Teeth whitening     ✓      ✓    ✓    ✓
Implants            ✓      ✓    ✓    —
Braces              —      ✓    ✓    ✓
Emergency           —      ✓    —    ✓
Invisalign          —      ✓    ✓    —
```

Now you can see:

> "Competitors are consistently listing Invisalign, but we aren't."

GMB Everywhere explicitly describes the Services tab as comparing competitors' services to identify opportunities. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

---

# 10. Local Scan: Reviews

This compares review performance across the businesses.

For example:

```text
Business       Reviews       Rating

You              243          4.6
Competitor A     581          4.8
Competitor B     392          4.7
Competitor C     184          4.5
```

GMB Everywhere says this tab compares review performance between competitors. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

This is a relatively straightforward comparison once the underlying GBP data has been collected.

---

# 11. Local Scan: Location

This looks at geographic positioning.

For example:

```text
Search location
      │
      ▼
     YOU ───── 1.8 km
      │
      ├──────── Competitor A 0.4 km
      │
      └──────── Competitor B 0.9 km
```

GMB Everywhere describes proximity as an important factor and uses this tab to show location advantages relative to competitors. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

The extension also advertises extraction of exact GBP coordinates. ([GMB Everywhere](https://www.gmbeverywhere.com/features/find-google-business-coordinates?utm_source=chatgpt.com))

---

# 12. Local Scan: Open Times

This is a newer and interesting dimension.

It compares competitor opening hours.

Example:

```text
                 Mon     Tue     Wed

You              09-18   09-18   09-18
Competitor A     08-20   08-20   08-20
Competitor B     10-22   10-22   10-22
```

GMB Everywhere's explanation says the feature helps determine whether competitors may have an advantage from being open during particular periods. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

**KILLCRITIC:** Don't automatically interpret this as "Google ranks businesses higher simply because they have longer hours." GMB Everywhere itself frames the relationship as an advantage, but the exact causal ranking relationship is more complicated than a simple rule.

---

# 13. Local Scan: Attributes

Attributes are things such as business characteristics/amenities.

Conceptually:

```text
                    You    A    B

Wheelchair access   ✓      ✓    ✓
Online appointment  ✓      ✓    —
Women-led           —      ✓    —
Outdoor seating     —      ✓    ✓
```

GMB Everywhere specifically notes that attributes are **not a known ranking factor**, but can provide useful customer information and reveal gaps between profiles. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

That distinction is excellent and should be preserved in our own product.

---

# 14. Category Finder

Category Finder is different from Local Scan.

Local Scan asks:

> **"What do competitors have?"**

Category Finder asks:

> **"What other categories might be relevant?"**

GMB Everywhere advertises:

- Related category discovery
- Real-data-based category suggestions
- Service suggestions
- Traffic potential per category
- Suggestions from a website URL
- AI-based category suggestions

([GMB Everywhere](https://www.gmbeverywhere.com/guides/last-minute-booking-miami?utm_source=chatgpt.com))

---

## Basic workflow

```text
Existing categories
       ↓
Category Finder
       ↓
Related categories
       ↓
Potential opportunities
```

Example:

```text
Current:

Hotel
Resort

        ↓

Suggestions:

Boutique hotel
Wedding venue
Spa
Extended stay hotel
...
```

The important part is that GMB Everywhere says some suggestions are based on **real data**, while others can come from website analysis or AI. ([GMB Everywhere](https://www.gmbeverywhere.com/features/analyze-competitor-categories?utm_source=chatgpt.com))

Those should not be treated as equivalent evidence.

---

# 15. Service Finder

This is closely related.

Given:

```text
Category:
Dental clinic
```

the system can suggest services associated with that category.

GMB Everywhere describes service suggestions for each category as part of Category Finder. ([GMB Everywhere](https://www.gmbeverywhere.com/guides/competitor-gbp-services-gemini-gap-analysis?utm_source=chatgpt.com))

Conceptually:

```text
Category
   ↓
Relevant services
   ↓
Compare against existing services
   ↓
Identify gaps
```

This is potentially very valuable for competitor intelligence.

---

# 16. Post Audit

Post Audit does for **GBP Posts** what Review Audit does for reviews.

Its purpose is essentially:

> **Understand how a business uses Google Business Profile posts over time.**

GMB Everywhere advertises:

- Post timeline visualization
- Total post count
- Posting frequency
- Post content analysis
- Character count
- Links
- Media
- Performance insights

([GMB Everywhere](https://www.gmbeverywhere.com/guides/last-minute-booking-miami?utm_source=chatgpt.com))

---

## Timeline

Imagine:

```text
2025

Jan   ●
Feb   ●●
Mar   ●
Apr   ●●●
May   ●
Jun   ●●
```

The system turns the business's post history into a timeline.

This lets you see:

> "This competitor posts roughly twice per week."

GMB Everywhere explicitly supports timeline visualization and tracking posting frequency. ([GMB Everywhere](https://www.gmbeverywhere.com/features/visualize-post-timeline?utm_source=chatgpt.com))

---

# 17. Post content analysis

It can inspect the content of posts.

For example:

```text
Post #1
──────────────
Text: 450 characters
Image: YES
Video: NO
Link: YES

Post #2
──────────────
Text: 210 characters
Image: YES
Video: YES
Link: NO
```

GMB Everywhere says Post Audit analyzes post content, character count, links and media. ([GMB Everywhere](https://www.gmbeverywhere.com/guides/last-minute-booking-miami?utm_source=chatgpt.com))

The timeline itself can also be copied for reports/presentations according to its FAQ. ([GMB Everywhere](https://www.gmbeverywhere.com/features/visualize-post-timeline?utm_source=chatgpt.com))

---

# 18. Website Audit

This is another important expansion beyond pure GBP scraping.

GMB Everywhere's current site describes Website Audit as auditing the website associated with the GBP for local SEO signals, including things such as:

- NAP consistency
- Schema
- on-page signals
- website/GBP relationship
- other local SEO factors

The roadmap shows Website Audit as shipped. ([GMB Everywhere](https://roadmap.gmbeverywhere.com/b/dvd1ry6v/feature-ideas?utm_source=chatgpt.com))

So the architecture becomes:

```text
GBP
 │
 ├── GBP data
 │
 └── Website URL
          │
          ▼
       Website
          │
          ▼
     Website Audit
```

This is fundamentally different from scraping Google Maps.

It requires fetching/analyzing the actual website.

---

# 19. Google Ads detection

GMB Everywhere also has a feature for determining whether a business is running Google Ads. ([GMB Everywhere](https://www.gmbeverywhere.com/features/find-google-ads-via-gbp?utm_source=chatgpt.com))

This is another example of something that isn't really "GBP data."

It is more like:

```text
Business
   ↓
Associated Google presence
   ↓
Look for advertising presence
   ↓
Report indication
```

Again, the public feature page doesn't expose enough detail for us to claim the exact detection mechanism.

---

# 20. AI tools

As of August 2026, GMB Everywhere also has AI features.

Its current AI page advertises:

- GMB Post Generator
- Category Finder assistance
- Service Finder assistance
- Review Response Generator
- GBP Description Generator
- Facebook Post Generator
- Q&A generator
- GBP Image Generator

([GMB Everywhere](https://app.gmbeverywhere.com/release7/ai/landing-page-ai.html?utm_source=chatgpt.com))

These are **not the same thing as the data collection layer**.

Think:

```text
                 DATA
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
      GBP       Reviews     Posts
       │          │          │
       └──────────┼──────────┘
                  ▼
               ANALYSIS
                  │
                  ▼
                  AI
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
    Generate    Respond    Recommend
```

And this is especially important for our project because **our current Rother plan explicitly forbids AI/LLM features in this phase**. 

---

# 21. The really important architectural picture

Now that we've broken down the features, we can see something that wasn't obvious from the simple feature list.

GMB Everywhere is basically several different systems sitting behind one Chrome extension:

```text
                         GMB EVERYWHERE
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
       ▼                       ▼                        ▼
    GBP DATA               COMPETITOR                RANKING
    EXTRACTION             ANALYSIS                  ANALYSIS
       │                       │                        │
       ├── Basic Audit         ├── Local Scan          └── Teleport
       ├── Categories          ├── Reviews
       ├── Services            ├── Categories
       ├── Attributes          ├── Services
       ├── Links               ├── Location
       └── Coordinates         ├── Hours
                               └── Attributes
       │
       ├───────────────────────┐
       ▼                       ▼
    REVIEWS                   POSTS
       │                       │
       ▼                       ▼
 Review Audit              Post Audit
       │                       │
       ├── Trends              ├── Timeline
       ├── Keywords            ├── Frequency
       ├── Filters             ├── Content
       └── Rating              ├── Media
                               └── Links

       │
       ▼
    RESEARCH
       │
       ├── Category Finder
       ├── Service Finder
       └── Website Audit
```

That is the much more useful way for us to think about it.

---

# 22. And this reveals something critical about Rother

Our current Rother architecture:

```text
Discovery
   ↓
Playwright
   ↓
HTML
   ↓
Parser
   ↓
Review records
   ↓
Snapshots
   ↓
Delta detection
   ↓
Scheduled monitoring
```



is **not a GMB Everywhere clone**.

It is actually the beginning of the **data acquisition/history layer** required to build some of these capabilities.

For example:

### Review Audit

We already have:

```text
Review
 ├── ID
 ├── reviewer
 ├── rating
 ├── text
 ├── date
 └── scraped_at
```

The project plan explicitly defines this review record structure. 

Then we can derive:

```text
Review records
      ↓
Historical database
      ↓
Rating trends
      ↓
Review trends
      ↓
Keyword analysis
      ↓
Filtering
```

### Local Scan

We eventually need:

```text
Business A ─┐
Business B ─┤
Business C ─┼──→ normalized business records
Business D ─┤
Business E ─┘
                     ↓
                 comparison
```

### Teleport

We need:

```text
Keyword
+
Coordinates
+
Search results
+
Ranking position
```

### Post Audit

We need:

```text
GBP
 ↓
Posts
 ↓
Post history
 ↓
Timeline
 ↓
Frequency/content/media analysis
```

### Basic Audit

We need:

```text
GBP
 ↓
Normalized profile
 ↓
Categories
Services
Attributes
Coordinates
Links
Identifiers
Photos
Hours
etc.
```

---

# 23. The biggest KILLCRITIC finding

I would **not** start implementing all of these right now.

The temptation is:

> "Let's add categories, services, Local Scan, Teleport, posts, Website Audit, etc."

That would be a mistake.

The hard dependency underneath almost everything is:

# **Reliable Google data acquisition.**

If that fails:

```text
Bad extraction
     ↓
Bad review data
     ↓
Bad history
     ↓
Bad comparison
     ↓
Bad rank analysis
     ↓
Bad dashboard
```

A beautiful dashboard cannot fix bad source data.

This is exactly why your execution rules are strict about **real verification, selectors, external-system assumptions, and distinguishing PROVEN from UNPROVEN**. 

---

# 24. What I think we should take from GMB Everywhere

Not:

> "Copy GMB Everywhere."

Instead:

### Their product hierarchy gives us a potential roadmap.

```text
LEVEL 0
Reliable Google data acquisition
        ↓
LEVEL 1
Business/profile intelligence
        ↓
LEVEL 2
Review + Post historical data
        ↓
LEVEL 3
Competitor comparison
        ↓
LEVEL 4
Geo-rank monitoring
        ↓
LEVEL 5
SEO recommendations
        ↓
LEVEL 6
AI assistance
```

And our current Rother work is roughly:

```text
LEVEL 0
    ↓
Review-focused LEVEL 1/2
```

That is actually a sensible starting point.

---

## One final distinction I want us to preserve

There are **three different things** hiding behind the phrase "GMB Everywhere-like":

| Capability | What it really means |
|---|---|
| **Extraction** | Get information from Google |
| **Analysis** | Turn information into useful comparisons/metrics |
| **Monitoring** | Repeatedly collect it and detect change |

GMB Everywhere is heavily oriented toward **interactive extraction + analysis**.

Rother is currently oriented toward **automated extraction + monitoring**.

That means we don't necessarily need to beat GMB Everywhere by cloning it.

We could potentially build something **different and arguably more useful for agencies/companies**:

> **A persistent GBP intelligence and competitor-monitoring system**, rather than merely a browser audit tool.

And *that* is where the architecture we already designed becomes interesting.

---

# you asked

message time: 2026-09-05 14:19:28

/KILLCRITIC /PITFALLS i heard some features of gmbeverywhere required their own server for data processing, is that correct?

---

# chatgpt response

Yes, **that is basically correct**, but there is an important distinction.

I would phrase it as:

> **Some GMB Everywhere features appear to depend on GMB Everywhere's backend/server-side processing, while the Chrome extension handles the Google-page integration and some data collection/presentation.**

I would **not** say that "GMB Everywhere runs entirely on its own server" because their public documentation does not establish that.

I checked their current material rather than relying on our previous assumptions. Their official site confirms that the extension runs inside Google Maps/Search/Local Finder, while the product also has account/subscription functionality and AI capabilities. ([gmbeverywhere.com](https://www.gmbeverywhere.com/?utm_source=chatgpt.com))

## The important architectural distinction

Think of GMB Everywhere more like this:

```text
                 GOOGLE
                   │
                   ▼
        ┌─────────────────────┐
        │ Chrome Extension    │
        │                     │
        │ - detects GBP       │
        │ - adds buttons      │
        │ - reads page data   │
        │ - collects context  │
        └──────────┬──────────┘
                   │
                   │ data / request
                   ▼
        ┌─────────────────────┐
        │ GMB Everywhere      │
        │ Backend              │
        │                     │
        │ - account/auth       │
        │ - processing         │
        │ - historical data    │
        │ - AI services        │
        │ - potentially other │
        │   analysis           │
        └──────────┬──────────┘
                   │
                   ▼
                Results
                   │
                   ▼
             Extension/UI
```

But there is a crucial caveat:

**GMB Everywhere does not publicly document enough of its internal architecture for us to confidently assign every individual feature to "browser" or "server."**

So we should distinguish **confirmed**, **strongly implied**, and **unknown**.

---

# 1. Basic Audit

### What we know

Basic Audit is launched directly from a Google Maps business listing.

GMB Everywhere says it extracts things such as:

- Place ID
- Knowledge ID
- CID
- Categories
- Services
- Attributes
- GBP links
- 40+ other data points/tools

([gmbeverywhere.com](https://www.gmbeverywhere.com/?utm_source=chatgpt.com))

This strongly suggests that **at least part of the data acquisition happens in the browser context**, because the extension is operating directly against the Google Maps page.

### Does it need their server?

**Possibly for parts of the processing/account layer, but not necessarily for every field.**

For example:

```text
Google Maps page
       ↓
Chrome extension
       ↓
extract Place ID
       ↓
display Place ID
```

There is no inherent reason that this particular operation requires a remote server.

But:

```text
Google Maps page
       ↓
Extension
       ↓
GMB Everywhere backend
       ↓
additional processing/data
       ↓
result
```

could absolutely be part of their architecture.

**We don't have enough public evidence to say which fields take which path.**

---

# 2. Review Audit

This is where things get much more interesting.

GMB Everywhere advertises:

- Review/rating trends over time
- Detailed review analysis
- Keyword discovery
- Custom filtering
- Other review analysis features

([gmbeverywhere.com](https://www.gmbeverywhere.com/features/ai-review-reply-generator?utm_source=chatgpt.com))

And it has automatic keyword analysis, where keyword badges are generated and clicking a badge filters the reviews. ([gmbeverywhere.com](https://www.gmbeverywhere.com/features/find-keywords-in-reviews?utm_source=chatgpt.com))

### Does this require a server?

**The historical component very likely requires persistent storage somewhere.**

For example:

```text
Today
410 reviews
     ↓
save state

Tomorrow
414 reviews
     ↓
save state

Next week
421 reviews
     ↓
compare
```

A browser extension alone can technically store this locally, but if GMB Everywhere wants:

- persistence across computers
- account-wide history
- subscription-based access
- long-term historical trends
- server-side processing

then a backend/database is the natural architecture.

### This is VERY relevant to Rother

Our Rother architecture already has this concept:

```text
GBP
 ↓
reviews
 ↓
snapshot
 ↓
storage
 ↓
next snapshot
 ↓
delta
```

That is essentially the foundation needed for historical review analysis.

---

# 3. Keyword analysis

This is one of the areas where **server-side processing becomes plausible**, but we cannot confirm the exact architecture.

GMB Everywhere automatically identifies frequently mentioned terms and creates clickable keyword badges. ([gmbeverywhere.com](https://www.gmbeverywhere.com/features/find-keywords-in-reviews?utm_source=chatgpt.com))

Conceptually:

```text
Reviews
   ↓
text processing
   ↓
tokenization / normalization
   ↓
frequency analysis
   ↓
keywords
   ↓
UI
```

That processing could happen:

### Option A, browser

```text
Reviews
 ↓
JavaScript
 ↓
keyword calculation
 ↓
UI
```

or:

### Option B, server

```text
Reviews
 ↓
HTTPS request
 ↓
GMB server
 ↓
keyword processing
 ↓
results
 ↓
extension
```

**Public documentation doesn't tell us which one they use.**

So I would mark:

> **Server required: UNPROVEN**

rather than assuming it.

---

# 4. Teleport / Rank Checking

This is more interesting.

GMB Everywhere says Teleport can:

- find GBP rank at any location
- search for any term
- find competitors at any location
- use customizable locations
- operate worldwide

([gmbeverywhere.com](https://www.gmbeverywhere.com/?utm_source=chatgpt.com))

Now consider what has to happen.

```text
User:
"dentist"

Location:
Jakarta coordinates

        ↓

Google Maps search
        ↓
results
        ↓
identify businesses
        ↓
calculate rank
```

The actual Google Maps interaction can potentially happen from the user's browser.

But there are reasons a backend could be useful:

```text
User location
       +
search query
       ↓
backend
       ↓
remote search infrastructure
       ↓
Google
       ↓
results
       ↓
rank calculation
```

Especially if you're trying to simulate searches from arbitrary geographic locations.

### But again

We **cannot prove from public documentation that GMB Everywhere's Teleport uses their own server to perform the Google search.**

So:

**Server-side processing: plausible / likely for some architecture, but not publicly confirmed.**

---

# 5. Local Scan

This is another feature where your question becomes very relevant.

Local Scan compares multiple competitors and currently covers things such as:

- Categories
- Services
- Reviews
- Location
- Open Times
- Attributes

GMB Everywhere describes it as comparing multiple businesses in one scan. ([gmbeverywhere.com](https://www.gmbeverywhere.com/?utm_source=chatgpt.com))

Imagine:

```text
Google Maps
     ↓
Search results
     ↓
A B C D E
     ↓
Local Scan
     ↓
┌─────────────────────────┐
│ A │ B │ C │ D │ E       │
│ categories              │
│ services                │
│ reviews                 │
│ location                │
│ hours                   │
│ attributes               │
└─────────────────────────┘
```

Some of that data can be read from Google Maps.

But the **comparison/normalization layer** can be done either:

```text
Browser:
collect → normalize → compare
```

or:

```text
Browser:
collect
   ↓
server
   ↓
normalize → compare
   ↓
browser
```

Again, public documentation doesn't expose the implementation.

---

# 6. AI features

Here I am much more confident.

GMB Everywhere explicitly has AI functionality, including:

- GBP Post Generator
- Review Response Generator
- GBP Description Generator
- Q&A Generator
- Facebook Post Generator

([gmbeverywhere.com](https://www.gmbeverywhere.com/features/use-ai-tools-for-gbp?utm_source=chatgpt.com))

Their Review Response Generator, for example, takes review content and generates a response tailored to it. ([gmbeverywhere.com](https://www.gmbeverywhere.com/features/ai-review-reply-generator?utm_source=chatgpt.com))

### This inherently involves processing outside simple DOM manipulation

Conceptually:

```text
Review
  ↓
GMB Everywhere
  ↓
AI processing
  ↓
generated response
  ↓
extension/UI
```

Whether they run their own model or call a third-party AI provider isn't established by the sources I checked.

But:

> **The AI feature is not simply "Google Maps HTML → CSS/JavaScript."**

There has to be an AI inference service somewhere.

---

# 7. Category Finder

Category Finder can:

- find related categories based on real data
- suggest services
- analyze traffic potential
- analyze a website URL
- provide AI suggestions

([gmbeverywhere.com](https://www.gmbeverywhere.com/features/find-google-business-services?utm_source=chatgpt.com))

This is another mixed architecture.

Some things could be calculated locally:

```text
known category
 ↓
local lookup table
 ↓
related categories
```

But:

```text
website URL
 ↓
fetch website
 ↓
analyze content
 ↓
generate category suggestions
```

or:

```text
category
 ↓
traffic/search data
 ↓
analysis
```

may involve external/server-side resources.

The exact implementation isn't public.

---

# 8. Post Audit

Post Audit tracks things like:

- GBP post timeline
- total posts
- posting frequency
- content
- character count
- links
- media
- performance insights

([gmbeverywhere.com](https://www.gmbeverywhere.com/features/ai-review-reply-generator?utm_source=chatgpt.com))

Again, there is an important distinction.

### Current page data

Could be:

```text
Google
 ↓
extension
 ↓
posts
 ↓
analyze
```

### Historical timeline

Requires:

```text
Post data
 ↓
save
 ↓
future observation
 ↓
compare
```

That requires persistent state somewhere.

So **historical monitoring strongly pushes the architecture toward storage/backend infrastructure**, unless everything is intentionally stored locally in the browser.

---

# 9. The most important answer

So if you heard:

> **"GMB Everywhere needs its own server for some features."**

I would say:

### **Yes, that is a reasonable understanding, but don't overstate what we know.**

We can confidently say:

| Component | Browser can do it? | Backend potentially needed? |
|---|---:|---:|
| Inject buttons into Google | ✅ | ❌ |
| Read visible GBP information | ✅ | ❌ |
| Extract basic identifiers | ✅ | ❌ |
| Display basic audit | ✅ | Possibly |
| Review extraction | ✅ | Possibly |
| Review filtering | ✅ | ❌ |
| Keyword analysis | ✅ | Possibly |
| Historical review trends | ⚠️ | **Likely storage required** |
| Local Scan | ✅ | Possibly |
| Rank checking | ✅/⚠️ | **Potentially important** |
| Geo/location processing | ✅ | Possibly |
| Post analysis | ✅ | Possibly |
| Historical post tracking | ⚠️ | **Likely storage required** |
| AI generation | ❌* | **Yes, some AI service required** |
| Subscription/account | ❌ | **Yes** |
| Cross-device history | ❌ | **Yes** |

\*Technically a model can run locally, but that's not the normal architecture for a commercial browser extension of this type.

---

# And this is where I want to correct our Rother thinking

This is **very important for the project**.

We previously talked about:

> "Can we build something like GMB Everywhere with zero recurring cost?"

The answer is:

## **A browser-only GMB Everywhere-like tool is possible for some features.**

For example:

```text
Chrome extension
       ↓
Google Maps
       ↓
extract GBP data
       ↓
analyze locally
       ↓
display
```

That can potentially be **zero-server-cost**.

But once we want:

```text
scheduled monitoring
        +
historical data
        +
multiple clients
        +
cross-device access
        +
persistent competitor databases
        +
automated rank checks
        +
alerts
```

we've entered **backend territory**.

---

# Rother is actually going in that direction already

Our current architecture is:

```text
              ROTHER

Google Maps
     ↓
Playwright
     ↓
HTML
     ↓
Parser
     ↓
Structured reviews
     ↓
Snapshots
     ↓
Delta detection
     ↓
Scheduled execution
```



Notice what happens here.

The moment we say:

> **"Check this competitor every day and tell me what changed."**

we need persistent state.

That doesn't necessarily mean:

> **"We need an expensive commercial server."**

It means:

> **"We need somewhere reliable to store state and execute jobs."**

And our current plan deliberately uses **GitHub Actions + repository storage** for the zero-cost architecture. 

---

# KILLCRITIC conclusion

The dangerous assumption would be:

> **"GMB Everywhere has a server, therefore we need to build a giant server backend."**

**No.**

The correct architectural question is:

> **Which operations genuinely require persistent/shared/server-side state, and which can safely happen locally?**

I would divide Rother into:

```text
┌──────────────────────────────────────────┐
│              LOCAL / BROWSER             │
│                                          │
│ Google interaction                       │
│ DOM extraction                           │
│ Parsing                                  │
│ Filtering                                │
│ Basic calculations                       │
└───────────────────┬──────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│          PERSISTENT STATE LAYER           │
│                                          │
│ Business records                         │
│ Review snapshots                         │
│ Post snapshots                            │
│ Historical data                           │
│ Change detection                          │
└───────────────────┬──────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│          OPTIONAL SERVER LAYER            │
│                                          │
│ Multi-client dashboard                   │
│ API                                      │
│ Central database                         │
│ Scheduling                               │
│ Notifications                            │
│ AI                                       │
│ Heavy processing                         │
└──────────────────────────────────────────┘
```

**That is the architecture I would recommend investigating before we restart/build Rother.**

And I would specifically **not assume GMB Everywhere's server architecture is something we need to copy**, because we don't have evidence of its internal implementation.

The next useful step would be to map **every GMB Everywhere feature into "browser-only / local storage / backend required / external service required"**, then compare that against Rother and identify **the minimum backend we actually need**. That would answer the zero-budget question much more rigorously.

---

# you asked

message time: 2026-09-05 14:20:42

/KILLCRITIC /PITFALLS alright can you please list again all of the features in gmbeverywhere as of september 2026, but list the one that does not need any server.

---

# chatgpt response

Yes. I re-checked the **current GMB Everywhere material available in September 2026** rather than carrying over the August list.

There is one important correction to make first:

> **We cannot reliably say which GMB Everywhere features themselves run without GMB Everywhere's server.** Their public documentation describes what the features do, but does not publish their internal client/server architecture.

So below I will distinguish **"can technically be implemented without a server"** from **"GMB Everywhere is proven to run without a server."** Those are not the same thing.

## GMB Everywhere feature list, September 2026

The current pricing page explicitly lists these core tools: **Basic Audit, Teleport Audit, Review Audit, Category Finder, Local Scan, Website Audit, Post Audit**, plus several AI tools. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/pricing.html?utm_source=chatgpt.com))

| Feature | What it does | Can the core operation be browser/local only? | Server/backend likely/needed? |
|---|---|---:|---|
| **Basic Audit** | Extracts/analyzes GBP information | 🟢 **Yes** | Not inherently |
| **Teleport Audit / Rank Check** | Checks rankings from selected locations | 🟡 **Potentially** | Likely useful, but not proven |
| **Review Audit** | Analyzes reviews, ratings, trends, keywords | 🟢 **Yes, for current data** | Historical persistence needs storage |
| **Category Finder** | Finds additional/relevant GBP categories | 🟢 **Yes, depending on data source** | Some functionality may use external/backend data |
| **Local Scan** | Compares businesses in Maps | 🟢 **Yes** | Not inherently |
| **Website Audit** | Analyzes the GBP-associated website | 🟢 **Yes** | Not inherently |
| **Post Audit** | Analyzes GBP posts/timeline | 🟢 **Yes, for current page data** | Historical persistence needs storage |
| **AI GMB Post Generator** | Generates GBP posts | 🔴 **No, normally** | AI service required |
| **AI Review Response Generator** | Generates review responses | 🔴 **No, normally** | AI service required |
| **AI Description Generator** | Generates GBP descriptions | 🔴 **No, normally** | AI service required |
| **AI Facebook Post Generator** | Generates Facebook posts | 🔴 **No, normally** | AI service required |
| **AI Q&A Generator** | Generates GBP Q&A content | 🔴 **No, normally** | AI service required |
| **GBP Image Generator** | Generates branded images | 🔴 **No, normally** | Image-generation service required |
| **GMB Category Finder AI** | AI-assisted category suggestions | 🔴 **No, normally** | AI service required |
| **GMB Service Finder AI** | AI-assisted service suggestions | 🔴 **No, normally** | AI service required |
| **GBP AI Visibility Checker** | Checks how AI systems recommend a business | 🔴 **No** | Requires external AI/search systems |

The current AI page confirms the AI tools, including the newer **GBP Image Generator** and **GBP AI Visibility Checker**. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/ai/landing-page-ai.html?utm_source=chatgpt.com))

---

# 🟢 The important "no-server" group

If what you're really asking is:

> **"Which GMB Everywhere capabilities could we reproduce as a Chrome extension without building our own backend?"**

then there are quite a few.

### 1. Basic Audit

Potentially **100% browser-side**.

```text
Google Maps
     ↓
Chrome extension
     ↓
Read GBP page
     ↓
Extract data
     ↓
Calculate/display
```

For example:

- Business name
- Address
- Categories
- Services
- Attributes
- Coordinates
- Place ID
- CID
- Links
- Photos count
- Hours

The current GMB Everywhere pricing page confirms Basic Audit as a core feature. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/pricing.html?utm_source=chatgpt.com))

**No backend is inherently required for the basic extraction/analysis.**

---

# 🟢 2. Local Scan

This is another feature that **doesn't inherently require a server**.

You could theoretically do:

```text
Google Maps
     ↓
Search results
     ↓
Extension reads businesses
     ↓
Open/read relevant information
     ↓
Normalize
     ↓
Compare locally
     ↓
Display table
```

For example:

```text
                 YOU     A       B       C

Categories       3       5       4       6
Services        12      18      15      21
Reviews        243     581     392     184
Rating         4.6     4.8     4.7     4.5
Distance       1.2km   0.4km   0.8km   2.1km
```

That's fundamentally a **data extraction + normalization + comparison problem**.

No remote server is mathematically required.

GMB Everywhere's current roadmap confirms Local Scan is an active shipped feature. ([GMB Everywhere Roadmap](https://roadmap.gmbeverywhere.com/roadmap?utm_source=chatgpt.com))

---

# 🟢 3. Website Audit

This is also potentially browser-only.

Conceptually:

```text
GBP
 ↓
Get website URL
 ↓
Browser fetches website
 ↓
Parse HTML
 ↓
Analyze
 ↓
Report
```

For example:

```text
GBP:
ABC Dental

Website:
https://example.com

        ↓

Check:

Name       ✓
Address    ✓
Phone      ✓
Hours      ✓
Categories ✓
Services   ✓
```

GMB Everywhere currently describes Website Audit as checking whether the website matches the GBP in areas such as name, address, phone, hours and categories. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

Again, **a server isn't inherently necessary**.

There can be browser restrictions such as CORS, however, which can make direct client-side website fetching difficult. That's a technical limitation, not proof that GMB Everywhere uses a backend.

---

# 🟢 4. Review Audit, current-data portion

This one needs a little nuance.

If the reviews are already available to the extension:

```text
Google Maps
     ↓
Reviews
     ↓
Extension
     ↓
Filter
     ↓
Search
     ↓
Calculate statistics
```

then you don't need a server.

You can calculate:

- review count
- rating distribution
- keyword frequency
- review filtering
- date filtering
- average rating
- review statistics

locally in JavaScript.

### But historical data changes the answer.

If you want:

```text
September 1
410 reviews

September 5
417 reviews

September 10
425 reviews
```

then you need persistent storage somewhere.

That could be:

```text
Browser local storage
```

rather than:

```text
Your own server
```

So:

**Review analysis = 🟢 potentially serverless**

**Cross-device/historical cloud monitoring = 🔴 requires some persistent backend/storage**

---

# 🟢 5. Post Audit, current-data portion

Same principle.

Current posts:

```text
Google
 ↓
GBP posts
 ↓
Extension
 ↓
Analyze
```

can be processed locally.

You could calculate:

- number of posts currently available
- character count
- posting intervals
- media presence
- links
- content statistics

But persistent historical monitoring:

```text
September
   ↓
save

October
   ↓
save

November
   ↓
compare
```

requires storage somewhere.

Again, **that does not necessarily mean a server**.

IndexedDB/local files/browser storage could theoretically do it.

---

# 🟡 6. Teleport / Rank Check

This is the one I would **not classify as definitely serverless**.

GMB Everywhere currently supports dropping multiple pins and checking ranking at each location. Its current update describes:

> multiple pins → rank at each spot → color-coded results

and the roadmap also lists rank-check improvements. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/update-notification.html?utm_source=chatgpt.com))

The basic concept could theoretically be:

```text
Browser
 ↓
Google Maps
 ↓
Search
 ↓
Read results
 ↓
Find business
 ↓
Calculate position
```

But arbitrary-location ranking introduces more complexity.

For example:

```text
         ●────●────●
         │    │    │
         ●────●────●
         │    │    │
         ●────●────●
```

You need to perform searches representing those locations.

A browser extension could potentially manipulate the Maps/search context, but there are practical limitations.

So I would mark:

> **🟡 Server not inherently required, but do not design our implementation assuming it is serverless until experimentally proven.**

---

# 🟢 7. Category Finder, non-AI portion

The basic concept can be local.

For example:

```text
Existing:
Hotel

Known category dataset
        ↓
Related categories
        ↓
Display
```

If the extension already possesses the necessary category data, there's no fundamental reason it needs your own server.

However, if the product is obtaining:

- external search-volume data
- large proprietary datasets
- continuously updated category relationships
- AI-generated suggestions

then the architecture can become server-dependent.

So:

**Basic category lookup = 🟢**

**AI/traffic intelligence = 🔴/🟡**

---

# 🔴 AI features

These are the easiest ones to classify.

GMB Everywhere currently offers:

- GMB Post Generator
- Review Response Generator
- Description Generator
- Facebook Post Generator
- Q&A Generator
- Category Finder AI
- Service Finder AI
- Image Generator
- AI Visibility Checker

([GMB Everywhere](https://app.gmbeverywhere.com/release7/ai/landing-page-ai.html?utm_source=chatgpt.com))

These are **not realistically "no-server" features** for a conventional browser extension.

For example:

```text
Review
   ↓
Prompt
   ↓
AI model
   ↓
Generated response
```

You need an inference service somewhere.

It could theoretically be a local model, but that is a completely different architecture and isn't something we should assume GMB Everywhere is doing.

The current Image Generator, for example, explicitly describes AI-generated images and lets the user provide a custom prompt. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/ai/gbp-image-generator.html?via=update-notification&utm_source=chatgpt.com))

---

# 🔴 AI Visibility Checker

This one is especially clearly **not a simple browser-only feature**.

The current AI tools page describes it as checking where AI recommends your business across:

- Google AI Mode
- ChatGPT

([GMB Everywhere](https://app.gmbeverywhere.com/release7/ai/landing-page-ai.html?utm_source=chatgpt.com))

That's fundamentally an **external-system query/monitoring problem**.

You'd need access to those AI systems somehow.

So I would classify:

> **🔴 Backend/external-service dependent**

---

# The bigger distinction

Here's the part I think is most important for our Rother architecture.

There are actually **three categories**, not just "server" and "no server."

### A. Browser computation

```text
Google
 ↓
Extension
 ↓
JavaScript
 ↓
Result
```

No server required.

Examples:

- Basic Audit
- Local Scan comparison
- Current Review filtering
- Current Post analysis
- Basic category analysis
- Website analysis, where browser access permits

---

### B. Browser + persistent local storage

```text
Google
 ↓
Extension
 ↓
Analyze
 ↓
IndexedDB / local storage
 ↓
Historical comparison
```

Still **no server required**.

Examples:

- Review history
- Post history
- Local audit history
- Personal rank history

But the data belongs to that browser/device.

---

### C. Backend/cloud

```text
Google
 ↓
Extension
 ↓
Backend
 ↓
Database
 ↓
Processing
 ↓
Dashboard
```

Now you can support:

- Multiple users
- Multiple clients
- Cross-device access
- Centralized monitoring
- Scheduled jobs
- Notifications
- Large datasets
- Shared reports
- AI
- Centralized rank tracking

This is where our **commercial Rother** eventually moves.

---

# And here's the KILLCRITIC point

**Do not assume that because GMB Everywhere has a backend, every feature needs one.**

That would cause us to over-engineer Rother.

For example, we could potentially build:

```text
             ROTHER EXTENSION
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   Basic Audit  Local Scan  Review Audit
        │           │           │
        └───────────┼───────────┘
                    ▼
             Local analysis
                    │
                    ▼
             IndexedDB
```

**No Rother server.**

Then separately:

```text
                 OPTIONAL
                ROTHER CLOUD
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    Monitoring     Clients       AI
        │            │            │
    History       Accounts      Reports
        │            │            │
        └────────────┼────────────┘
                     ▼
                  Backend
```

That gives us a much more flexible product.

---

# One thing we should NOT claim

I would **not put this statement in our architecture documentation**:

> "GMB Everywhere's Basic Audit is serverless."

We don't know that.

The correct statement is:

> **"Basic Audit does not inherently require a backend because the required data can potentially be extracted and processed within the browser."**

That's a technically defensible statement.

Likewise:

> **"Historical monitoring requires persistent storage, but that storage does not necessarily have to be a remote server."**

That's an important distinction.

---

## My recommended classification for Rother

If our goal is **zero recurring server cost**, I would prioritize the features in this order:

### 🟢 Tier 1, genuinely suitable for browser-only MVP

1. **Basic Audit**
2. **Local Scan**
3. **Current Review Audit**
4. **Current Post Audit**
5. **Basic Category Finder**
6. **Website Audit**

### 🟡 Tier 2, possible without server but technically harder

7. **Teleport / Rank Check**
8. **Historical Review Audit using local storage**
9. **Historical Post Audit using local storage**
10. **Local rank history**

### 🔴 Tier 3, don't treat as serverless

11. **AI Post Generator**
12. **AI Review Response Generator**
13. **AI Description Generator**
14. **AI Facebook Post Generator**
15. **AI Q&A Generator**
16. **AI Category Finder**
17. **AI Service Finder**
18. **AI Image Generator**
19. **AI Visibility Checker**

And GMB Everywhere's current pricing page confirms that these tools are bundled as account-controlled features, with usage limits for the free tier and unlimited access on the paid tier. ([GMB Everywhere](https://app.gmbeverywhere.com/release7/admin-pages/pricing.html?utm_source=chatgpt.com))

**This is actually good news for our Rother project:** we don't have to build a server merely to reproduce the *core data-analysis experience*. We only need one when we want **persistent centralized monitoring, multi-client operation, scheduled cloud execution, shared data, or AI/external-service functionality**.

---

# you asked

message time: 2026-09-05 14:22:51

/PITFALLS /KILLCRITIC i have this information coming from google ai mode, can you check on if the facts are aligned with what've you found?

---

# chatgpt response

Yes. Please send/upload the **Google AI Mode information** you want me to check.

Once I have it, I'll compare it against the current GMB Everywhere information and classify each claim as:

- 🟢 **Confirmed / aligned**
- 🟡 **Partially aligned / needs qualification**
- 🔴 **Contradicted / likely incorrect**
- ⚪ **Unverified** because GMB Everywhere doesn't publicly expose enough implementation detail

I'll pay particular attention to the claim we're investigating:

> **Which GMB Everywhere features require GMB Everywhere's own backend/server, and which can operate entirely client-side?**

I’ll also distinguish between:

1. **What GMB Everywhere publicly confirms the feature does**
2. **What Google AI Mode claims about its implementation**
3. **What we can technically infer**
4. **What we absolutely cannot conclude without inspecting their extension/network behavior**

That last distinction is important because **"this feature needs a server"** and **"GMB Everywhere happens to use a server for this feature"** are two very different claims.

Send the information and I'll do a **claim-by-claim fact check**, with the `/PITFALLS /KILLCRITIC` lens.

---

# you asked

message time: 2026-09-05 14:23:39

/PITFALLS /KILLCRITIC

i have paste you the information.

---

# chatgpt response

Yes. I found the pasted Google AI Mode material, and **there are several important differences between what it claims and what we can actually establish**.

The biggest issue is that the Google AI Mode answer repeatedly turns **reasonable technical possibilities into statements of fact about GMB Everywhere's private implementation**. That is exactly the kind of thing we should reject under `/KILLCRITIC`.

## Bottom line

The Google AI Mode information is **partly aligned**, but I would **not use it as an architectural source for Rother**.

The strongest claims are:

> GMB Everywhere is a Chrome extension that operates on Google Maps/Google Search and exposes GBP information, including competitor categories.  
> Google Maps can deliver data to the browser that isn't represented as ordinary visible HTML.  
> `Ctrl+U`/View Source is not equivalent to the live DOM or the network responses.

Those are broadly sound.

The problematic claims are:

> "GMB Everywhere intercepts XHR/Fetch."

> "GMB Everywhere uses its own scraping servers for Geo-Grid."

> "They use browser automation + proxies."

> "They don't use Google APIs."

> "The data is 100% free from Google's charges."

Those are **not established by the evidence in the pasted material**.

---

# 1. "GMB Everywhere reads hidden categories from the browser"

### Google AI Mode says

It claims GMB Everywhere gets hidden secondary categories because Google sends the information to the browser, and the extension reads that underlying data. 

### Verdict

🟢 **Technically plausible and broadly aligned.**

But there is an important distinction.

Google Maps is a dynamic web application. The data required to construct the UI does not necessarily exist in the simple HTML you see with `Ctrl+U`.

So this:

```text
Google server
      ↓
network responses
      ↓
browser
      ↓
Google Maps JavaScript
      ↓
rendered UI
```

is a much better mental model than:

```text
Google server
      ↓
HTML source
      ↓
Google Maps
```

Your own experiment with Crate Cafe is actually a good demonstration of why the second model is insufficient.

---

# 2. "GMB Everywhere uses View Page Source"

### Google AI Mode says

It initially suggested that GMB Everywhere reads the source code and that hidden categories are present in that source.

But later, when you challenged it with your Crate Cafe test, it correctly acknowledged that `Ctrl+U` does not necessarily contain everything the browser receives or renders. 

### Verdict

🔴 **The original claim is misleading.**

We should **not** model GMB Everywhere as:

```text
Ctrl+U
 ↓
search "category"
 ↓
extract category
```

That's almost certainly too simplistic.

The correct distinction is:

### View Source

```text
initial document source
```

versus:

### Live DOM

```text
DOM after JavaScript execution
```

versus:

### Network data

```text
XHR / Fetch / RPC / other requests
```

versus potentially:

### JavaScript/application state

```text
data already loaded into the Maps application
```

These are four different things.

---

# 3. "GMB Everywhere intercepts XHR/Fetch"

This is one of the claims I would **downgrade heavily**.

The pasted answer says:

> GMB Everywhere intercepts the communication between the browser and Google's servers and reads XHR/Fetch responses. 

### Verdict

🟡 **Plausible technique, but UNPROVEN for GMB Everywhere.**

There is a huge difference between:

> "A Chrome extension can inspect/interact with data available to the page."

and:

> "GMB Everywhere specifically intercepts Google's XHR/Fetch responses."

The second requires evidence.

We haven't seen:

- GMB Everywhere source code
- its network interception implementation
- Chrome extension permissions proving this
- a network trace demonstrating its requests
- its JavaScript showing interception hooks

Therefore:

### Do NOT write in Rother docs:

> "GMB Everywhere uses XHR interception."

Instead:

> "One technically plausible mechanism is consuming data available through Google's network responses or application state. GMB Everywhere's exact extraction mechanism is not publicly established."

That's much safer.

---

# 4. "GMB Everywhere uses its own scraping servers"

This is the **biggest problem** in the pasted information.

The AI answer says:

> For heavy features such as Geo-Grid, GMB Everywhere uses its own internal servers, browser automation and proxies. 

### Verdict

🔴 **UNPROVEN.**

This is precisely the claim I would **not accept without evidence**.

We have no demonstrated evidence here of:

```text
GMB Everywhere
      ↓
their server
      ↓
Playwright/Puppeteer
      ↓
proxy
      ↓
Google
```

It is a perfectly reasonable architecture for a commercial rank-tracking product.

But "reasonable architecture" ≠ "GMB Everywhere's architecture."

---

# 5. Geo-Grid specifically

The AI answer claims:

> A 3×3 grid means their server simultaneously simulates nine locations. 

### Verdict

🔴 **Not established.**

What we can establish is the **functional behavior**:

```text
Location 1 → ranking
Location 2 → ranking
Location 3 → ranking
...
Location 9 → ranking
```

What we **cannot establish** is:

```text
those nine searches happen on GMB Everywhere servers
```

They could theoretically be:

### Architecture A

```text
Browser
 ├── search location 1
 ├── search location 2
 ├── search location 3
 └── ...
```

or:

### Architecture B

```text
Browser
      ↓
GMB Everywhere backend
      ↓
remote searches
```

or even a hybrid.

Without observing the extension's traffic, we don't know.

---

# 6. "They use proxies"

### Verdict

🔴 **Unsupported.**

The AI answer says GMB Everywhere pays for proxies to avoid Google blocking its servers. 

That may be how **some** rank-tracking services operate.

It does not establish that GMB Everywhere does.

This is a classic AI hallucination pattern:

```text
Common industry architecture
             ↓
      "GMB Everywhere"
```

The reasoning silently jumps from "this is common" to "this company does it."

We should not do that.

---

# 7. "GMB Everywhere doesn't use paid Google APIs"

### Verdict

🟡 **Plausible, but not proven by the pasted evidence.**

The answer says:

> GMB Everywhere does not use paid Google APIs for its main competitor features. 

There are two separate questions here.

### Question A

Could GMB Everywhere obtain competitor data without Google's official Places/Business Profile API?

**Absolutely.**

### Question B

Have we established that GMB Everywhere actually does so?

**No.**

That's the distinction.

---

# 8. The Google Business Profile API claim is particularly questionable

The pasted material says tools can use GBP API for:

- competitor reviews
- coordinates
- claimed status
- CID/Knowledge Panel IDs



### KILLCRITIC

This is a dangerous generalization.

The **Google Business Profile APIs are primarily designed around authorized business management**, not simply "give me all public competitor GBP data."

So we should not design Rother around the assumption:

```text
Competitor
    ↓
GBP API
    ↓
all competitor data
```

That is not a safe architectural assumption.

---

# 9. "The data is public, therefore scraping is legal"

This is another statement I would reject.

The AI answer says essentially:

> because Google sent the information to your browser and it is public, extracting it is legal. 

### Verdict

🔴 **Overstated.**

Publicly visible information does **not automatically mean unrestricted scraping is legally permitted**.

There are separate considerations including:

- Google's terms
- applicable laws
- automated access restrictions
- copyright/database rights depending on jurisdiction
- privacy
- rate limits
- authentication/access controls
- how the data is used

So Rother's documentation should never say:

> "It's legal because it's public."

Instead:

> "The system should access only information legitimately available through the user's browser/session and comply with applicable Google terms, laws, and technical restrictions."

---

# 10. "Category is hidden, but Google sends it to browser"

### Verdict

🟢/🟡 **The underlying concept is reasonable, but wording needs correction.**

The word **"hidden"** is doing too much work.

There are at least three different meanings:

### Hidden from the normal UI

```text
Google UI
  ↓
doesn't display secondary category
```

### Present somewhere in application/network data

```text
browser
  ↓
data may contain category information
```

### Not exposed at all

```text
browser
  ↓
no category data
```

GMB Everywhere clearly demonstrates that it can expose category information that ordinary Maps users don't see directly.

But that does **not prove exactly where the extension obtains it**.

---

# 11. Your `Ctrl+U` Crate Cafe experiment was actually important

You asked why:

> `Ctrl+U → Ctrl+F "category"` doesn't find anything.

That doesn't disprove the possibility of the data being available to the browser.

It demonstrates:

```text
VIEW SOURCE
     ≠
LIVE GOOGLE MAPS APPLICATION DATA
```

A more useful investigation is:

```text
Google Maps
     ↓
Open DevTools
     ↓
Network
     ↓
reload/open business
     ↓
inspect Fetch/XHR/other requests
     ↓
inspect responses
```

**That would tell us considerably more about what Google actually sends to the browser.**

And importantly, it would still **not automatically tell us how GMB Everywhere obtains it**.

To answer *that*, we'd need to inspect GMB Everywhere itself, its extension package/code and its network behavior.

---

# 12. Here's the corrected version of the AI Mode explanation

I would replace the Google AI Mode explanation with this:

> **GMB Everywhere is a Chrome extension that operates within Google Maps/Search and can expose information that Google does not present directly in the normal visual interface. Google Maps is a dynamic application, so the information available to the browser can come from dynamically loaded application/network data rather than the initial HTML shown by View Source.**
>
> **It is therefore technically possible for an extension to obtain information that cannot be found with Ctrl+U. However, without inspecting GMB Everywhere's implementation or observing its network behavior, we cannot establish whether it specifically uses DOM extraction, application state, network-response processing, its own backend, Google APIs, or a combination of these techniques.**
>
> **Likewise, claims that GMB Everywhere operates its own scraping servers, uses browser automation and proxies, or uses a particular Google API should be treated as unverified unless supported by direct evidence.**

That is the version I would trust for our project.

---

# 13. What this means for Rother

This actually changes something important in our earlier discussion.

We shouldn't start with:

> "How does GMB Everywhere's server work?"

We should start with:

> **"What data can a browser legitimately observe when Google Maps loads a business, and what can our extension extract from that data?"**

Then experimentally determine:

```text
                    GOOGLE MAPS
                         │
             ┌───────────┼────────────┐
             │           │            │
             ▼           ▼            ▼
          HTML/DOM    Network      App State
             │           │            │
             └───────────┼────────────┘
                         ▼
                  ROTHER EXTRACTOR
                         │
                         ▼
                  Normalized GBP
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
        Categories     Reviews      Services
            │            │            │
            └────────────┼────────────┘
                         ▼
                    Local analysis
```

Only **after that** should we decide whether a backend is necessary.

---

# 14. My final fact-check score

| Google AI Mode claim | Verdict |
|---|---|
| GMB Everywhere is a Chrome extension | 🟢 Confirmed |
| It exposes competitor categories | 🟢 Confirmed |
| It can expose information not normally shown in Maps | 🟢 Strongly supported |
| `Ctrl+U` contains all extractable Maps data | 🔴 Wrong |
| Maps dynamically loads data | 🟢 Correct |
| GMB Everywhere specifically intercepts XHR/Fetch | 🟡 Unverified |
| GMB Everywhere uses its own scraping servers | 🔴 Unverified |
| GMB Everywhere uses browser automation on its servers | 🔴 Unverified |
| GMB Everywhere uses proxies for Geo-Grid | 🔴 Unverified |
| Geo-Grid requires their server | 🔴 Unverified |
| GMB Everywhere doesn't use Google APIs | 🟡 Unverified |
| Competitor data can be obtained without official Google APIs | 🟢 Technically possible |
| Public data automatically makes scraping legal | 🔴 Incorrect/overstated |
| Historical features require persistent storage somewhere | 🟢 Correct |
| Persistent storage necessarily means a remote server | 🔴 Incorrect |

## The most important conclusion

**Your Google AI Mode research is useful, but its strongest technical claims about GMB Everywhere's internal architecture should not be treated as facts.**

In particular, I would currently mark:

**"GMB Everywhere has a backend" = plausible, but not established feature-by-feature.**

**"GMB Everywhere uses its backend for Geo-Grid" = unverified.**

**"GMB Everywhere uses proxies/browser automation" = unverified.**

**"GMB Everywhere intercepts XHR/Fetch" = unverified.**

**"GMB Everywhere reads data available to the browser that isn't present in Ctrl+U" = technically very plausible and consistent with what the product demonstrably does.**

And this is actually a **good place to stop theorizing and perform an experiment**. If our goal is to rebuild Rother intelligently, the next high-value investigation is to determine **exactly what Google Maps sends to the browser for a business profile, where the category/review/service data lives, and whether that data is accessible to a Chrome extension without any Rother server**. That would give us evidence rather than guesses.

---

# you asked

message time: 2026-09-05 14:25:49

/PITFALLS /KILLCRITIC then in technicality, can you tell me again how all of the features works in gmbeverywhere?

---

# chatgpt response

Yes. This time I’ll describe **the technical operation of each GMB Everywhere feature**, but I’ll keep the `/KILLCRITIC` distinction we established:

- **🟢 Confirmed behavior**: GMB Everywhere publicly documents that the feature does this.
- **🔵 Technical mechanism we can reasonably infer**: how such a feature can work technically.
- **🟡 Implementation unknown**: GMB Everywhere has not publicly established exactly how its extension/backend implements it.
- **🔴 Do not assume**: claims about private servers, proxies, APIs, etc. without direct evidence.

The goal is not to pretend we know GMB Everywhere's source code. The goal is to understand **what a GMB Everywhere-like system technically has to do**.

---

# 1. The overall GMB Everywhere architecture

At a high level, think of it as:

```text
                         GOOGLE
                           │
                           ▼
                  Google Maps / Search
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
        Browser page              Google data
        / application             available to
              │                    the browser
              └──────────┬────────────┘
                         ▼
                GMB EVERYWHERE
                 Chrome Extension
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
     Extract          Analyze          Request
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                       UI
```

For some features, there can additionally be:

```text
Extension
    │
    ▼
GMB Everywhere backend
    │
    ├── persistent data
    ├── account/subscription
    ├── external services
    └── AI
```

**Whether GMB Everywhere actually uses the backend for a particular feature is not publicly established.**

---

# 2. Basic Audit

## What the user sees

You open a business in Google Maps and launch:

> **Basic Audit**

It produces a detailed profile analysis.

GMB Everywhere advertises information such as:

- Business information
- Place ID
- CID
- Knowledge ID
- Categories
- Services
- Attributes
- GBP links
- Coordinates
- other GBP information

### Technical operation

Conceptually:

```text
Google Maps business
        │
        ▼
Identify current GBP
        │
        ▼
Extract available information
        │
        ├── name
        ├── address
        ├── phone
        ├── categories
        ├── services
        ├── attributes
        ├── coordinates
        ├── IDs
        └── links
        │
        ▼
Normalize
        │
        ▼
Audit UI
```

### Where does the information come from?

This is the important part.

It might come from:

```text
DOM
```

or:

```text
Google Maps application state
```

or:

```text
network/application responses
```

or some combination.

**We don't know GMB Everywhere's exact mechanism.**

### Server requirement

🟢 **Not inherently required.**

You can build a Basic Audit entirely as a browser extension if the required data is accessible to the browser.

---

# 3. Review Audit

This is much more than simply showing reviews.

It can analyze:

- review counts
- ratings
- review text
- dates
- keywords
- trends
- filtering

GMB Everywhere specifically advertises review keyword searching and filtering. 

### Technical pipeline

```text
GBP
 │
 ▼
Load reviews
 │
 ▼
Extract review records
 │
 ├── reviewer
 ├── rating
 ├── text
 ├── date
 └── review identifier
 │
 ▼
Normalize
 │
 ▼
Analysis engine
 │
 ├── rating distribution
 ├── keyword frequency
 ├── date filtering
 ├── rating filtering
 └── text search
 │
 ▼
Review Audit UI
```

### Keyword analysis

A simple implementation could be:

```text
Review 1:
"Great staff and excellent location"

Review 2:
"Friendly staff"

Review 3:
"Great location"
```

Normalize:

```text
great
staff
excellent
location
friendly
```

Count:

```text
staff       2
great       2
location    2
excellent   1
friendly    1
```

Then expose:

```text
staff (2)
great (2)
location (2)
```

### Server?

Current reviews:

🟢 **No server inherently required.**

Historical trends:

```text
Day 1 → 400 reviews
Day 7 → 407 reviews
Day 14 → 415 reviews
```

requires persistence.

That persistence could be:

```text
IndexedDB
```

rather than a server.

So:

> **Review Audit itself does not inherently require a server.**

---

# 4. Review historical analysis

This deserves its own section because it is where people commonly misunderstand the architecture.

Suppose:

```text
June 1
rating = 4.6
reviews = 400
```

Then:

```text
July 1
rating = 4.5
reviews = 437
```

To calculate:

```text
+37 reviews
-0.1 rating
```

you need the June snapshot.

That can be:

### Local

```text
Extension
    ↓
IndexedDB
    ↓
history
```

or:

### Cloud

```text
Extension
    ↓
API
    ↓
Database
```

So **historical data ≠ automatically server data**.

---

# 5. Review filtering

This is straightforward.

```text
ALL REVIEWS
     │
     ├── 5★
     ├── 4★
     ├── 3★
     ├── 2★
     └── 1★
```

And:

```text
ALL REVIEWS
     │
     ├── keyword
     ├── date
     └── rating
```

Technically:

```javascript
reviews
  .filter(...)
  .filter(...)
  .filter(...)
```

No server required.

---

# 6. Local Scan

This is essentially:

> **Extract several GBP profiles and normalize them into a comparison table.**

GMB Everywhere's Local Scan compares:

- categories
- services
- reviews
- location
- open times
- attributes



### Technical pipeline

```text
Google Maps search
        │
        ▼
Find businesses
        │
        ├── Business A
        ├── Business B
        ├── Business C
        ├── Business D
        └── Business E
                 │
                 ▼
           Extract profiles
                 │
                 ▼
             Normalize
                 │
                 ▼
             Compare
```

For example:

```text
Business       Reviews   Rating   Categories

You              243      4.6       3
Competitor A     581      4.8       5
Competitor B     392      4.7       4
```

### Category comparison

Convert:

```text
You:
{dentist, cosmetic dentist}

A:
{dentist, cosmetic dentist, orthodontist}

B:
{dentist, pediatric dentist}
```

into:

```text
Category              You    A    B

Dentist                ✓     ✓    ✓
Cosmetic Dentist       ✓     ✓    -
Orthodontist           -     ✓    -
Pediatric Dentist      -     -    ✓
```

### Server?

🟢 **Not inherently required.**

This can be browser-side computation.

---

# 7. Local Scan, services

Same algorithm.

```text
Business
   ↓
services[]
   ↓
normalize names
   ↓
set comparison
```

Then:

```text
Service          You    A    B

Implants          ✓     ✓    -
Braces            -     ✓    ✓
Whitening         ✓     ✓    ✓
```

No server is inherently necessary.

---

# 8. Local Scan, reviews

The system can simply compare:

```text
review_count
average_rating
rating_distribution
```

For example:

```text
             Rating     Reviews

You            4.6        243
A              4.8        581
B              4.7        392
```

Again:

🟢 **Local computation is sufficient.**

---

# 9. Local Scan, location

This is essentially a geographic calculation.

If you know:

```text
Your coordinates:
lat1, lon1

Competitor:
lat2, lon2
```

calculate distance.

Conceptually:

```text
                Competitor
                    ●
                    │
                    │ distance
                    │
                    ● You
```

The system can use geographic distance formulas such as Haversine.

No server is inherently necessary **once coordinates are known**.

---

# 10. Local Scan, opening hours

Extract:

```text
Monday:
09:00–18:00

Tuesday:
09:00–18:00
```

for every business and normalize them.

Then compare:

```text
             Mon       Tue

You          09-18     09-18
A            08-20     08-20
B            10-18     10-18
```

Again:

🟢 Local computation.

---

# 11. Local Scan, attributes

Extract:

```text
attributes[]
```

then set-comparison:

```text
Attribute             You    A    B

Wheelchair accessible  ✓     ✓    -
Online appointments    ✓     -    ✓
Outdoor seating        -     ✓    -
```

No server inherently required.

---

# 12. Teleport / Rank Check

This is significantly more complicated.

Its purpose is:

> **Determine a business's local search position from a specified location.**

Conceptually:

```text
Keyword:
"dentist"

Location:
Jakarta

       ↓

Google Maps search

       ↓

1. Business A
2. Business B
3. Business C
4. YOUR BUSINESS
```

Result:

```text
Rank = #4
```

---

# 13. Teleport with multiple locations

Now imagine:

```text
        ●────●────●
        │    │    │
        ●────●────●
        │    │    │
        ●────●────●
```

Each point is a search location.

You get:

```text
Location       Rank

Point 1          3
Point 2          5
Point 3          8
Point 4          2
Point 5          4
...
```

Then render:

```text
3  5  8
2  4  7
1  2  5
```

### The critical unknown

How does GMB Everywhere actually execute those searches?

Possibilities include:

```text
Browser
 ↓
Google Maps
 ↓
search location
```

or:

```text
Extension
 ↓
GMB backend
 ↓
remote execution
 ↓
Google
```

or hybrid.

**We do not have sufficient evidence to say which one GMB Everywhere uses.**

So:

🟡 **Function confirmed**

🔴 **Private implementation unconfirmed**

---

# 14. Category Finder

The basic idea is:

> Given a business/category, identify potentially relevant categories.

Technically:

```text
Current category
       ↓
candidate category dataset
       ↓
matching
       ↓
rank/relevance
       ↓
suggestions
```

For example:

```text
Current:
Dentist

Possible:
Cosmetic Dentist
Pediatric Dentist
Orthodontist
Dental Clinic
```

The candidate dataset could be:

```text
local database
```

or:

```text
remote database/API
```

or:

```text
Google-derived data
```

or a combination.

Therefore:

🟢 **Feature can technically be serverless**

🟡 **GMB Everywhere's actual implementation unknown**

---

# 15. Service Finder

Same fundamental architecture:

```text
Category
   ↓
Relevant services
   ↓
Suggestions
```

Then potentially:

```text
Your services
      +
competitor services
      ↓
service gaps
```

For example:

```text
Competitors:
Implants
Braces
Whitening
Invisalign

You:
Implants
Whitening

Gap:
Braces
Invisalign
```

This is very easy to implement locally **if the necessary dataset is available locally**.

---

# 16. Post Audit

Post Audit works conceptually like Review Audit, except the object is GBP posts.

```text
GBP
 ↓
Posts
 ↓
extract
 ↓
normalize
 ↓
analyze
```

Potential record:

```text
Post
 ├── date
 ├── text
 ├── media
 ├── link
 ├── post type
 └── other metadata
```

Then:

```text
Post count
Posting frequency
Character counts
Media usage
Links
Timeline
```

---

# 17. Post timeline

Suppose:

```text
January:
3 posts

February:
8 posts

March:
2 posts

April:
10 posts
```

Render:

```text
Jan ███
Feb ████████
Mar ██
Apr ██████████
```

This is just data visualization.

No server inherently required.

---

# 18. Website Audit

This is a different data source.

Instead of:

```text
Google Maps
```

you have:

```text
GBP
 ↓
website URL
 ↓
website
 ↓
HTML
 ↓
analysis
```

Potential checks:

```text
Business name
Address
Phone
Hours
Categories
Services
Schema
NAP consistency
```

Technically:

```text
fetch()
 ↓
HTML
 ↓
DOM parser
 ↓
extract
 ↓
rules
 ↓
audit
```

### Important browser limitation

A Chrome extension cannot necessarily fetch every website freely because of:

- CORS
- CSP
- authentication
- robots/access controls
- browser security policies

So while the **analysis itself doesn't inherently require a server**, a server can make website fetching easier.

Therefore:

🟢 **Conceptually serverless**

🟡 **Practical implementation may benefit from backend infrastructure**

---

# 19. Google Ads detection

Conceptually:

```text
Business
 ↓
Google search ecosystem
 ↓
detect advertising presence
 ↓
result
```

The exact GMB Everywhere mechanism is not publicly established.

So:

🟡 **Feature exists**

🟡 **Implementation unknown**

Don't assume:

> "They scrape Google's Ads API."

And don't assume:

> "They inspect XHR."

We need evidence before either statement.

---

# 20. AI Post Generator

Now the architecture changes.

```text
GBP information
      +
user instructions
      ↓
prompt
      ↓
AI model
      ↓
generated post
```

Potential architecture:

```text
Extension
    ↓
backend
    ↓
AI provider
    ↓
response
    ↓
extension
```

Could technically be local AI, but for a commercial extension the conventional architecture is remote inference.

So:

🔴 **Treat as backend/external-service dependent.**

---

# 21. AI Review Response Generator

```text
Review
  +
business context
  ↓
prompt
  ↓
AI
  ↓
response
```

Example:

```text
Review:
"Great staff but parking was difficult."

       ↓

AI

       ↓

"Thank you for your feedback..."
```

The extension supplies context.

The AI service generates the text.

Again:

🔴 **Not a simple browser extraction feature.**

---

# 22. AI Description Generator

Same pattern:

```text
GBP data
 +
business information
 ↓
prompt
 ↓
AI
 ↓
description
```

---

# 23. AI Q&A Generator

```text
GBP
 ↓
business information
 ↓
AI
 ↓
potential customer questions
 ↓
answers
```

Again:

🔴 AI service.

---

# 24. AI Facebook Post Generator

Same:

```text
GBP/business data
       ↓
prompt
       ↓
AI
       ↓
Facebook copy
```

---

# 25. AI Category Finder

This is different from ordinary Category Finder.

Normal:

```text
dataset
 ↓
matching
 ↓
categories
```

AI:

```text
business context
 ↓
LLM
 ↓
category suggestions
```

So:

🟢 Normal algorithm can be local.

🔴 AI version requires inference somewhere.

---

# 26. AI Service Finder

Same distinction:

```text
RULE/DATA BASED
category
 ↓
service database
 ↓
services
```

versus:

```text
AI
business context
 ↓
LLM
 ↓
suggested services
```

Don't mix the two.

---

# 27. GBP Image Generator

This is straightforward:

```text
User prompt
      +
business context
      ↓
image model
      ↓
generated image
```

This requires substantial computation.

So:

🔴 **Treat as external/cloud inference unless there is explicit evidence of a local model.**

---

# 28. AI Visibility Checker

This is arguably the most technically different feature.

The goal is essentially:

> **Determine how AI/search systems respond when asked about a business/category.**

Conceptually:

```text
Business
   +
query
   ↓
AI/search system
   ↓
response
   ↓
analyze mentions
   ↓
visibility result
```

For example:

```text
Query:
"best dentists in Jakarta"

AI response:

1. Clinic A
2. Clinic B
3. Clinic C

Your business:
NOT MENTIONED
```

Then potentially:

```text
AI Visibility = 0%
```

or some other proprietary score.

This is not merely Google Maps scraping.

It requires interaction with another information system.

🔴 **Backend/external-system territory.**

---

# 29. So let's separate GMB Everywhere's FEATURES from its IMPLEMENTATION

This is the most important table.

| Feature | Data acquisition | Local processing possible? | Persistent storage? | External service potentially needed? |
|---|---|---:|---:|---:|
| Basic Audit | Google Maps | ✅ | ❌ | ❌ |
| Review Audit | Google Maps | ✅ | ❌ | ❌ |
| Review historical trends | Google Maps | ✅ | ✅ | ❌ |
| Local Scan | Google Maps | ✅ | ❌ | ❌ |
| Category Finder | Google/other dataset | ✅ | ❌ | 🟡 |
| Service Finder | Google/other dataset | ✅ | ❌ | 🟡 |
| Post Audit | Google Maps | ✅ | ❌ | ❌ |
| Post history | Google Maps | ✅ | ✅ | ❌ |
| Website Audit | Website | ✅ | ❌ | 🟡 |
| Teleport | Google Maps/search | 🟡 | ❌ | 🟡 |
| Geo-grid history | Google Maps/search | 🟡 | ✅ | 🟡 |
| Google Ads detection | Google ecosystem | 🟡 | ❌ | 🟡 |
| AI Post Generator | AI | ❌* | ❌ | 🔴 |
| AI Review Response | AI | ❌* | ❌ | 🔴 |
| AI Description | AI | ❌* | ❌ | 🔴 |
| AI Q&A | AI | ❌* | ❌ | 🔴 |
| AI Facebook Post | AI | ❌* | ❌ | 🔴 |
| AI Category Finder | AI | ❌* | ❌ | 🔴 |
| AI Service Finder | AI | ❌* | ❌ | 🔴 |
| Image Generator | Image AI | ❌* | ❌ | 🔴 |
| AI Visibility | External AI/search | ❌ | potentially | 🔴 |

\*A local model is theoretically possible, but that's a different architecture.

---

# 30. Now compare that with Rother

This is where I think the discussion becomes much more useful.

Our Rother architecture is currently:

```text
                 GOOGLE MAPS
                     │
                     ▼
                 Playwright
                     │
                     ▼
                    HTML
                     │
                     ▼
                   Parser
                     │
                     ▼
             Structured Reviews
                     │
                     ▼
                 Snapshots
                     │
                     ▼
                Delta Detection
                     │
                     ▼
                Monitoring
```

That is fundamentally targeting:

> **automated data acquisition + historical monitoring**

rather than:

> **interactive browser auditing**



---

# 31. If we wanted to build a GMB Everywhere-like Rother

I would **not** immediately copy their presumed architecture.

I'd build the layers independently:

```text
┌──────────────────────────────────────────────┐
│                 DATA SOURCE                  │
│                                              │
│ Google Maps / Search                         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                 EXTRACTOR                   │
│                                              │
│ DOM / application data / available responses │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              NORMALIZATION                   │
│                                              │
│ GBPRecord                                    │
│ ReviewRecord                                 │
│ PostRecord                                   │
│ CompetitorRecord                             │
└──────────────────────┬───────────────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
┌──────────────────────┐ ┌──────────────────────┐
│ LOCAL ANALYSIS       │ │ PERSISTENCE          │
│                      │ │                      │
│ filters              │ │ snapshots            │
│ comparisons          │ │ history               │
│ statistics           │ │ deltas                │
│ keyword analysis     │ │ monitoring             │
└──────────────────────┘ └──────────────────────┘
             │                   │
             └─────────┬─────────┘
                       ▼
                 DASHBOARD/UI
```

Then **only add a backend when a requirement actually demands it**.

---

# 32. The most important architectural insight

GMB Everywhere-like functionality can be divided into:

### Layer 1, extraction

```text
Google
 ↓
Get data
```

### Layer 2, normalization

```text
raw data
 ↓
structured GBP records
```

### Layer 3, analysis

```text
structured data
 ↓
comparisons/statistics
```

### Layer 4, persistence

```text
data
 ↓
history
```

### Layer 5, monitoring

```text
repeat collection
 ↓
change detection
```

### Layer 6, cloud

```text
multiple users
multiple clients
shared database
scheduled jobs
```

### Layer 7, AI

```text
data
 ↓
AI model
```

---

# 33. KILLCRITIC: the dangerous misconception

The biggest misconception from the Google AI Mode material is:

> **"If GMB Everywhere can do it, it must be using a server."**

No.

The correct question is:

> **Does the operation inherently require remote computation or persistent/shared state?**

For example:

### Basic Audit

```text
extract → analyze → display
```

No server inherently required.

### Local Scan

```text
extract A/B/C → normalize → compare
```

No server inherently required.

### Review filtering

```text
reviews → filter
```

No server.

### Keyword analysis

```text
reviews → tokenize → count
```

No server.

### Historical monitoring

```text
today → save
tomorrow → save
compare
```

Persistence required, **but not necessarily a server**.

### Multi-client monitoring

```text
Client A
Client B
Client C
     ↓
central database
```

Now a backend becomes strongly justified.

### AI

```text
data → model → result
```

Remote/external inference is normally required.

---

# 34. And this changes how I would approach Rother

I would **not restart Rother by building a server first**.

I would first prove:

```text
                 GOOGLE MAPS
                      │
                      ▼
              Browser/Playwright
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
      DOM        Network data    App state
        │             │             │
        └─────────────┼─────────────┘
                      ▼
                 RAW RECORD
                      │
                      ▼
                  PARSER
                      │
                      ▼
             NORMALIZED GBP DATA
```

Then test:

**Can we obtain the information we need entirely from the browser/session?**

If yes, then:

```text
                NO SERVER
                   │
                   ▼
       extraction + analysis
                   │
                   ▼
            local persistence
```

can give us a very powerful first version.

Only afterward:

```text
             NEED MULTIPLE CLIENTS?
                     │
                    YES
                     ▼
                  BACKEND
```

---

## My current confidence map

**High confidence:**

- GMB Everywhere performs substantial analysis directly around Google Maps/Search.
- Basic audit, filtering, comparisons, and similar calculations do not inherently require a server.
- Historical functionality requires persistence somewhere.
- AI functionality requires model inference somewhere.
- `Ctrl+U` is not an adequate representation of everything a dynamic Google Maps application makes available to the browser.

**Medium confidence:**

- Some GMB Everywhere functionality may use backend processing.
- Teleport/rank tracking may benefit substantially from backend infrastructure.
- Some datasets used by category/service intelligence may be remote.

**Low confidence / do not treat as fact:**

- GMB Everywhere uses its own scraping servers for specific features.
- GMB Everywhere uses Playwright/Puppeteer internally.
- GMB Everywhere uses residential proxies.
- GMB Everywhere specifically intercepts XHR/Fetch.
- GMB Everywhere avoids all Google APIs.
- A particular feature is definitely processed on their server.

Those last claims require **direct technical evidence**, not inference from what the feature does.

And for our project, that distinction is crucial: **we should first reverse-engineer the data-access problem experimentally, not reverse-engineer an imaginary GMB Everywhere backend.**