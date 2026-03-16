# Review: E6-T7 (Analytics Page)

**Date:** 2026-03-16  
**Ticket:** E6-T7: Analytics Page  
**Verdict:** ✅ Approved — no blocking issues; 2 minor findings

---

## Summary

The analytics page displays pilot-adaptive KPI cards at the top, Recharts-based milestone/quality/energy/phase charts, and an Export button. KPI cards use green/amber/red based on target thresholds (green ≥ target, amber ≥ 90% of target, red < 90%). All pilots share the milestone plan vs actual bar chart. Factor shows quality line chart and production velocity bar chart. Tasowheel shows energy per routing step (bar) and cumulative carbon (area chart). E4M shows phase duration vs planned (bar) and test pass/fail breakdown (pie chart). Export triggers `GET /api/v1/contracts/{id}/analytics/export`; on failure, falls back to `window.print()`. WebSocket invalidation refreshes analytics on update.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Summary KPI cards at top (pilot-adaptive) | ✅ |
| 2 | Milestone plan vs actual bar chart (all pilots) | ✅ |
| 3 | Factor: quality trend line, production velocity | ✅ |
| 4 | Tasowheel: energy per routing step, cumulative carbon | ✅ |
| 5 | E4M: phase duration vs planned, test pass/fail pie | ✅ |
| 6 | Export button → analytics/export or print fallback | ✅ |
| 7 | KPI colour: green on/above, amber within 10% below, red > 10% below | ✅ |
| 8 | Analytics.tsx, KpiCard.tsx, MilestoneChart, QualityChart, EnergyChart, PhaseChart | ✅ |

---

## Files Reviewed

| File | Status |
|------|--------|
| `frontend/src/pages/Analytics.tsx` | ✅ |
| `frontend/src/components/KpiCard.tsx` | ✅ |
| `frontend/src/components/charts/MilestoneChart.tsx` | ✅ |
| `frontend/src/components/charts/QualityChart.tsx` | ✅ |
| `frontend/src/components/charts/EnergyChart.tsx` | ✅ |
| `frontend/src/components/charts/PhaseChart.tsx` | ✅ |
| `frontend/src/api/analytics.ts` | ✅ |

---

## Findings

### MIN-1 — Analytics export endpoint not implemented in backend

The frontend calls `GET /api/v1/contracts/{id}/analytics/export`. The backend does not define this route. The export request returns 404, and the frontend catch block falls back to `window.print()`. The spec allows "or triggers print dialog as fallback", so this is acceptable. Non-blocking; add export endpoint when PDF export is required.

### MIN-2 — KpiCard neutral status has no CSS variant

The `KpiCard` accepts `status: "neutral"` for undefined values. `styles.css` defines `.kpi-card-green`, `.kpi-card-amber`, `.kpi-card-red` but not `.kpi-card-neutral`. The card renders with base `.kpi-card` styling only. Consider adding a neutral/grey variant for consistency. Non-blocking.

---

## Verification

- Backend `AnalyticsService.build_contract_analytics` returns all required series and KPIs
- WebSocket `CONTRACT_STATE_CHANGED`, `UPDATE_RECEIVED`, `MILESTONE_CHANGED`, `ALERT_TRIGGERED` invalidate analytics query
- Route `/contracts/:id/analytics` registered in router
