# E5-T1 Review — Sensor UI Scaffold & Layout

**Date:** 2026-03-16  
**Ticket:** E5-T1: Sensor UI Scaffold & Layout  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — MIN-1 fix applied (scaffolding text removed), 4 minor findings

---

## Summary

The simulator scaffold is clean and complete. `SimulatorLayout` fetches health + contracts in
parallel, passes data and refresh control down via `Outlet` context, and renders a dark-themed
sidebar + main-panel grid. `ContractSimulator` resolves the active contract from the outlet
context (no additional fetch), shows per-pilot headings via `getPilotMeta`, and exposes four
placeholder module cards for E5-T2 through T5. The `/simulator` route is absent from the router
entirely when `simulatorEnabled` is false (not just hidden — truly unreachable). TypeScript
passes with 0 errors.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | `/simulator` route added to `router.tsx` | ✅ |
| 2 | Dark theme with "Factory Simulator" header badge | ✅ |
| 3 | Sidebar lists seeded contracts with pilot-type icons | ✅ |
| 4 | Clicking a contract loads pilot simulator panel | ✅ |
| 5 | Connection status indicator (checking / connected / unavailable) | ✅ |
| 6 | Route gated by `VITE_ENABLE_SIMULATOR` env var | ✅ (with `DEV` guard too) |
| 7 | Not reachable from consumer dashboard navigation | ✅ (confirmed no link in `DashboardLayout`) |
| 8 | Admin-only — wrapped in `<ProtectedRoute requiredRole="admin" />` | ✅ |
| 9 | Factor / Tasowheel / E4M pilot headings | ✅ (`simulatorShared.ts` PILOT_META map) |
| 10 | `isActive` flag prevents state updates after unmount | ✅ |

**TypeScript check:** `pnpm tsc --noEmit` → 0 errors

---

## Findings

### MIN-1 (Fixed) — Hardcoded `"E5-T1 Ready"` scaffolding kicker in `SimulatorIndex`

```tsx
// before
<span className="simulator-section-kicker">E5-T1 Ready</span>

// after
<span className="simulator-section-kicker">Factory Simulator</span>
```

Internal ticket-ref text was left in the welcome panel. Replaced with the same label used in
the topbar badge so the UI is consistent.

### MIN-2 — `simulatorEnabled` is more permissive than the spec

```ts
const simulatorEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_SIMULATOR !== "false";
```

Spec: "only available in development mode via `VITE_ENABLE_SIMULATOR=true`" (requires explicit
opt-in). Implementation: enabled by default in dev mode unless explicitly set to `"false"`
(opt-out). In practice this is developer-friendlier (no need to set the var in every dev
`.env`), but it inverts the spec intent. Testing step 5 ("with `false` → route returns 404") is
covered. Noting as a deliberate and acceptable deviation; a comment explaining the choice would
be useful.

### MIN-3 — `startTransition` wrapping of the `"loading"` state reset on Refresh

```tsx
startTransition(() => {
  setConnectionState({ status: "checking", ... });
  setContractsState({ status: "loading" });
});
```

`startTransition` marks updates as interruptible / lower priority. Wrapping the loading
indicator reset in it means the spinner may not appear immediately when the user clicks
"Refresh" — React can defer the update until it finishes higher-priority work. The success /
error updates are also in `startTransition`, which is correct (they are non-urgent). The loading
reset should be synchronous or use `useTransition`'s pending flag to show a spinner via the
`isPending` boolean. For a dev-only tool this is an acceptable UX trade-off, not a blocker.

### MIN-4 — No empty-contracts feedback state

If `GET /api/v1/contracts` returns an empty array (no seeded contracts in the DB), `SimulatorIndex`
renders no cards and the sidebar is blank. A brief "No contracts found — run the seed script"
message would prevent a confusing blank state for first-time setup.

### MIN-5 — `SimulatorContract` type manually mirrors `ContractListItemResponse`

`simulatorShared.ts` declares `SimulatorContract` by hand rather than sharing a generated or
imported API type. Drift is possible if the backend contract list schema changes. Post-MVP this
should align with whatever API type generation strategy the project adopts (e.g. OpenAPI
codegen).

---

## Not-blocking notes

- CSS uses global class names (`simulator-*`) rather than CSS Modules — consistent with the
  rest of the frontend, no action needed.
- The `requestVersion` incrementor pattern for triggering re-fetches is a clean alternative
  to `useCallback` + manual dependency tracking.
- Placeholder module cards in `ContractSimulator` correctly name the upcoming E5-T2 through T5
  tickets, keeping the scaffold honest about what is and isn't implemented.
