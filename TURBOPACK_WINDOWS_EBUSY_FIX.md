# Turbopack Windows EBUSY Error - Fix & Prevention

**Last updated:** 2026-08-22  
**Issue:** `EBUSY: resource busy or locked` on `.next/dev/types/validator.ts` (and similar files)  
**Environment:** Windows + Next.js 16 + Turbopack

---

## Problem

```
Error: EBUSY: resource busy or locked, open 'D:\...\next\dev\types\validator.ts'
  at ignore-listed frames {
    errno: -4082,
    code: 'EBUSY',
    syscall: 'open',
    path: 'D:\\...\next\dev\types\validator.ts'
  }
```

The Next.js dev server fails to start because Turbopack holds file locks on `.next/dev/types/` that weren't released from a previous run.

---

## Root Cause

| Factor | Details |
|--------|---------|
| **Turbopack** | Holds file locks on `.next/dev/types/` during hot reload for type-checking |
| **Windows file locking** | Locks persist if process is killed ungracefully (Ctrl+C, crash, forced kill) |
| **Turbopack caching** | Locks aren't always released on process exit on Windows |

This is a **known Turbopack/Windows issue**, not a bug in your code.

---

## Quick Fix (Run When Error Occurs)

```powershell
# 1. Kill all Node processes
taskkill /F /IM node.exe

# 2. Remove the .next cache
Remove-Item -Recurse -Force .next

# 3. Restart dev server
npm run dev
```

**One-liner:**
```powershell
taskkill /F /IM node.exe 2>$null; Remove-Item -Recurse -Force .next 2>$null; npm run dev
```

---

## Prevention: Add Clean Script to package.json

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "dev:clean": "cmd /c \"taskkill /F /IM node.exe 2>nul & rmdir /s /q .next 2>nul\" && npm run dev",
    "dev:force": "cmd /c \"taskkill /F /IM node.exe 2>nul & rmdir /s /q .next 2>nul\" && npm run dev"
  }
}
```

Then use:
```bash
npm run dev:clean    # Clean start every time
npm run dev:force    # Force clean + start (alias)
```

---

## Alternative: Disable Turbopack (If Persistent)

In `next.config.ts`:
```typescript
const nextConfig = {
  // Disable Turbopack for dev (uses Webpack instead)
  turbo: {
    // Disable for dev only
    ...process.env.NODE_ENV === 'development' && { enabled: false }
  },
  // Or completely disable
  experimental: {
    turbo: false,
  },
};
```

**Trade-off:** Webpack is slower on initial compile but avoids Windows file locking issues.

---

## Root Cause Deep Dive

| Component | Behavior |
|-----------|----------|
| **Turbopack** | Watches `.next/dev/types/` for TypeScript type changes; holds exclusive locks |
| **Windows** | Mandatory file locking (not advisory like Linux); locks survive process death |
| **Next.js** | Doesn't always clean up locks on `SIGINT`/`SIGTERM` on Windows |

**Affected files:** `.next/dev/types/validator.ts`, `.next/dev/types/*.ts`, `.next/cache/`

---

## When This Happens Most

| Scenario | Likelihood |
|-----------|------------|
| Ctrl+C to stop dev server | High |
| Terminal closed without `npm run dev` exiting cleanly | High |
| System sleep/hibernate with dev server running | Medium |
| Multiple `npm run dev` in different terminals | High |

---

## Permanent Fix (If Recurring)

### Option 1: Use `dev:clean` Always
```bash
npm run dev:clean
```

### Option 2: Disable Turbopack for Dev
```typescript
// next.config.ts
export default {
  experimental: {
    turbo: process.env.NODE_ENV === 'production', // Only in production
  },
};
```

### Option 3: Use Webpack Explicitly
```typescript
// next.config.ts
export default {
  webpack: (config) => config,
  experimental: {
    turbo: false,
  },
};
```

---

## Verification Checklist After Fix

```bash
# 1. All node processes killed
tasklist | findstr node

# 2. .next directory removed
dir .next 2>nul && echo "STILL EXISTS" || echo "CLEANED"

# 3. Dev server starts cleanly
npm run dev
# Should show: ✓ Ready in Xs (no EBUSY errors)
```

---

## Related Files

| File | Purpose |
|------|---------|
| `package.json` | Add `dev:clean` script |
| `next.config.ts` | Disable Turbopack if needed |
| `.gitignore` | Ensure `.next/` is ignored |

---

## References

- [Next.js Turbopack Issues](https://github.com/vercel/next.js/issues?q=turbopack+windows+EBUSY)
- [Turbopack Windows File Locking](https://github.com/vercel/turbopack/issues?q=windows+lock)
- [Next.js Middleware Deprecation](https://nextjs.org/docs/messages/middleware-to-proxy) (unrelated warning)

---

## Summary

| Action | Command |
|--------|---------|
| **Immediate fix** | `taskkill /F /IM node.exe && rmdir /s /q .next && npm run dev` |
| **Prevention** | Add `dev:clean` script to `package.json` |
| **Nuclear option** | Disable Turbopack in `next.config.ts` |

**This is a Windows/Turbopack limitation, not a code bug.** The fix is operational, not code-based.