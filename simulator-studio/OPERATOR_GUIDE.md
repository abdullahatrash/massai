# MaaSAI Factory Simulator Studio

This guide is for operators, sales demos, and client walkthroughs.
You do not need to edit code to use the simulator.

## What The Studio Does

The studio lets you:

1. Create a demo factory from one of the built-in pilot templates.
2. Adjust the contract profile, milestones, and sensors.
3. Provision that factory as a real contract inside MaaSAI.
4. Stream simulated factory data into MaaSAI.
5. Show the client how the dashboard reacts in real time.

## Start The Demo

From the MaaSAI project folder, start the required services:

```bash
docker compose -f docker-compose.dev.yml up -d postgres keycloak keycloak-setup backend frontend simulator-studio
```

Then open:

- Studio: [http://localhost:3001](http://localhost:3001)
- MaaSAI dashboard: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:8000/health](http://localhost:8000/health)

Use this dashboard login:

- Username: `admin@test.com`
- Password: `password`

## The Demo Flow

### 1. Create a factory

Open the `Factory Catalog` section in the studio.

Pick one starting pilot:

- `Factor`
- `Tasowheel`
- `E4M`

Then fill in:

- Factory name
- Factory key
- Product name
- Quantity
- Delivery date

Select `Create factory`.

### 2. Review the factory setup

Open the new factory and check:

- product
- milestones
- delivery date
- provider client
- default ingest profile

Use the `Factory Setup` tab to adjust milestone names, planned dates, and approval flags.

### 3. Adjust the ingest profile

Open the `Ingest Profile` tab.

Use `builtin` mode if you want the standard pilot profile.

Use `custom` mode if you want to show a client-specific variation, for example:

- fewer fields
- different labels
- different defaults
- different required fields

This is useful when explaining that MaaSAI owns the canonical data model, while each factory can still have a controlled profile variation.

### 4. Add or edit sensors

Open the `Sensors` tab.

Each sensor represents a data source that sends one update stream into MaaSAI.

For each sensor you can control:

- source ID
- update type
- scenario
- interval
- enabled or disabled state

Examples:

- production line sensor
- quality gate sensor
- milestone completion trigger
- phase tracker

### 5. Provision the contract into MaaSAI

Open the `Provision` tab and select `Provision demo contract`.

This step creates a real demo contract in MaaSAI and binds the selected ingest profile snapshot to it.

The studio also updates Keycloak so the shared provider service account is allowed to send data for that contract.

After this step, the factory is no longer just local studio data. It becomes a real MaaSAI contract.

### 6. Open the MaaSAI dashboard

From the `Provision` tab, open:

- the contract dashboard
- the MaaSAI simulator view

Keep MaaSAI open in a second browser tab or on a second screen during the demo.

### 7. Send data

Open the `Run Console` tab.

You can:

- `Run one cycle` to send one batch of updates
- `Start streaming` to send updates continuously
- `Stop streaming` to pause the stream

As data is sent, the run console shows:

- the exact request payload
- MaaSAI’s response
- any errors

At the same time, MaaSAI updates:

- contract overview
- milestones
- alerts
- feed
- analytics inputs

## How Everything Connects

Use this explanation when presenting to a client:

```text
Factory Simulator Studio
  -> creates a demo factory and contract shape
  -> optionally creates a custom ingest profile
  -> provisions a real contract into MaaSAI
  -> sends factory updates to the v2 ingest API

Keycloak
  -> authenticates the shared provider service account
  -> allows that provider to send data for the selected contract

MaaSAI Backend
  -> validates the data against the contract-bound ingest profile
  -> stores the update
  -> updates contract state
  -> evaluates milestones and alerts
  -> exposes the contract to the frontend

MaaSAI Frontend
  -> shows the buyer dashboard
  -> displays milestones, alerts, feed, and contract health
```

## What To Say During The Demo

A simple narrative that works well:

1. "We start from a standard pilot template."
2. "We configure the factory, contract, and the sensors it will use."
3. "We bind a profile that defines exactly what data MaaSAI expects."
4. "The factory can keep its own systems, but the data enters MaaSAI through this canonical contract."
5. "Now we stream live updates."
6. "The buyer sees milestones, issues, and progress without chasing the supplier."

## Troubleshooting

If the studio page does not open:

```bash
docker compose -f docker-compose.dev.yml ps
```

If the dashboard opens but login fails, confirm Keycloak finished setup and use:

- Username: `admin@test.com`
- Password: `password`

If provisioning fails:

- make sure `backend`, `keycloak`, and `keycloak-setup` are running
- refresh the studio and try again

If streaming fails:

- make sure the contract was provisioned first
- confirm at least one sensor is enabled
- check the `Run Console` error output

## Recommended Demo Sequence

For the cleanest client story:

1. Start with `Factor`
2. Create a new factory
3. Show the profile and sensor setup
4. Provision the contract
5. Open the contract dashboard
6. Run one cycle
7. Start streaming
8. Point out alerts, milestones, and progress changes in MaaSAI
