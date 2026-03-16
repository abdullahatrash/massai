# MaaSAI Monitoring Tool — Open Questions & Decisions

| Field | Value |
|---|---|
| Document Version | 1.0 |
| Date | March 16, 2026 |
| Status | Active — Items need resolution before or during build |

> This file tracks unresolved questions, pending decisions, and deferred items.
> Update the **Status** column as each item is resolved.
> Resolved items stay in the file for traceability — move them to the Resolved section at the bottom.

---

## How to Use This File

| Status | Meaning |
|---|---|
| 🔴 Blocking | Cannot build the dependent ticket until this is resolved |
| 🟡 Decision Needed | Needs a choice made — both options are viable |
| 🔵 Deferred | Intentionally pushed to a later phase — no action needed now |
| ✅ Resolved | Answer confirmed — see Resolution column |

---

## Active Items

---

### OQ-001 — SCT → Tool Integration: How Does Your System Learn About New Contracts?

| Field | Detail |
|---|---|
| **Status** | 🔴 Blocking |
| **Blocks** | E3-T8 (Admin Contract Onboarding) |
| **Owner** | Engineering Team + SCT Team (SLG) |
| **Raised** | March 16, 2026 |

**The Question:**

When the SCT (Smart Contracts Toolkit) deploys a new manufacturing agreement on the MSB blockchain, how does the monitoring tool automatically know a new contract exists and needs to start monitoring?

Currently, E3-T8 covers manual admin registration — an admin provides a blockchain address and the tool pulls metadata. But in production, this should be automatic.

**Two options to decide between:**

**Option A — SCT Webhook (Push)**
SCT calls `POST /api/v1/admin/contracts` on our tool immediately after deploying a new smart contract. Our tool is a registered webhook consumer in the SCT system.

- ✅ Instant — monitoring starts as soon as contract is deployed
- ✅ Simple to implement on our side (E3-T8 already handles the logic)
- ❌ Requires SCT team to implement the outbound webhook call
- ❌ Our endpoint must be publicly reachable from SCT's network

**Option B — Blockchain Event Listener (Poll)**
Our backend runs a background worker that watches the MSB network (`entrynet-maasai.euinno.eu`) for `ContractDeployed` events via `web3.py` event filters. When detected, it auto-onboards the contract.

- ✅ Fully self-contained — no dependency on SCT team implementing a webhook
- ✅ Works even if SCT doesn't support webhooks
- ❌ Polling delay (seconds to minutes depending on poll interval)
- ❌ Requires the MSB smart contract to emit a `ContractDeployed` event — needs confirmation from SLG
- ❌ More complex to implement — needs a persistent background worker

**Questions to ask SCT/SLG team:**
1. Does the manufacturing monitoring smart contract emit a `ContractDeployed` (or equivalent) event on deployment?
2. Can SCT be configured to call an external webhook URL after contract deployment?
3. Is there an existing event subscription mechanism in MSB we can use?

**Action required:** Schedule a sync with the SLG blockchain team to decide on integration pattern. Add the chosen implementation as a new ticket in E3.

---

### OQ-002 — Document Upload Strategy: Who Stores the Files?

| Field | Detail |
|---|---|
| **Status** | 🟡 Decision Needed |
| **Blocks** | E3-T6 (Documents API Endpoint), E2-T2 (Ingest Endpoint), E5-T3 (Manual Send Form) |
| **Owner** | Engineering Team |
| **Raised** | March 16, 2026 |

**The Question:**

When a provider submits evidence files (inspection reports, CAD files, test results, drawings), who is responsible for storing the actual file, and how does the URL end up in the system?

**Two options to decide between:**

**Option A — Provider Uploads Directly to External Storage (URL-in-Payload)**
Provider uploads the file directly to an S3 bucket or IPFS, gets a URL, then includes that URL in the ingest API `evidence` array. Our tool stores only the URL reference — never touches the file.

```json
// Provider's ingest payload
{
  "updateType": "MILESTONE_COMPLETE",
  "evidence": ["https://s3.amazonaws.com/maasai-docs/inspection-report.pdf"]
}
```

