# E5-T2 Review — Scenario Runner (Automated Playback)

**Date:** 2026-03-16  
**Ticket:** E5-T2: Scenario Runner (Automated Playback)  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — 5 minor fixes applied

---

## Summary

The scenario runner is fully implemented and correctly integrated. `ScenarioRunner` is mounted in
`ContractSimulator` and receives the active contract from outlet context. Each pilot has the
required scenarios (Factor: Normal Production, Quality Failure, Production Delay; Tasowheel:
Normal Routing, Machine Downtime; E4M: Normal Development, Test Failure at M5). The runner uses
`ProviderTokenProvider` for client-credentials auth and posts directly to the ingest API,
bypassing the user's token. Playback speed (1×, 10×, 100×) is configurable via a range slider.
Stop uses `AbortController` to halt the loop. The log panel shows step payloads, responses, and
alert diffs. `runScenarioPlayback` in `runner.ts` correctly merges `initialPayload` with step
payloads, applies speed to delays, and diffs alerts before/after each step. TypeScript passes.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Factor: Normal Production, Quality Failure, Production Delay | ✅ |
| 2 | Tasowheel: Normal Routing, Machine Downtime | ✅ |
| 3 | E4M: Normal Development, Test Failure at M5 | ✅ |
| 4 | Select scenario + Run starts automated playback | ✅ |
| 5 | Each step POSTs to `POST /api/v1/ingest/{contractId}` | ✅ |
| 6 | Playback speed slider: 1×, 10×, 100× | ✅ |
| 7 | Running indicator: "Step X/Y — Pushing …" | ✅ |
| 8 | Stop button halts playback | ✅ |
| 9 | Log panel shows payload, response, alerts per step | ✅ |
| 10 | `ScenarioRunner.tsx`, scenario files, `runner.ts` created | ✅ |
| 11 | `ScenarioRunner` integrated in `ContractSimulator` | ✅ |
| 12 | Provider service account auth (client credentials) | ✅ |
| 13 | Alert diff: new alerts shown in log after each step | ✅ |

**TypeScript check:** `pnpm tsc --noEmit` → 0 errors

---

## Findings

### MIN-1 (Fixed) — Default playback speed is 10×, not 1×

Changed `useState(1)` to `useState(0)` so the default is 1× (real interval).

### MIN-2 (Fixed) — No explicit feedback when pilot type has no provider client

Added a message when `providerClient` is null but `contract.pilotType` is set: "No provider
configured for pilot type X. Add credentials for this pilot in your environment." Added an
empty-state message when `scenarios.length === 0`: "No prebuilt scenarios exist for pilot type X"
or "No pilot type is set for this contract."

### MIN-3 (Fixed) — `buildTokenUrl` relies on Vite proxy in dev

Added a comment explaining that in dev the relative URL uses the Vite proxy to forward to Keycloak.

### MIN-4 (Fixed) — `fetchAlerts` uses user token; token expiry mid-playback

Added a JSDoc comment on `fetchAlerts` noting that token expiry during long playbacks may cause 401.

### MIN-5 (Fixed) — Scenario step `evidence` as string array vs backend `AnyUrl`

In `buildStepPayload`, filter evidence to only include valid URLs before sending. Invalid strings
are dropped so the backend never receives invalid `AnyUrl` values.

---

## Not-blocking notes

- `runScenarioPlayback` correctly skips the delay after the final step (`index === steps.length - 1`).
- `ProviderTokenProvider` caches the token with a 30s buffer before expiry; avoids redundant
  token requests during playback.
- The `delay` helper properly cleans up the timeout and abort listener to avoid leaks.
- `isPlaybackAbort` and `formatRunnerError` give clear user-facing messages for stop vs failure.
- Scenario payloads align with backend expectations (e.g. `qualityPassRate`, `currentStage`,
  `routingStep`, `stepStatus`, `testResults` with `result: "FAIL"` for E4M test failure).
