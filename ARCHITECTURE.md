# MaaSAI — Production Monitoring Tool

## Architecture & Findings Document


| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| Document Version | 1.0                                              |
| Date             | March 16, 2026                                   |
| Author           | System Design Session                            |
| Scope            | BP02 Monitoring Tool — Backend API + Consumer UI |
| Tech Stack       | Python FastAPI · React 19 · PostgreSQL · Docker  |


---

## Table of Contents

1. [Project Scope](#1-project-scope)
2. [Case Study Findings](#2-case-study-findings)
3. [Cross-Pilot Analysis](#3-cross-pilot-analysis)
4. [Database Architecture Decision](#4-database-architecture-decision)
5. [System Architecture](#5-system-architecture)
6. [Project Structure](#6-project-structure)
7. [API Design](#7-api-design)
8. [Pilot-Specific Data Schemas](#8-pilot-specific-data-schemas)
9. [Mock Sensor Infrastructure](#9-mock-sensor-infrastructure)
10. [Consumer UI Design](#10-consumer-ui-design)
11. [Docker Compose Setup](#11-docker-compose-setup)
12. [Build Order (Solo Developer)](#12-build-order-solo-developer)
13. [Blockchain Technology Stack (Real MSB)](#13-blockchain-technology-stack-real-msb)

---

## 1. Project Scope

### What We Are Building

A **generic production monitoring tool** that sits between:

- **The Provider** (manufacturer): pushes production data
- **The Consumer** (company that ordered manufacturing): views progress, receives alerts, approves milestones
- **MSB/SCT** (MaaS Blockchain + Smart Contracts Toolkit): immutable audit trail for key events

### Our Company's Responsibility

- Design and build the **Provider Ingest API** (generic, extensible across all pilots)
- Design and build the **Consumer Dashboard UI** (no blockchain jargon exposed)
- Manage the **intermediate data layer** between live production data and blockchain
- Implement the **real-time monitoring, alerting, and milestone verification** engine

### What Is Out of Scope

- Smart contract creation (handled by SCT)
- Agreement negotiation (handled by MCH/CMM)
- Quotation process (separate BP01 workflow)
- Blockchain infrastructure (owned by MSB team)

---

## 2. Case Study Findings

### Pilot 1 — Factor (Metal Parts Manufacturing, Valencia, Spain)

**Partner:** Factor Ingeniería y Decoletaje SL + EXOS  
**Industry:** Metal parts machining with tight tolerances  
**Key Problem Being Solved (BP02):** Currently, during production, the Factor sales team must repeatedly call or email providers to ask for status updates. This is entirely manual and inefficient.

**Relevant Business Processes:**

- **BP01:** Provider Search (finding external manufacturers)
- **BP02:** Monitoring of provider production ← **our scope**
- **BP03:** Receiving production + quality control

**Infrastructure used in BP02:**

- Edge MaaS Data Storage (at provider site)
- Data Integrator (normalises and forwards data)
- Remote Monitoring & Control Panels (consumer-facing)
- Point-to-Point Secure Messaging (notifications)

**KPIs for BP02:**


| KPI          | Description                                     | Goal                   |
| ------------ | ----------------------------------------------- | ---------------------- |
| KPI1_P1_BP02 | Average manual status requests per order        | Reduce to zero         |
| KPI2_P1_BP02 | Customer satisfaction with order status updates | Increase               |
| KPI3_P1_BP02 | % of automated status updates                   | Maximise (target 100%) |


**Data pushed by provider:**

- Quantity produced (current vs. planned)
- Current production stage
- Quality inspection results
- Machine utilisation data

**Monitoring update frequency:** Configurable per contract (e.g., every 4 hours)

---

### Pilot 2 — Tasowheel (Gears Manufacturing, Tampere, Finland)

**Partner:** Tasowheel Oy + TAU (Tampere University)  
**Industry:** Precision gears manufacturing (20–400mm diameter, 250,000+ pcs/year)  
**Key Problem Being Solved (BP01):** Automating the quotation process from customer request to order acceptance.

**Relevant Business Process:**

- **BP01:** Quotation process (customer request → routing → capacity → quote → acceptance → order)

**Infrastructure:**

- APS (Advanced Planning & Scheduling) system
- Powered ERP
- MaaS Dynamic Catalogue, Supply Chain Simulator, Provider Planner
- MaaS Blockchain (at order acceptance stage)

**KPIs:**


| KPI          | Description                                |
| ------------ | ------------------------------------------ |
| KPI1_P2_BP01 | Effective resource utilisation             |
| KPI2_P2_BP01 | Inventory turnover rate                    |
| KPI3_P2_BP01 | Manufacturing process capability (OTD)     |
| KPI4_P2_BP01 | Downtime duration of manufacturing process |
| KPI5_P2_BP01 | Production efficiency index                |
| KPI6_P2_BP01 | Productivity index of work units           |
| KPI7_P2_BP01 | Carbon footprint per product               |
| KPI8_P2_BP01 | Energy consumption                         |


**Data pushed by provider (once order accepted):**

- Routing step completion (turning → heat treatment → grinding → inspection)
- Setup time actual vs. planned
- Cycle time per piece
- Downtime minutes
- Energy consumption (kWh)

**Open question noted in case study:** Which MaaSAI tool can read 3D drawings or 3D models? (impacts `technicalDrawings` parameter in agreement JSON)

---

### Pilot 5 — E4M (Electronics/PCB Manufacturing, Guimarães, Portugal)

**Partner:** E4M - Engenharia Mecatrónica Lda + UNINOVA  
**Industry:** Custom electronics, PCB manufacturing, mechatronics  
**Key Problem Being Solved (BP02):** Development process monitoring, optimisation, and information exchange between provider and consumer during design and manufacturing phases.

**Relevant Business Processes:**

- **BP01:** Customer interaction & commercial exchange
- **BP02:** Development process monitoring ← **our scope**
- **BP03:** Maintenance process monitoring (post-deployment PCBs)
- **BP04:** End-of-life policy automation (R3T toolkit)

**Infrastructure used in BP02:**

- Control Panels (CP) — consumer views progress
- Data Analytics (DA) — transparency and optimisation
- Point-to-Point Secure Messaging (PSM)

**Development Milestones (M1–M6):**


| Milestone | Name                            | Customer Approval Required |
| --------- | ------------------------------- | -------------------------- |
| M1        | Idealization complete           | No                         |
| M2        | Concept validation approved     | **Yes**                    |
| M3        | Engineering design finalized    | **Yes**                    |
| M4        | Prototype manufactured          | No                         |
| M5        | Testing and validation complete | **Yes**                    |
| M6        | Production batch manufactured   | **Yes**                    |


**KPIs for BP02:**


| KPI          | Description                             |
| ------------ | --------------------------------------- |
| KPI1_P5_BP02 | Manufacturing Time Availability Gain    |
| KPI2_P5_BP02 | Production Flow Efficiency Improvement  |
| KPI3_P5_BP02 | Waste Avoidance Through Remanufacturing |


**Data pushed by provider:**

- Current phase (M1–M6)
- Completion percentage per phase
- Deliverables submitted (CAD files, BOMs, test plans)
- Test results (AOI, flying probe, functional test)
- Issues/blockers

---

## 3. Cross-Pilot Analysis

### What Is Generic (Same Across All Pilots)

All three pilots follow the same fundamental monitoring loop:

```
Provider pushes update → Rule engine evaluates → State updates → Consumer notified
```

Every pilot has:

- A contract (from blockchain) with defined milestones
- A provider that pushes structured updates
- A consumer that reads progress without caring about blockchain
- Alert conditions (delay, quality failure, no data received)
- Milestone verification (auto or manual approval)
- Document/evidence attachments

### What Is Pilot-Specific


| Concern               | Factor (P1)                       | Tasowheel (P2)                    | E4M (P5)                            |
| --------------------- | --------------------------------- | --------------------------------- | ----------------------------------- |
| Update payload shape  | Qty, quality, stage, machine data | Routing step, downtime, energy    | Phase, test results, deliverables   |
| Milestone granularity | Production stages                 | Manufacturing routing steps       | M1–M6 design phases                 |
| Approval gates        | Final quality acceptance          | Customer quote acceptance         | Per-phase sign-off (M2, M3, M5, M6) |
| KPI metrics           | Manual requests, automation %     | OTD, resource utilisation, carbon | Time availability, flow efficiency  |
| Data source           | Edge MaaS Data Storage            | APS/ERP (Powered ERP)             | Control Panels                      |
| Update interval       | Every 4 hours typical             | Per step completion event         | Phase-level (days)                  |


### Key Design Insight

The monitoring backend can be **fully generic** with pilot-specific **JSON schemas registered per contract type**. The same API endpoints, rule engine, and UI serve all three pilots. Only the payload validation schema and KPI calculation logic differ per pilot.

---

## 4. Database Architecture Decision

### Do We Need an Intermediate Database? Yes — Absolutely.

**The blockchain (MSB) is NOT a queryable database.** It cannot serve a real-time dashboard.


| Concern           | Why Blockchain Alone Is Not Enough                       |
| ----------------- | -------------------------------------------------------- |
| Query performance | No SELECT WHERE, joins, or pagination on-chain           |
| Write latency     | 3–6 block confirmations per write (seconds to minutes)   |
| Cost              | Every on-chain write has a gas fee                       |
| Time-series data  | Sensor updates every few seconds cannot go to blockchain |
| Consumer UI speed | Millisecond response times required                      |


### Split Storage Strategy

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│   PostgreSQL (App DB)        │     │   MSB Blockchain              │
│   Fast, queryable, mutable   │     │   Immutable audit trail       │
├─────────────────────────────┤     ├──────────────────────────────┤
│ All sensor/production        │     │ Contract creation event       │
│ updates (time-series)        │     │ (+ agreement hash)           │
│ Current computed state       │     │ Milestone completion events   │
│ Document metadata            │     │ Digital signatures            │
│ Alert history                │     │ High-severity alerts          │
│ User sessions                │     │ Final state changes           │
│ Analytics aggregations       │     │ Dispute/escalation events     │
└─────────────────────────────┘     └──────────────────────────────┘
```

**Pattern:** PostgreSQL serves the UI at query speed. A background worker syncs key events to the blockchain asynchronously.

---

## 5. System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOCAL DEV (Docker Compose)                  │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │ factor-sim   │   │tasowheel-sim │   │  e4m-sim     │            │
│  │ (Mock Sensor)│   │ (Mock Sensor)│   │ (Mock Sensor)│            │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘            │
│         └─────────────────┬┘                   │                    │
│                           │ POST /api/v1/ingest/{contractId}        │
│          ┌────────────────▼────────────────────┐                   │
│          │           FastAPI Backend            │                   │
│          │                                      │                   │
│          │  ┌──────────────┬─────────────────┐ │                   │
│          │  │  Ingest API  │  Consumer API   │ │                   │
│          │  │  (provider   │  (read-only,    │ │                   │
│          │  │   pushes)    │   no bc jargon) │ │                   │
│          │  └──────┬───────┴────────┬────────┘ │                   │
│          │         │                │           │                   │
│          │  ┌──────▼────────────────▼────────┐ │                   │
│          │  │          Core Services         │ │                   │
│          │  │  MonitoringService             │ │                   │
│          │  │  MilestoneService              │ │                   │
│          │  │  RuleEngine (alerts)           │ │                   │
│          │  │  BlockchainService (mock/real) │ │                   │
│          │  └──────┬──────────────┬──────────┘ │                   │
│          │         │              │             │                   │
│          │  ┌──────▼──────┐ ┌────▼──────────┐ │                   │
│          │  │ PostgreSQL  │ │ Mock MSB      │ │                   │
│          │  │ (app DB)    │ │ (event log)   │ │                   │
│          │  └─────────────┘ └───────────────┘ │                   │
│          │                                      │                   │
│          │  WebSocket: /ws/contracts/{id}        │                   │
│          └──────────────────────────────────────┘                   │
│                           │                                         │
│          ┌────────────────▼────────────────────┐                   │
│          │          React 19 Frontend           │                   │
│          │   Consumer Dashboard                 │                   │
│          │   (zero blockchain terminology)      │                   │
│          └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Contract State Machine

All contracts across all pilots follow this state machine:

```
PENDING_SIGNATURES
        │
        ▼ (both parties sign)
      ACTIVE
        │
        ▼ (provider confirms production start)
   IN_PROGRESS
        │
        ▼ (all milestones verified)
 AWAITING_DELIVERY
        │
        ├──────────────────────────────┐
        ▼ (consumer accepts quality)   ▼ (quality issue)
    COMPLETED                      DISPUTED
        │                              │
        ▼                              ▼ (resolved)
      CLOSED                       RESOLVED → CLOSED
```

Every state transition is:

1. Written to PostgreSQL immediately (fast UI update)
2. Written to MSB blockchain asynchronously (audit trail)

---

## 6. Project Structure

```
massai-monitoring/
├── docker-compose.yml              ← production-like
├── docker-compose.dev.yml          ← local dev with mock sensors
├── .env.example
├── README.md
│
├── backend/                        ← Python FastAPI + uv
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── Dockerfile
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── config.py           ← pydantic-settings
│       │   ├── database.py         ← SQLAlchemy async + asyncpg
│       │   └── blockchain.py       ← MSB adapter interface (real + mock)
│       ├── api/
│       │   └── v1/
│       │       ├── router.py
│       │       ├── ingest.py       ← provider pushes here (generic)
│       │       ├── contracts.py    ← consumer reads contract state
│       │       ├── milestones.py   ← milestone list, approve, verify
│       │       ├── alerts.py       ← active alerts, history, ack
│       │       ├── analytics.py    ← KPIs, progress metrics
│       │       ├── documents.py    ← file references
│       │       └── websocket.py    ← real-time push to consumer UI
│       ├── models/                 ← SQLAlchemy ORM
│       │   ├── contract.py
│       │   ├── milestone.py
│       │   ├── status_update.py
│       │   ├── alert.py
│       │   ├── document.py
│       │   └── blockchain_event.py
│       ├── schemas/                ← Pydantic request/response DTOs
│       │   ├── ingest.py
│       │   ├── contract.py
│       │   ├── milestone.py
│       │   ├── alert.py
│       │   └── analytics.py
│       ├── pilot_schemas/          ← JSON Schema per pilot (validated on ingest)
│       │   ├── factor_update.json
│       │   ├── tasowheel_update.json
│       │   └── e4m_update.json
│       ├── services/
│       │   ├── monitoring.py       ← processes incoming updates
│       │   ├── milestone.py        ← milestone state transitions
│       │   ├── rule_engine.py      ← evaluates alert conditions
│       │   ├── blockchain.py       ← writes events to MSB
│       │   └── notification.py     ← sends alerts to parties
│       ├── workers/
│       │   ├── blockchain_sync.py  ← background: sync to MSB
│       │   └── alert_evaluator.py  ← background: evaluate rules
│       └── migrations/             ← Alembic
│           ├── env.py
│           └── versions/
│
├── mock-sensors/                   ← Fake factory infrastructure
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── base_simulator.py           ← shared loop + HTTP push logic
│   ├── factor_simulator.py         ← generates metal parts fake data
│   ├── tasowheel_simulator.py      ← generates gears routing fake data
│   ├── e4m_simulator.py            ← generates PCB phase fake data
│   └── scenarios/                  ← named test scenarios (JSON config)
│       ├── factor_normal.json
│       ├── factor_delay.json
│       ├── factor_quality_failure.json
│       ├── tasowheel_normal.json
│       ├── tasowheel_downtime.json
│       ├── e4m_normal.json
│       └── e4m_test_failure.json
│
└── frontend/                       ← React 19 + pnpm
    ├── package.json
    ├── pnpm-lock.yaml
    ├── Dockerfile
    └── src/
        ├── main.tsx
        ├── router.tsx              ← React Router v7
        ├── layouts/
        │   └── DashboardLayout.tsx
        ├── pages/
        │   ├── ContractsList.tsx   ← all active contracts
        │   ├── ContractOverview.tsx← status badge, summary, next milestone
        │   ├── MilestoneTimeline.tsx← visual timeline with statuses
        │   ├── ProductionFeed.tsx  ← latest updates, live metrics
        │   ├── AlertCenter.tsx     ← active alerts, history, acknowledge
        │   ├── Documents.tsx       ← evidence files per milestone
        │   └── Analytics.tsx       ← KPIs and progress charts
        ├── components/
        │   ├── StatusBadge.tsx
        │   ├── MilestoneCard.tsx
        │   ├── AlertItem.tsx
        │   ├── MetricCard.tsx
        │   └── ApprovalAction.tsx
        ├── hooks/
        │   ├── useContract.ts
        │   ├── useWebSocket.ts     ← real-time live updates
        │   └── useAlerts.ts
        └── api/
            └── client.ts           ← typed API client (no raw fetch)
```

---

## 7. API Design

### 7.1 Provider Ingest API (Generic Push Endpoint)

```
POST /api/v1/ingest/{contractId}
Authorization: Bearer {provider_token}
```

**Generic request envelope:**

```json
{
  "updateType": "PRODUCTION_UPDATE | MILESTONE_COMPLETE | QUALITY_EVENT | PHASE_CHANGE | DOCUMENT_UPLOAD",
  "timestamp": "2026-03-16T10:00:00Z",
  "sensorId": "edge-device-001",
  "payload": {
    // validated against pilot_schemas/{pilotType}_update.json
    // shape differs per pilot — see Section 8
  },
  "evidence": ["https://storage.maasai.eu/docs/file.pdf"]
}
```

**Response:**

```json
{
  "updateId": "uuid",
  "contractId": "uuid",
  "processed": true,
  "alertsTriggered": ["ALERT-001"],
  "milestoneUpdated": "M2",
  "blockchainQueued": true
}
```

**Why this is generic:** The `updateType` tells the system how to handle it. The `payload` is validated against a schema registered for the contract's `pilotType`. New pilots add a new JSON schema file — no code changes needed.

---

### 7.2 Consumer API (Read-Only, No Blockchain Jargon)


| Method | Path                                              | Description                        |
| ------ | ------------------------------------------------- | ---------------------------------- |
| `GET`  | `/api/v1/contracts`                               | List all contracts for consumer    |
| `GET`  | `/api/v1/contracts/{id}`                          | Contract overview + current status |
| `GET`  | `/api/v1/contracts/{id}/timeline`                 | All events, chronological          |
| `GET`  | `/api/v1/contracts/{id}/milestones`               | Milestones with statuses           |
| `GET`  | `/api/v1/contracts/{id}/milestones/{mId}`         | Single milestone + evidence        |
| `POST` | `/api/v1/contracts/{id}/milestones/{mId}/approve` | Consumer approves milestone        |
| `POST` | `/api/v1/contracts/{id}/milestones/{mId}/reject`  | Consumer rejects milestone         |
| `GET`  | `/api/v1/contracts/{id}/alerts`                   | Active alerts                      |
| `GET`  | `/api/v1/contracts/{id}/alerts/history`           | All alerts ever fired              |
| `POST` | `/api/v1/contracts/{id}/alerts/{aId}/acknowledge` | Consumer acknowledges alert        |
| `GET`  | `/api/v1/contracts/{id}/analytics`                | KPIs and progress metrics          |
| `GET`  | `/api/v1/contracts/{id}/documents`                | All files linked to contract       |
| `WS`   | `/ws/contracts/{id}`                              | Real-time updates pushed to UI     |


---

### 7.3 PostgreSQL Schema (Core Tables)

```sql
-- Mirrors the blockchain contract with operational state
contracts (
  id UUID PRIMARY KEY,
  blockchain_contract_address VARCHAR,
  pilot_type VARCHAR,          -- FACTOR | TASOWHEEL | E4M
  agreement_type VARCHAR,
  status VARCHAR,              -- PENDING_SIGNATURES | ACTIVE | IN_PROGRESS | ...
  provider_id VARCHAR,
  consumer_id VARCHAR,
  product_name VARCHAR,
  quantity_total INTEGER,
  delivery_date DATE,
  created_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  config JSONB                 -- pilot-specific contract config
)

-- Provider-pushed updates (time-series)
status_updates (
  id UUID PRIMARY KEY,
  contract_id UUID REFERENCES contracts,
  update_type VARCHAR,
  sensor_id VARCHAR,
  timestamp TIMESTAMPTZ,
  payload JSONB,               -- raw validated payload
  processed BOOLEAN
)

-- Trackable goals per contract
milestones (
  id UUID PRIMARY KEY,
  contract_id UUID REFERENCES contracts,
  milestone_ref VARCHAR,       -- M1, M2, TURNING, etc.
  name VARCHAR,
  planned_date DATE,
  actual_date DATE,
  status VARCHAR,              -- PENDING | IN_PROGRESS | SUBMITTED | VERIFIED | APPROVED | COMPLETED | REJECTED
  approval_required BOOLEAN,
  completion_criteria JSONB,
  evidence JSONB
)

-- Generated by rule engine
alerts (
  id UUID PRIMARY KEY,
  contract_id UUID REFERENCES contracts,
  rule_id VARCHAR,
  condition_description TEXT,
  severity VARCHAR,            -- LOW | MEDIUM | HIGH | CRITICAL
  triggered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  blockchain_logged BOOLEAN
)

-- Mirror of MSB blockchain events (for fast UI queries)
blockchain_events (
  id UUID PRIMARY KEY,
  contract_id UUID REFERENCES contracts,
  event_type VARCHAR,
  transaction_hash VARCHAR,
  block_number BIGINT,
  event_data JSONB,
  created_at TIMESTAMPTZ
)
```

---

## 8. Pilot-Specific Data Schemas

### Factor (Metal Parts — P1)

```json
{
  "quantityProduced": 120,
  "quantityPlanned": 500,
  "currentStage": "turning | heat_treatment | grinding | inspection",
  "qualityPassRate": 0.98,
  "qualityRejectCount": 2,
  "machineUtilization": 0.85,
  "shiftsCompleted": 3,
  "estimatedCompletionDate": "2026-04-05"
}
```

**Alert rules:**

- `quantityProduced / quantityPlanned` progress falls behind schedule by > threshold days
- `qualityPassRate` drops below configured threshold (e.g., 0.95)
- No update received within `dataUpdateFrequency` window

---

### Tasowheel (Gears — P2)

```json
{
  "routingStep": 2,
  "stepName": "heat_treatment",
  "stepStatus": "IN_PROGRESS | COMPLETE",
  "setupTimeActualMin": 45,
  "setupTimePlannedMin": 40,
  "cycleTimeActualSec": 125,
  "cycleTimePlannedSec": 120,
  "downtimeMinutes": 0,
  "energyKwh": 145.2,
  "carbonKgCo2e": 58.1,
  "operatorNotes": "..."
}
```

**Alert rules:**

- Downtime exceeds threshold
- Cycle time deviation > X%
- Routing step delayed by > N days vs. planned delivery

---

### E4M (Electronics/PCB — P5)

```json
{
  "currentPhase": "M1_IDEALIZATION | M2_CONCEPT | M3_ENGINEERING | M4_PROTOTYPE | M5_TESTING | M6_PRODUCTION",
  "completionPct": 75,
  "approvalRequired": true,
  "deliverables": [
    { "name": "PCB layout v2", "format": "Gerber", "url": "..." }
  ],
  "testResults": [
    {
      "testType": "AOI | FLYING_PROBE | FUNCTIONAL",
      "result": "PASS | FAIL",
      "defectsFound": 0,
      "notes": "..."
    }
  ],
  "issues": [
    {
      "issueId": "ISS-001",
      "description": "Component sourcing delay",
      "severity": "MEDIUM",
      "status": "OPEN"
    }
  ]
}
```

**Alert rules:**

- Phase behind planned date by > threshold
- Any `testResults` entry with `result: FAIL`
- `approvalRequired: true` but no consumer response within N days
- Open issues with severity `HIGH` or `CRITICAL`

---

## 9. Mock Sensor Infrastructure

### Purpose

Simulate factory data locally without real ERP/MES/Edge device connections. Each simulator:

1. Reads the contract configuration to know what to generate
2. Generates realistic fake data at configurable intervals
3. POSTs to the Provider Ingest API
4. Supports named **scenarios** (normal, delay, quality failure, etc.)

### Scenario System

Scenarios are JSON config files that drive simulator behaviour:

```json
{
  "scenario": "factor_quality_failure",
  "description": "Quality rejection rate spikes at milestone 2",
  "events": [
    { "at_minute": 0, "qualityPassRate": 0.99, "quantityProduced": 50 },
    { "at_minute": 10, "qualityPassRate": 0.99, "quantityProduced": 100 },
    { "at_minute": 20, "qualityPassRate": 0.82, "quantityProduced": 120 },
    { "at_minute": 30, "qualityPassRate": 0.81, "quantityProduced": 140 }
  ]
}
```

### Mock MSB (Local Blockchain Simulation)

For local development, the MSB blockchain is simulated as a simple append-only event log (SQLite or JSON file). The `BlockchainService` has two implementations behind an interface:

```python
class BlockchainService(Protocol):
    async def log_event(self, event_type: str, data: dict) -> BlockchainEvent: ...
    async def get_events(self, contract_id: str) -> list[BlockchainEvent]: ...

class MockMSBService:  # used in dev
    # writes to local SQLite or JSON file
    # returns fake transaction hashes

class RealMSBService:  # used in production
    # calls actual MSB HTTP API
    # returns real block numbers and tx hashes
```

Swap between them via environment variable: `BLOCKCHAIN_ADAPTER=mock|real`

---

## 10. Consumer UI Design

### Design Principle: Zero Blockchain Complexity

The consumer sees **no** block numbers, transaction hashes, gas fees, or contract addresses. All blockchain activity is translated into plain business language.


| Blockchain term           | Consumer sees                              |
| ------------------------- | ------------------------------------------ |
| Contract deployed on MSB  | "Agreement registered"                     |
| Milestone logged on-chain | "Milestone confirmed and recorded"         |
| Transaction hash          | Not shown (available in audit export only) |
| Block confirmation        | Hidden — UI shows "Confirmed" once synced  |


### Pages and Components

**Page 1: Contracts List**

- Table of active contracts
- Status badge per contract (On Track / Delayed / Action Required / Completed)
- Quick stats: milestones done / total, next due date

**Page 2: Contract Overview**

- Large status banner
- Progress bar (milestones complete)
- Key info: product, quantity, delivery date, parties
- Next milestone due + countdown
- Recent activity feed (last 5 events)

**Page 3: Milestone Timeline**

- Visual vertical or Gantt-style timeline
- Each milestone card:
  - Name, planned date, actual date
  - Status icon (pending / in progress / submitted / completed / overdue)
  - "Approve" button if consumer action required
  - Evidence documents attached
- Color coding: green (done) / amber (at risk) / red (overdue) / blue (pending)

**Page 4: Production Feed (Live)**

- Real-time via WebSocket
- Pilot-specific metrics displayed:
  - Factor: qty produced progress bar, quality pass rate gauge, current stage
  - Tasowheel: routing steps checklist, efficiency %, energy/carbon counters
  - E4M: phase progress, test results table, deliverables list
- "Last updated X minutes ago" indicator
- Offline warning if provider stops sending data

**Page 5: Alert Center**

- Active alerts with severity badge
- Alert description in plain language (no technical codes)
- Acknowledge button
- Full alert history with filter by severity/date

**Page 6: Analytics & KPIs**

- Pilot-specific KPIs tracked against targets
- Charts: actual vs. planned timeline, quality trend, efficiency over time
- Export to PDF/CSV for reporting

---

## 11. Docker Compose Setup

### Development (with mock sensors)

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: massai_monitoring
      POSTGRES_USER: massai
      POSTGRES_PASSWORD: massai_dev
    ports: ["5432:5432"]

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql+asyncpg://massai:massai_dev@postgres/massai_monitoring
      BLOCKCHAIN_ADAPTER: mock
      ENVIRONMENT: development
    ports: ["8000:8000"]
    depends_on: [postgres]
    volumes:
      - ./backend:/app  # hot reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    environment:
      VITE_API_URL: http://localhost:8000
    ports: ["3000:3000"]
    volumes:
      - ./frontend/src:/app/src  # hot reload

  mock-factor:
    build: ./mock-sensors
    environment:
      PILOT: factor
      CONTRACT_ID: "contract-factor-001"
      SCENARIO: normal            # normal | delay | quality_failure
      INTERVAL_SECONDS: "10"
      API_URL: http://backend:8000
    depends_on: [backend]

  mock-e4m:
    build: ./mock-sensors
    environment:
      PILOT: e4m
      CONTRACT_ID: "contract-e4m-001"
      SCENARIO: normal
      INTERVAL_SECONDS: "30"
      API_URL: http://backend:8000
    depends_on: [backend]

  mock-tasowheel:
    build: ./mock-sensors
    environment:
      PILOT: tasowheel
      CONTRACT_ID: "contract-tasowheel-001"
      SCENARIO: normal
      INTERVAL_SECONDS: "20"
      API_URL: http://backend:8000
    depends_on: [backend]
```

### Test Scenarios (switch via env)


| Scenario             | Effect on system                                                       |
| -------------------- | ---------------------------------------------------------------------- |
| `normal`             | Steady progress, all milestones on track                               |
| `delay`              | Provider stops sending data after milestone 2 → triggers no-data alert |
| `quality_failure`    | Quality pass rate drops below threshold → triggers quality alert       |
| `milestone_complete` | Provider submits milestone completion → triggers approval flow         |
| `dispute`            | Consumer rejects a milestone → contract enters DISPUTED state          |


---

## 12. Build Order (Solo Developer)

Since one person is handling everything, here is the recommended sequence to always have something working end-to-end:


| Phase  | What to Build                                               | Deliverable                                            |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| **1**  | Repo init, Docker Compose, PostgreSQL schema + seed data    | `docker compose up` works, DB has 3 seeded contracts   |
| **2**  | Provider Ingest API + pilot JSON schema validation          | Can POST fake updates with `curl`                      |
| **3**  | Mock sensor simulators (all 3 pilots, 2 scenarios each)     | Data flows automatically into DB                       |
| **4**  | Consumer read APIs (`/contracts`, `/milestones`, `/alerts`) | Full data available via REST                           |
| **5**  | WebSocket endpoint                                          | Real-time updates working                              |
| **6**  | Mock MSB blockchain service                                 | Blockchain events logged locally                       |
| **7**  | Rule engine (alert conditions per pilot)                    | Alerts fire on `delay` and `quality_failure` scenarios |
| **8**  | React frontend — contracts list + contract overview page    | First visual dashboard                                 |
| **9**  | Milestone timeline page + approval flow                     | Consumer can approve/reject                            |
| **10** | Production feed page (live, WebSocket)                      | Real-time metrics visible                              |
| **11** | Alert center page                                           | Full alert workflow usable                             |
| **12** | Analytics page + KPI charts                                 | All 3 pilot KPIs tracked                               |


---

---

## 13. Blockchain Technology Stack (Real MSB)

> Source: `blockchain.md` — TF Blockchain Documentation v1.0 (February 2025)

This section documents the **actual blockchain infrastructure** already deployed by the MaaSAI team (SLG). Our monitoring tool integrates with this network via its public RPC endpoint.

---

### 13.1 Network Overview


| Component               | Technology                    | Details                                                                |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Blockchain Platform     | **Ethereum (EVM-compatible)** | Full EVM support — smart contracts in Solidity                         |
| Consensus Mechanism     | **Proof of Authority (PoA)**  | Faster than PoW/PoS, suited for private permissioned networks          |
| Blockchain Client       | **Hyperledger Besu**          | Supports custom PoA, flexible enterprise configuration                 |
| Wallet                  | **MetaMask**                  | User interface for signing transactions and interacting with contracts |
| Block Explorer          | **BlockScout**                | Compatible with Besu; monitors transactions, contract calls, blocks    |
| Secondary Explorer      | **Quorum Explorer**           | Provided by Quorum Dev Quickstart setup                                |
| Deployment Tool         | **Quorum Dev Quickstart**     | Docker-based network setup (`ConsenSys/quorum-dev-quickstart`)         |
| Reverse Proxy           | **nginx + Cloudflare DNS**    | Makes endpoints publicly accessible                                    |
| Smart Contract Language | **Solidity**                  | Contracts compiled and deployed on the network                         |


---

### 13.2 Live Network Endpoints


| Endpoint                | URL                                   | Purpose                                            |
| ----------------------- | ------------------------------------- | -------------------------------------------------- |
| **RPC Node**            | `https://entrynet-maasai.euinno.eu`   | Connect wallets, send transactions, call contracts |
| **BlockScout Explorer** | `https://blockscout-maasai.euinno.eu` | View transactions, blocks, contract events         |
| **Quorum Explorer**     | `https://explorer-maasai.euinno.eu`   | Alternative block explorer                         |


> **For our tool:** The `RealMSBService` implementation in our `BlockchainService` adapter calls `https://entrynet-maasai.euinno.eu` via standard Ethereum JSON-RPC. The `explorerUrl` field in blockchain event responses links to `https://blockscout-maasai.euinno.eu`.

---

### 13.3 Infrastructure Deployment

The network runs on a **private VM** (`174.31.154.43`) within SLG's internal network, then exposed publicly via nginx reverse proxy + Cloudflare DNS. The full stack was bootstrapped using the Quorum Dev Quickstart Docker package.

```
[SLG Private VM]
    └── Docker (Quorum Dev Quickstart)
        ├── Hyperledger Besu node (PoA)
        ├── BlockScout container
        └── Quorum Explorer container
            ↓
        nginx (reverse proxy)
            ↓
        Cloudflare DNS
            ↓
        Public endpoints (entrynet / blockscout / explorer)
```

---

### 13.4 Smart Contract Architecture (Current MVP)

The existing smart contracts were designed around the **Barba Stathis food production** pilot as an MVP. They establish the role-based access pattern that our manufacturing monitoring contracts will extend.

**Deployed Contracts:**


| Contract              | Purpose                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `RoleManagement`      | Defines user roles (Admin, Client, Warehouse Manager, Delivery Responsible). Grants/revokes permissions. First deployer becomes Admin. |
| `OrderManagement`     | Logs and stores orders on-chain. Each order gets a unique ID. Admin can edit order details.                                            |
| `WarehouseManagement` | Manages stock levels, checks warehouse adequacy before dispatch, handles restocking events.                                            |
| `DeliveryManagement`  | Tracks delivery stages until package arrival. Marks order complete on delivery.                                                        |


**Contract Inheritance pattern (Solidity):**

- Contracts use OOP inheritance for code reuse
- Child contracts inherit all functions and state from parent
- Reduces redundancy across role-checking logic

**User Roles defined:**


| Role                           | Description                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `Administrator`                | Full access — can call all functions, modify orders/warehouse, grant/revoke roles |
| `Client`                       | Can log new orders and view their own orders                                      |
| `Warehouse Manager` (Provider) | Can view orders, manage stock checks, trigger dispatch                            |
| `Delivery Responsible`         | Can update delivery location/status, mark orders complete                         |


---

### 13.5 How Our Tool Integrates With This Network

**For local development:** Use `BLOCKCHAIN_ADAPTER=mock` — the `MockMSBService` writes events to a local SQLite file, returns fake transaction hashes, and simulates the BlockScout explorer URL pattern.

**For staging/production:** Use `BLOCKCHAIN_ADAPTER=real` — the `RealMSBService` connects to:

- RPC: `https://entrynet-maasai.euinno.eu` (JSON-RPC calls via `web3.py`)
- Explorer links: `https://blockscout-maasai.euinno.eu/tx/{txHash}`

**Key integration points our service handles:**

```python
# What our BlockchainService writes to the MSB network:
# 1. Milestone completion events  → on-chain event log
# 2. High-severity alert events   → on-chain event log
# 3. Contract state transitions   → state update transaction
# 4. Consumer approval signatures → signed transaction from consumer wallet

# What we READ from the network (via BlockScout API or RPC):
# 1. Contract deployment confirmation
# 2. Transaction receipt (block number, timestamp)
# 3. Historical event log for audit export
```

**MetaMask integration for consumer approvals:**
When the consumer approves a milestone that requires on-chain logging, the UI triggers a MetaMask transaction signing flow. The signed transaction is submitted via our backend to the RPC endpoint.

---

### 13.6 Python Library for Ethereum Integration

For the `RealMSBService`, use `web3.py` — the standard Python Ethereum library:

```toml
# pyproject.toml additions
[project.dependencies]
web3 = ">=7.0"
```

```python
# Connecting to the MaaSAI network
from web3 import Web3

w3 = Web3(Web3.HTTPProvider("https://entrynet-maasai.euinno.eu"))
assert w3.is_connected()

# All contract interactions go through this provider
# Contract ABI loaded from compiled Solidity artifacts
```

---

## References

1. MaaSAI Project. (2026). *Pilot 1 FACTOR — Metal Parts Manufacturing as a Service*. 3rd Plenary Meeting Presentation. Tampere, Finland.
2. MaaSAI Project. (2026). *Pilot 2 TASOWHEEL — Optimising a Gears Manufacturing as a Service Production*. 3rd Plenary Meeting Presentation. Tampere, Finland.
3. MaaSAI Project. (2026). *Pilot 5 E4M — Smart Electronics Manufacturing as a Service*. 3rd Plenary Meeting Presentation. Tampere, Finland.
4. MaaSAI Project. (2026). *Blockchain and Smart Contracts Workflow — Project Context and Tool Integration Specification v1.0*. REQUEST.md.