- ✅ Simple — our tool has no file handling complexity
- ✅ Files can be arbitrarily large without affecting our API
- ❌ Requires providers to have access to an S3 bucket or IPFS
- ❌ We cannot validate that the URL is accessible or the file is what it claims to be
- ❌ URLs could go dead (link rot) — no guarantee of long-term availability

**Option B — Upload Endpoint in Our Tool**
Our tool provides a `POST /api/v1/contracts/{id}/documents/upload` multipart endpoint. Provider uploads the file to us, we store it in S3/IPFS, and return a managed URL.

```
POST /api/v1/contracts/{id}/documents/upload
Content-Type: multipart/form-data
file: <binary>
milestoneId: M2
name: "PCB layout v2"
```

- ✅ We control the URL — no link rot
- ✅ We can validate file type and size
- ✅ Simpler for providers — one system, one auth token
- ❌ Requires us to integrate with S3 or IPFS (new dependency)
- ❌ Our tool becomes responsible for file storage costs and availability

**Recommendation:** Option A for v1 (simpler, unblocks build immediately). Option B for v2 if link rot or provider friction becomes a real problem.

**Action required:** Make a call. If Option A — document the expected URL format and add to provider integration guide. If Option B — add an upload ticket to E3 and add `boto3`/S3 config to the stack.

---

### OQ-003 — Test Infrastructure Setup

| Field | Detail |
|---|---|
| **Status** | 🔴 Blocking |
| **Blocks** | All backend test steps across E0–E4 |
| **Owner** | Engineering Team |
| **Raised** | March 16, 2026 |

**The Question:**

The tickets describe `pytest` test commands throughout, but no ticket sets up the test infrastructure. Without this, tests cannot run.

**What is needed:**

- `backend/conftest.py` — shared fixtures: async test client, test DB session, seeded test contracts, mock auth token factory
- `backend/pytest.ini` — marks (unit, integration), asyncio mode, test DB URL
- A **test database** — either a separate PostgreSQL DB (`massai_test`) or SQLite in-memory for unit tests
- A `Makefile` or `justfile` with shortcut commands: `make test`, `make test-unit`, `make test-integration`
- Test database migration strategy: run `alembic upgrade head` against test DB before test suite
- Mock Keycloak for tests — either a real Keycloak test instance or a fixture that mocks JWT validation so tests don't depend on Keycloak being up

**Action required:** Add ticket **E1-T7: Test Infrastructure Setup** before any test steps are executed. This is a pre-requisite for all E0–E4 testing.

Suggested ticket scope:
- `conftest.py` with: `async_client`, `db_session`, `seeded_contracts`, `consumer_token`, `provider_token`, `admin_token` fixtures
- `pytest.ini` with asyncio mode and marks
- `Makefile` with `test`, `test-unit`, `test-integration`, `test-cov` targets
- Mock auth fixture that bypasses Keycloak for unit tests

---

### OQ-004 — Production Deployment Strategy

| Field | Detail |
|---|---|
| **Status** | 🔵 Deferred (post-v1) |
| **Blocks** | Nothing in v1 |
| **Owner** | Engineering Team + DevOps |
| **Raised** | March 16, 2026 |

**The Question:**

`docker-compose.dev.yml` is for local development only. There is currently no plan for deploying to a production or staging server.

**What needs to be decided before production:**

1. **Hosting platform** — VM (like the SLG blockchain VM)? Cloud (AWS/GCP/Azure)? Bare metal?
2. **Production Docker Compose vs. Kubernetes** — For a small team, a production `docker-compose.yml` on a single VM is fine for v1. Kubernetes is overkill until scale demands it.
3. **Secrets management** — `.env` files cannot be used in production. Options: Docker secrets, Vault, cloud secret manager (AWS SSM, etc.)
4. **Database migrations on deploy** — Need an init container or startup script that runs `alembic upgrade head` before the backend starts
5. **Keycloak in production** — Should Keycloak use an external DB (PostgreSQL) instead of its built-in H2 in production. H2 is fine for dev only.
6. **SSL/TLS** — nginx reverse proxy with Let's Encrypt certificates, or terminate at load balancer
7. **Backup strategy** — PostgreSQL WAL or daily pg_dump for the monitoring DB

