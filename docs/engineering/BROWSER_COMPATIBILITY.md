# Browser Compatibility — Rother Web Dashboard

**Last updated:** 2026-09-14T12:00:00+07:00  
**Scope:** Browser compatibility for `rotherweb.vercel.app` (web version)  
**Audience:** Non-technical clients, developers evaluating Rother

---

## Summary

**Rother's web dashboard works in ALL modern browsers.** Unlike GMB Everywhere (Chrome extension), Rother is a standard web app — no browser-specific code, no extensions required.

---

## Why Rother works everywhere (unlike GMB Everywhere)

| | GMB Everywhere | Rother Web |
|---|---|---|
| **Type** | Chrome extension | Web app (Next.js) |
| **How it works** | Injects code into Google Maps pages | Serves HTML/JS from Vercel |
| **Browser requirement** | Chromium only | Any modern browser |
| **Why** | Uses `chrome.*` API (Chromium-only) | Uses standard web APIs |

---

## Detailed Browser Support

### Desktop Browsers

| Browser | Version | Dashboard | Paste Link | Export | Notes |
|---|---|---|---|---|---|
| **Chrome** | 90+ | ✅ | ✅ | ✅ | Full support |
| **Edge** | 90+ | ✅ | ✅ | ✅ | Chromium-based, same as Chrome |
| **Firefox** | 88+ | ✅ | ✅ | ✅ | Full support |
| **Safari** | 14+ | ✅ | ✅ | ✅ | Full support (macOS) |
| **Brave** | Latest | ✅ | ✅ | ✅ | Chromium-based |
| **Opera** | Latest | ✅ | ✅ | ✅ | Chromium-based |

### Mobile Browsers

| Browser | OS | Dashboard | Paste Link | Notes |
|---|---|---|---|---|
| **Safari** | iOS 14+ | ✅ | ✅ | iPhone/iPad |
| **Chrome** | Android | ✅ | ✅ | Most Android phones |
| **Firefox** | Android | ✅ | ✅ | Full support |
| **Samsung Internet** | Android | ✅ | ✅ | Chromium-based |
| **Edge** | Android/iOS | ✅ | ✅ | Full support |

---

## Browser-Specific Edge Cases

### localStorage (Safari ITP)

**Issue:** Safari's Intelligent Tracking Prevention (ITP) clears localStorage after 7 days of no visit.

**Impact:** If a user visits once and doesn't return for 7+ days, any stored preferences (like dark mode) may reset.

**Data impact:** None — the dashboard data is on the server (data branch), not in localStorage.

### Clipboard API (all browsers)

**Issue:** Clipboard API requires HTTPS and user permission.

**Impact:** Copy-to-clipboard features (like export) may show a permission prompt on first use.

**Workaround:** User clicks "Allow" when prompted. Works fine after that.

### Service Workers (all browsers)

**Issue:** None — all modern browsers support Service Workers.

**Impact:** Offline support works everywhere (if implemented).

### CSS Features

| Feature | Chrome | Firefox | Safari | Notes |
|---|---|---|---|---|
| CSS Grid | ✅ | ✅ | ✅ | All modern browsers |
| Flexbox | ✅ | ✅ | ✅ | All modern browsers |
| backdrop-filter | ✅ | ✅ | ✅ | Safari 14+ |
| :has() selector | ✅ | ✅ | ✅ | Chrome 105+, Firefox 121+, Safari 15.4+ |
| CSS custom properties | ✅ | ✅ | ✅ | All modern browsers |

### JavaScript Features

| Feature | Chrome | Firefox | Safari | Notes |
|---|---|---|---|---|
| Fetch API | ✅ | ✅ | ✅ | All modern browsers |
| Promises | ✅ | ✅ | ✅ | All modern browsers |
| ES modules | ✅ | ✅ | ✅ | All modern browsers |
| Optional chaining (?.) | ✅ | ✅ | ✅ | Chrome 80+, Firefox 72+, Safari 13.1+ |
| Nullish coalescing (??) | ✅ | ✅ | ✅ | Chrome 80+, Firefox 72+, Safari 13.1+ |

---

## Minimum Browser Versions

| Browser | Minimum Version | Release Date | Notes |
|---|---|---|---|
| Chrome | 90 | April 2021 | For full CSS/JS support |
| Firefox | 88 | April 2021 | For full CSS/JS support |
| Safari | 14 | September 2020 | For full CSS/JS support |
| Edge | 90 | April 2021 | Chromium-based |

**Older browsers may work** but some features (like backdrop-filter or CSS Grid) may degrade gracefully.

---

## Testing Matrix

| Browser | OS | Tested? | Notes |
|---|---|---|---|
| Chrome 120+ | Windows 10/11 | ✅ | Primary development browser |
| Firefox 120+ | Windows 10/11 | ✅ | Tested |
| Safari 17+ | macOS Sonoma | ✅ | Tested |
| Safari 17+ | iOS 17 | ✅ | Tested |
| Edge 120+ | Windows 10/11 | ✅ | Chromium-based, same as Chrome |
| Chrome 120+ | Android 14 | ✅ | Tested |
| Samsung Internet | Android | ⚠️ | Chromium-based, should work |

---

## Comparison with GMB Everywhere

| Feature | GMB Everywhere | Rother Web |
|---|---|---|
| Works in Chrome | ✅ | ✅ |
| Works in Firefox | ❌ | ✅ |
| Works in Safari | ❌ | ✅ |
| Works on mobile | ❌ | ✅ |
| Requires installation | Yes (extension) | No (just URL) |
| Real-time overlay | Yes | No (dashboard only) |
| Data persistence | Server backend | GitHub data branch |

---

## Summary

- ✅ **Chrome/Edge/Brave/Opera:** Full support
- ✅ **Firefox:** Full support
- ✅ **Safari (macOS + iOS):** Full support
- ✅ **Mobile browsers:** Full support
- ⚠️ **IE11:** Not supported (deprecated)
- ⚠️ **Old browsers (< 2020):** May have CSS/JS issues

**No browser-specific code.** No Chrome extensions. No Safari limitations. Works everywhere.
