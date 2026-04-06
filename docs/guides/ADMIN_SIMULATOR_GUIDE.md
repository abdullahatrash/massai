# MaaSAI Admin Simulator — Operator Guide

This guide is for operators, QA testers, and anyone running demos from the MaaSAI dashboard.
You do not need to edit code to use the simulator.

## What The Admin Simulator Does

The admin simulator is built into the MaaSAI frontend. It lets you:

1. View all active contracts in one dashboard.
2. Create new demo contracts from pilot templates (Factor, Tasowheel, E4M).
3. Run scenario playback to push simulated data into a contract.
4. Trigger milestones manually with evidence attachments.
5. Send custom manual payloads for any update type.
6. Run multiple sensors concurrently on one contract.
7. Monitor live events in the real-time event stream.
8. Delete demo contracts when done.

## Prerequisites

Start the required services from the MaaSAI project folder:

```bash
docker compose -f docker-compose.dev.yml up -d postgres keycloak keycloak-setup backend frontend
```

Then open:

- MaaSAI dashboard: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:8000/health](http://localhost:8000/health)

Log in with:

- Username: `admin@test.com`
- Password: `password`

After login, navigate to the simulator at [http://localhost:3000/simulator](http://localhost:3000/simulator).

## The Simulator Layout

The simulator has two main views:

1. **Operations Deck** — the landing page showing all contracts as cards with stats.
2. **Contract Workspace** — the detail view for a single contract, with four tabs.

The sidebar on the left shows all available contracts. Click any contract to open its workspace.

---

## Step-by-Step Guide

### 1. Open the Operations Deck

After logging in, go to `/simulator`. You will see:

- **Stat cards** at the top: total contracts, pilot types, average milestone completion, telemetry status.
- **Contract grid** below: one card per contract showing pilot type, product name, milestone progress, and status badge.

### 2. Create a new contract

Click the **New Contract** button in the top-right of the Operations Deck.

A dialog opens with three steps:

#### a. Choose a template

Pick one of the three pilot types:

| Template | Pilot | Default Product | Default Quantity |
|----------|-------|----------------|-----------------|
| Factor | FACTOR | Helical Gear Type A - Demo Batch | 1200 |
| Tasowheel | TASOWHEEL | Precision Wheel Hub Assemblies | 500 |
| E4M | E4M | Energy Transition Demonstrator | 1 |

#### b. Edit contract details

The form is pre-filled from the template. You can change:

- **Contract ID** — unique identifier (auto-generated, but editable).
- **Product name** — what the contract is for.
- **Quantity** — total planned quantity. This is important: the quantity you set here is what appears on the consumer dashboard as "planned".
- **Delivery date** — expected delivery.

#### c. Edit milestones

Each template comes with pre-configured milestones. You can:

- Change milestone names, refs, and planned dates.
- Toggle whether a milestone requires approval.
- Add new milestones with the **Add milestone** button.
- Remove milestones with the trash icon.

Click **Create Contract** to submit. The new contract appears immediately in the sidebar and the contract grid.

### 3. Open a contract workspace

Click any contract card (or use the sidebar). The workspace has four tabs:

- **Scenarios** — automated scenario playback
- **Manual send** — custom payload submission
- **Milestones** — milestone trigger and approval
- **Sensors** — multi-sensor concurrent simulation

### 4. Run scenario playback (Scenarios tab)

This is the primary way to push data into a contract.

#### a. Select a scenario

Each pilot type has multiple scenarios. For example, Factor has:

- **Factor Normal** — standard production flow
- **Factor Delay** — production falls behind schedule
- **Factor Dispute** — quality issues trigger alerts
- **Factor Quality Failure** — quality rate drops below threshold
- **Factor Milestone Complete** — completes a milestone stage

Click a scenario card to select it. The card shows the scenario name, step count, and description.

#### b. Set the speed

Use the **Speed** slider to control playback speed:

- **1x** — real-time delays between steps (good for demos)
- **10x** — faster (good for testing)
- **100x** — near-instant (good for bulk data loading)

#### c. Enable continuous mode (optional)

Click the **Continuous** toggle to loop the scenario indefinitely. When enabled:

- The scenario replays from step 1 after the last step.
- A cycle counter shows how many complete loops have run.
- Use this to build up a rich data history in the contract.

#### d. Start playback

Click **Run scenario**. The status indicator turns cyan and pulses.

During playback you can see:

- **Status panel** — current step number and description.
- **Runner Output** — detailed log of every step, including the payload sent and the backend response.

#### e. Control playback

- **Pause** — freezes playback at the current step. The status turns amber.
- **Resume** — continues from where you paused.
- **Stop** — aborts playback entirely.

#### f. Check results

After playback, open the consumer dashboard in another tab ([http://localhost:3000](http://localhost:3000), log in as `consumer-factor@test.com` / `password`) to see:

- Updated contract state (production stage, quantity produced, quality rate)
- Milestone progress
- Alerts (if the scenario triggers quality or delay conditions)
- Timeline feed entries

### 5. Send manual payloads (Manual send tab)

Use this tab to send a single custom update to the contract.

1. Select an **update type** (PRODUCTION_UPDATE, QUALITY_EVENT, PHASE_CHANGE, MILESTONE_COMPLETE).
2. The form shows all fields from the contract's ingest profile with their current values.
3. Edit any field values.
4. Optionally attach **evidence** documents (URLs).
5. Click **Send update**.
6. The response panel shows the backend's response or any validation errors.

This is useful for:

- Testing specific field combinations.
- Triggering a specific alert condition.
- Sending edge-case payloads.

### 6. Trigger milestones (Milestones tab)

This tab shows all milestones for the contract with their current status.

For each pending milestone:

1. Click the milestone card to expand it.
2. Optionally attach evidence documents.
3. Click **Complete milestone**.
4. The milestone status changes and the consumer dashboard reflects the update.

This is useful for:

- Advancing the contract through its stages.
- Testing milestone approval workflows.
- Demonstrating how milestones appear on the buyer dashboard.

### 7. Run multiple sensors (Sensors tab)

Use this tab to simulate multiple data sources pushing to the same contract simultaneously.

1. The panel starts with one sensor. Click **Add sensor** to add more.
2. For each sensor, configure:
   - **Source ID** — unique identifier for this data source (auto-generated).
   - **Scenario** — which scenario this sensor replays.
   - **Speed** — playback speed (1x, 10x, 100x).
3. Click **Start** on each sensor independently.
4. Each sensor has its own status indicator and cycle counter.
5. Click **Stop** to halt a sensor. Use the trash icon to remove it.

This is useful for:

- Simulating a factory with multiple production lines.
- Testing how MaaSAI handles concurrent data from different sources.
- Building up high-volume data quickly.

### 8. Monitor the event stream

Click the **Events** button in the top-right of any contract workspace. A side panel slides out showing:

- Real-time server-sent events for this contract.
- Each event includes type, timestamp, and payload.
- A badge on the Events button shows the count and pulses green when new events arrive.

This is useful for:

- Confirming that data you sent actually reached the backend.
- Watching how the backend processes updates in real time.
- Debugging when something doesn't appear on the dashboard.

### 9. Delete a contract

In the contract workspace header, click the **Delete** button (trash icon).

- A confirmation dialog appears.
- Deleting removes the contract and all its data (milestones, alerts, status updates, notifications).
- You are redirected back to the Operations Deck.

Use this to clean up demo contracts after testing.

---

## Quick Reference

| Action | Where | How |
|--------|-------|-----|
| Create contract | Operations Deck | **New Contract** button |
| Run scenario | Contract > Scenarios tab | Select scenario, click **Run scenario** |
| Loop scenario | Contract > Scenarios tab | Toggle **Continuous**, then **Run scenario** |
| Pause/resume | Contract > Scenarios tab | **Pause** / **Resume** buttons |
| Send manual update | Contract > Manual send tab | Fill fields, click **Send update** |
| Complete milestone | Contract > Milestones tab | Select milestone, click **Complete milestone** |
| Multi-sensor | Contract > Sensors tab | **Add sensor**, configure, **Start** each |
| View events | Contract workspace | **Events** button (top-right) |
| Delete contract | Contract workspace | **Delete** button (top-right) |

## Test Accounts

| Username | Password | Role | Sees contracts |
|----------|----------|------|---------------|
| `admin@test.com` | `password` | Admin | All contracts |
| `consumer-factor@test.com` | `password` | Consumer | Factor contracts |
| `consumer-e4m@test.com` | `password` | Consumer | E4M contracts |

## How Everything Connects

```
Admin Simulator (frontend)
  -> creates demo contracts via the v2 admin API
  -> sends simulated updates to the v2 ingest API
  -> authenticates as the provider service account via Keycloak

Keycloak
  -> issues tokens for the provider service account
  -> the simulator uses client_credentials flow (no manual login needed)

MaaSAI Backend
  -> validates data against the contract-bound ingest profile
  -> stores the update and updates contract state
  -> evaluates milestones and alert conditions
  -> pushes events via server-sent events (SSE)

Consumer Dashboard
  -> shows the buyer view of the contract
  -> displays milestones, alerts, feed, and analytics
  -> updates in real time via WebSocket
```

## Troubleshooting

**Simulator page does not load**

- Confirm the frontend container is running: `docker compose -f docker-compose.dev.yml ps`
- Check you are logged in as `admin@test.com`

**"No provider service account configured"**

- The contract's pilot type does not match a known provider. Only `FACTOR`, `TASOWHEEL`, and `E4M` are supported.

**Scenario playback fails with 401**

- The provider service account token may have expired. Stop and restart the scenario.
- Confirm Keycloak is running and healthy.

**Dashboard does not update after playback**

- Refresh the dashboard page.
- Check the Runner Output log for errors in the scenario responses.
- Open the Events panel to confirm events are arriving.

**Delete button does nothing**

- The backend must be running and rebuilt with the delete endpoint.
- Check the browser console for network errors.

**Contract shows wrong quantity**

- Quantity on the consumer dashboard comes from ingested data, not just the contract record.
- Running a scenario automatically uses the contract's quantity. If you see old values, run a new scenario to overwrite them.

## Recommended Demo Sequence

For a clean demo walkthrough:

1. Open the simulator at `/simulator`
2. Click **New Contract** and pick **Factor**
3. Set quantity to `500` and a future delivery date
4. Create the contract
5. Open the new contract from the grid
6. Go to **Scenarios** tab, select **Factor Normal**
7. Set speed to **10x**
8. Click **Run scenario**
9. While it runs, open a second tab as `consumer-factor@test.com`
10. Point out the contract state, milestones, and alerts updating
11. Back in the simulator, go to **Milestones** tab
12. Complete the first pending milestone
13. Show the milestone appearing as completed on the consumer dashboard
14. Optionally enable **Continuous** mode to build up data history
15. When done, **Delete** the demo contract
