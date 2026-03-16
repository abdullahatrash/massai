# Review: E0-T4

**Date:** March 16, 2026
**Ticket:** E0-T4 — Frontend Auth (Keycloak Login Flow + Protected Routes)
**Verdict:** ✅ **Approved with 2 required fixes** (IMP-1 npm→pnpm migration · IMP-2 Dockerfile.dev update)

---

## Verification Checklist

| Criteria | Status | Notes |
|---|---|---|
| `keycloak-js` installed | ✅ | v24.0.5 — matches Keycloak 24 |
| `frontend/src/auth/keycloak.ts` — Keycloak instance config | ✅ | `VITE_*` env vars with sensible dev defaults |
| `AuthProvider` — initialises with `check-sso` + PKCE S256 | ✅ | `onLoad: "check-sso"`, `pkceMethod: "S256"` |
| `AuthProvider` — exposes `isAuthenticated`, `user`, `token`, `login()`, `logout()` | ✅ | Full context shape present |
| `AuthProvider` — auto-refresh token 30s before expiry | ✅ | `setInterval(20s)` + `updateToken(30)`, `onTokenExpired` handler |
| `AuthProvider` — redirects to login on refresh failure | ✅ | `onAuthRefreshError` → `keycloak.login()` |
| `AuthProvider` — cleanup on unmount | ✅ | Clears interval, removes all keycloak event handlers, clears token provider |
| `public/silent-check-sso.html` | ✅ | Correct — `parent.postMessage(location.href, location.origin)` |
| `ProtectedRoute` — loading state while Keycloak initialises | ✅ | `!isReady` → renders status card |
| `ProtectedRoute` — error state with retry button | ✅ | `error` → renders retry button calling `login()` |
| `ProtectedRoute` — redirect-in-progress splash | ✅ | `!isAuthenticated` → shows redirect notice |
| `ProtectedRoute` — role gate via `requiredRole` prop | ✅ | Shows access-restricted card with user's current roles |
| All dashboard routes wrapped in `ProtectedRoute` | ✅ | Root layout element is `<ProtectedRoute>` |
| `/simulator` requires `admin` role | ✅ | Nested `<ProtectedRoute requiredRole="admin">` |
| `api/client.ts` injects `Authorization: Bearer` on every request | ✅ | `setAccessTokenProvider` wired from `AuthProvider` |
| App wrapped in `AuthProvider` in `main.tsx` | ✅ | Wraps `<AppRouter>` in `<StrictMode>` |
| Dashboard header shows user email + Logout button | ✅ | `DashboardLayout` reads `useAuth().user.email` |
| `VITE_*` env vars passed in `docker-compose.dev.yml` | ✅ | `VITE_API_BASE_URL`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` |
| `env.d.ts` type declarations for `ImportMetaEnv` | ✅ | All 4 VITE vars typed as `readonly string \| undefined` |
| TypeScript type check (`tsc --noEmit`) | ✅ | **0 errors** |

---

## Architecture Notes (Correct)

**Token provider pattern (decoupled from React context):**
`AuthProvider` calls `setAccessTokenProvider(() => token)` on every state change. `api/client.ts` calls `accessTokenProvider()` at request time, so it always uses the latest token without needing to pass it through React props or context from the call site. This is a clean inversion of control.

**`check-sso` + `silentCheckSsoRedirectUri`:**
`check-sso` combined with the `silent-check-sso.html` page enables Keycloak to detect an existing SSO session in a hidden iframe without a full page redirect. If no session exists, the user stays on the app and sees the redirect notice, then `useEffect` triggers `login()`. This avoids the flash of an unprotected page.

**Double token refresh strategy:**
Both a polling interval (`setInterval` every 20s → `updateToken(30s buffer)`) and the `onTokenExpired` event are wired. The event fires when the token is already expired; the interval proactively refreshes before expiry. These are complementary.

**`checkLoginIframe: false`:**
Correct for this setup. The login iframe causes cross-origin cookie issues in Safari and Firefox (Strict mode). Single sign-out detection is handled adequately by `check-sso` on page load + `onAuthLogout` event.

---

## Issues

### Important

#### IMP-1: `npm` used instead of `pnpm` (spec deviation)

**Files:** `frontend/package-lock.json`, `frontend/Dockerfile.dev`, `docker-compose.dev.yml` (line 94)

The architecture document, PRD, and all ticket specs explicitly specify `pnpm` as the frontend package manager. The agent used `npm`:
- `package-lock.json` committed instead of `pnpm-lock.yaml`
- `Dockerfile.dev` runs `npm install`
- Docker Compose CMD runs `npm install && npm run dev`

**Required fix:** migrate to `pnpm`.

#### IMP-2: `Dockerfile.dev` `CMD` runs redundant `npm install`

**File:** `frontend/Dockerfile.dev`

```dockerfile
COPY package.json ./
RUN npm install         # install at image build time
CMD ["sh", "-lc", "npm install && npm run dev ..."]   # re-installs at every container start
```

The `RUN npm install` and `CMD npm install` are redundant. At runtime, the volume mount `./frontend:/app` replaces `/app` entirely (including `node_modules`), so the build-time install is discarded. The CMD install is the only one that matters, but it re-runs on every `docker compose up`, adding 30+ seconds startup time.

The correct pattern: remove `RUN npm install` from the Dockerfile and keep only the CMD install, OR use a named volume for `node_modules` to avoid the mount overwrite. Will be addressed as part of the pnpm migration.

---

### Minor

#### MIN-1: Simulator nav link visible to all authenticated users, not just admins

**File:** `frontend/src/layouts/DashboardLayout.tsx`, lines 35–40

The Simulator link is always rendered in the sidebar. Non-admin users clicking it see the "Access Restricted" page, which is jarring. The link should be conditionally rendered:

```tsx
{user?.roles.includes("admin") && (
  <NavLink className={...} to="/simulator">Simulator</NavLink>
)}
```

#### MIN-2: `tsconfig.node.json` exists but is unused

`tsconfig.node.json` is a Vite scaffold artefact meant for `vite.config.ts` type checking. It exists in the project but is not referenced from `tsconfig.json`. Low impact — Vite handles it internally. Can be left or removed.

---

## Required Actions

| Priority | Action | File(s) | Urgency |
|---|---|---|---|
| IMP-1 | Migrate from npm to pnpm (`pnpm-lock.yaml`, delete `package-lock.json`) | `frontend/` | Fix now — spec deviation |
| IMP-2 | Fix Dockerfile.dev for pnpm + remove redundant install step | `frontend/Dockerfile.dev`, `docker-compose.dev.yml` | Fix with IMP-1 |
| MIN-1 | Hide Simulator nav link from non-admin users | `frontend/src/layouts/DashboardLayout.tsx` | Quick fix |

---

## Ticket Status

| Ticket | Status | Notes |
|---|---|---|
| E0-T4 | ✅ Closed after fixes applied | All auth criteria met; 0 TypeScript errors |

**EPIC E0 is now fully closed.**

**Next:** E1-T3 (Database schema + Alembic migrations)
