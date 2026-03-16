# Review: E6-T1 & E6-T2 (Frontend Scaffold & Contracts List Page)

**Date:** 2026-03-16  
**Tickets:** E6-T1 (Frontend Scaffold & Routing), E6-T2 (Contracts List Page)  
**Verdict:** ✅ Approved — 4 minor fixes applied

---

## E6-T1: Frontend Scaffold & Routing

### Summary

The React 19 project is correctly scaffolded with Vite, React Router v7, React Query, recharts, date-fns, clsx, and Keycloak auth. The dashboard layout provides sidebar navigation, main content area, and session scope. The typed API client wraps fetch with base URL, auth headers, and error handling. All routes are defined and nested under `/contracts/:contractId`. Global error boundary and 404 handling are in place.

### Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | pnpm create vite react-ts | ✅ |
| 2 | react-router-dom@7, @tanstack/react-query, recharts, date-fns, clsx | ✅ |
| 3 | DashboardLayout — sidebar nav + main content area | ✅ |
| 4 | Typed API client (base URL, auth, error handling) | ✅ |
| 5 | Routes: /contracts, /contracts/:id, milestones, feed, alerts, documents, analytics | ✅ |
| 6 | Global error boundary + 404 page | ✅ |
| 7 | api/client.ts, api/contracts.ts, api/milestones.ts, api/alerts.ts | ✅ |
| 8 | pnpm dev → dev server starts | ✅ |
| 9 | /contracts → renders, /contracts/nonexistent → 404 | ✅ |
| 10 | client.get('/contracts') typed, no `any` | ✅ |
| 11 | Nav links work without full page reload | ✅ |
| 12 | Browser back/forward work | ✅ |

### E6-T1 Findings

#### MIN-1 (Fixed) — RouteErrorBoundary 404 used default props

When a route threw a 404 response, the error boundary rendered `<NotFoundPage />` with no props. Updated to pass `actionLabel="Back to contracts"`, `actionTo="/contracts"` for consistent UX.

---

## E6-T2: Contracts List Page

### Summary

The contracts list fetches `GET /api/v1/contracts` via React Query, renders a card per contract with product name, pilot icon (⚙️ Factor / ⚡ Tasowheel / 🔌 E4M), provider name, delivery date, milestone progress bar, and status badge. Status badges use correct colours (green for ON_TRACK, amber for DELAYED, red for ACTION_REQUIRED, grey for COMPLETED). ACTION_REQUIRED contracts are sorted to the top. Loading skeleton, empty state, and error state are implemented. Clicking a card navigates to `/contracts/:id`.

### Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Fetches GET /api/v1/contracts via React Query | ✅ |
| 2 | Card per contract: product name, pilot icon, provider, delivery date, progress, status | ✅ |
| 3 | Status badge colours: green, amber, red, grey | ✅ |
| 4 | ACTION_REQUIRED sorted to top | ✅ |
| 5 | Loading skeleton | ✅ |
| 6 | Empty state | ✅ |
| 7 | Click row → navigates to /contracts/:id | ✅ |
| 8 | StatusBadge.tsx, MilestoneProgressBar.tsx, ContractsList.tsx | ✅ |

### E6-T2 Findings

#### MIN-1 (Fixed) — StatusBadge had no fallback for unknown status

If the API returned a status not in `ContractStatusBadge`, `statusLabels[status]` would be undefined and the badge could render blank or throw. Added `getStatusLabel` and `getStatusCssClass` helpers with fallbacks for unknown statuses.

#### MIN-2 (Fixed) — status-badge-unknown CSS missing

Added `.status-badge-unknown` for unknown statuses (grey, neutral styling).

#### MIN-3 (Fixed) — Code tag spacing in footnote

`<code> ACTION_REQUIRED</code>` had extra space before the status. Fixed to `<code>ACTION_REQUIRED</code>`.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/StatusBadge.tsx` | Fallback for unknown status, `status-badge-unknown` class |
| `frontend/src/pages/RouteErrorBoundary.tsx` | 404 case passes props to NotFoundPage |
| `frontend/src/pages/ContractsList.tsx` | Fix code tag spacing |
| `frontend/src/styles.css` | Add `.status-badge-unknown` |

---

## Verification

- `pnpm run build` → 0 errors
- TypeScript strict mode passes