**Action required:** No action needed for v1. Create a `DEPLOYMENT.md` doc before the first production rollout and add tickets to a new EPIC E7 at that point.

---

### OQ-005 — Which MaaSAI Tool Reads 3D Drawings? (Tasowheel Open Question)

| Field | Detail |
|---|---|
| **Status** | 🟡 Decision Needed |
| **Blocks** | Tasowheel `technicalDrawings` field handling in agreement JSON |
| **Owner** | MaaSAI Platform Team |
| **Raised** | Noted in case study Pilot 2 (Tasowheel) and REQUEST.md |

**The Question:**

The Tasowheel quotation process requires customers to submit 3D CAD files (STEP, IGES format) or 2D drawings. The case study explicitly flags: *"Open question: Which MaaSAI tool can read 3D drawings or 3D models?"*

**Impact on our tool:**
- The `technicalDrawings` field in the agreement JSON includes format metadata (`drawingFormat: "3D_STEP"`)
- If no MaaSAI tool can parse the file, our tool only needs to store the URL reference + format string — no parsing required
- If a tool does parse it, we may need to store additional structured data extracted from the drawing

**Action required:** Confirm with MaaSAI platform team whether any tool handles drawing parsing. Until confirmed, our tool treats `technicalDrawings` as a URL reference array only — no parsing responsibility.

---

### OQ-006 — Manufacturing Smart Contract ABI (Needed for Real Blockchain Integration)

| Field | Detail |
|---|---|
| **Status** | 🔴 Blocking (for production blockchain integration only) |
| **Blocks** | E3-T8 `RealMSBService.get_contract_metadata()`, E4-T2 `RealMSBService` |
| **Owner** | SLG Blockchain Team |
| **Raised** | March 16, 2026 |

**The Question:**

The current MVP smart contracts on the MSB network are for the **Barba Stathis food production** pilot (Order, Warehouse, Delivery, Role Management contracts). There is no manufacturing monitoring smart contract yet.

Our `RealMSBService` needs to:
1. Read contract metadata from a deployed manufacturing agreement
2. Write milestone completion events
3. Write alert events
4. Read historical events

All of these require the **Contract ABI** (Application Binary Interface) — the interface definition that tells `web3.py` how to call the contract's functions and read its events.

**What we need from the SLG team:**
1. The Solidity source or compiled ABI JSON for the manufacturing monitoring smart contract
2. Confirmation of which events the contract emits (e.g., `MilestoneCompleted`, `AlertRaised`, `ContractActivated`)
3. Confirmation of which functions our backend can call to write state

**Current workaround:** `MockMSBService` is fully functional for v1 development. Production blockchain integration is blocked until ABI is available. This does not block any tickets — the mock adapter covers all development.

**Action required:** Add to SLG team agenda. Once ABI is available, complete `backend/app/services/blockchain_real.py` (referenced in E4-T2).

---

## Resolved Items

*No items resolved yet. Move items here with their resolution details as they are closed.*

| OQ # | Title | Resolution | Resolved By | Date |
|---|---|---|---|---|
| — | — | — | — | — |

---

## Decision Log

*Record key architectural decisions made during the project here.*

| Decision | Chosen Option | Rationale | Date |
|---|---|---|---|
| Intermediate database needed | PostgreSQL + Blockchain split | Blockchain cannot serve real-time queries; PostgreSQL serves UI at speed; blockchain is audit trail | March 16, 2026 |
| Blockchain consensus | Proof of Authority (PoA) | Already decided by SLG — Hyperledger Besu with PoA on private VM | February 2025 |
| Auth provider | Keycloak 24 | Open-source, self-hosted, supports client credentials for service accounts + PKCE for frontend | March 16, 2026 |
| Pilot extensibility | JSON schema files per pilot | New pilots require zero code changes — only a new schema file | March 16, 2026 |
| Blockchain write strategy | Async background sync | Blockchain writes must not block API responses; PostgreSQL is immediate source of truth | March 16, 2026 |
