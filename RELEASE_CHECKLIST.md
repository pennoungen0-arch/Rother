# Rother — Pre-Release Checklist

**Last updated:** 2026-08-27
**Run before every release commit. Current expected: vitest 119/119, Playwright 20/20.**

---

## 1. Secrets scan

```powershell
git grep -E "(api[_-]?key|secret|password|token).*=" -- "*.json" "*.py" "*.ts" "*.tsx" | Select-String -NotMatch "example"
```

Expected: Zero matches outside example files.

## 2. Data discipline

```powershell
git check-ignore gbp-monitor/data/run_summary.json
```

Expected: No output (file must NOT be ignored).

## 3. Dead code

```powershell
npx tsprune
python -m vulture gbp-monitor/
```

Expected: Zero or acceptable unused items.

## 4. Dependency vulnerabilities

```powershell
npm audit
python -m pip_audit
```

Expected: Zero critical vulnerabilities.

## 5. Test suite

```powershell
npx tsc --noEmit
npx vitest run
npx eslint src
npm run build
```

Expected: 0 errors, 0 warnings, 119/119 vitest pass.

```powershell
npx playwright test
```

Expected: 20/20 pass. **Note:** Needs `npm run dev` running.

```powershell
cd gbp-monitor
python -m tests.verify_baseline
python -m tests.verify_notifications
python -m tests.verify_variant_framework
```

Expected: 163/163 + 25/25 + 32/32 pass. **Note:** `verify_baseline` wipes `data/` — back up first.

## 6. Backup test

```powershell
Copy-Item gbp-monitor/data C:\Users\HP\AppData\Local\Temp\kilo\rother_data_backup -Recurse
Remove-Item gbp-monitor/data -Recurse -Force
Copy-Item C:\Users\HP\AppData\Local\Temp\kilo\rother_data_backup gbp-monitor/data -Recurse
cd gbp-monitor; python -m tests.verify_baseline
```

Expected: 163/163 pass after restore.

## 7. Test coverage

```powershell
npx vitest run --coverage
```

Expected: Baseline established.

## 8. Doc consistency

Diff AGENTS.md vs CHANGELOG.md vs POST_CONVERGENCE_PLAN.md for contradictions.

Expected: No contradictions.

---

*End of checklist.*
