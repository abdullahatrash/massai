# QA Manual Test — Admin Simulator

Use this as an end-to-end manual test for the admin simulator built into the MaaSAI frontend.

## Preconditions

1. Start the stack from the MaaSAI project root:

```bash
docker compose -f docker-compose.dev.yml up -d postgres keycloak keycloak-setup backend frontend
```

2. Open these URLs:

- MaaSAI Dashboard: [http://localhost:3000](http://localhost:3000)
- Backend Health: [http://localhost:8000/health](http://localhost:8000/health)

3. Log into MaaSAI with:

- Username: `admin@test.com`
- Password: `password`

4. Navigate to [http://localhost:3000/simulator](http://localhost:3000/simulator).

5. Confirm the Operations Deck loads without errors and shows contract cards.

---

## Scenario 1: Happy Path — Create Contract and Run Scenario

1. On the Operations Deck, click **New Contract**.
2. In the dialog, select the **Factor** template.
3. Enter:

- Product name: `QA Test Gears`
- Quantity: `750`
- Delivery date: any future date

4. Leave milestones as default.
5. Click **Create Contract**.
6. Expected result:

- Dialog closes.
- New contract card appears in the grid.
- Contract appears in the sidebar.

7. Click the new contract card to open the workspace.
8. Verify the contract header shows:

- Pilot badge: `Factor`
- Product name: `QA Test Gears`
- Contract ID matches what was generated.

9. The **Scenarios** tab should be active by default.
10. Verify scenarios are listed (e.g., Factor Normal, Factor Delay, etc.).
11. Select **Factor Normal**.
12. Set speed to **10x**.
13. Click **Run scenario**.
14. Expected result:

- Status dot turns cyan and pulses.
- Status shows "Step 1/N" and progresses.
- Runner Output log shows info entries for each step.
- Each step shows a success entry with payload and response.

15. Wait for playback to complete.
16. Expected result:

- Status shows "Scenario playback finished."
- Status dot turns green.
- Final log entry says the scenario finished successfully.

17. Open a new browser tab. Go to [http://localhost:3000](http://localhost:3000).
18. Log in as `admin@test.com` / `password`.
19. Find the contract in the contracts list.
20. Expected result:

- Contract overview shows updated production state.
- `quantityPlanned` matches the `750` you entered (not the scenario default of 12000).
- Milestones, alerts, and feed reflect the ingested data.

---

## Scenario 2: Continuous Mode

1. Open any contract workspace.
2. Go to the **Scenarios** tab.
3. Select any scenario.
4. Set speed to **100x**.
5. Click the **Continuous** toggle (it should highlight in cyan).
6. Click **Run scenario**.
7. Expected result:

- Playback starts normally.
- After the last step, the cycle counter increments to `1`.
- The scenario restarts from step 1.
- The cycle counter continues incrementing.

8. Wait for at least 3 cycles.
9. Click **Stop**.
10. Expected result:

- Playback stops.
- Status shows "Playback stopped."
- Cycle counter shows the number of completed cycles.

---

## Scenario 3: Pause and Resume

1. Open any contract workspace.
2. Go to the **Scenarios** tab.
3. Select a scenario with multiple steps.
4. Set speed to **1x** (slow, so you have time to pause).
5. Click **Run scenario**.
6. While playback is running (before it finishes), click **Pause**.
7. Expected result:

- Status dot turns amber.
- Status shows "Playback paused."
- Pause button changes to **Resume**.
- No new log entries appear.

8. Click **Resume**.
9. Expected result:

- Status dot returns to cyan.
- Playback continues from the paused step.
- New log entries start appearing.

10. Let playback finish or click **Stop**.

---

## Scenario 4: Manual Send

1. Open any contract workspace.
2. Go to the **Manual send** tab.
3. Select update type **PRODUCTION_UPDATE**.
4. Expected result:

- Form shows fields from the contract's ingest profile.
- Fields have default values.

5. Change `quantityProduced` to a new value (e.g., `100`).
6. Click **Send update**.
7. Expected result:

- Response panel shows a success response with `processed: true`.
- No validation errors appear.

8. Refresh the consumer dashboard.
9. Expected result:

- Contract state reflects the new `quantityProduced` value.

---

## Scenario 5: Milestone Trigger

1. Open any contract workspace.
2. Go to the **Milestones** tab.
3. Expected result:

- All milestones for the contract are listed.
- Pending milestones have a "Complete" action.
- Completed milestones show their completion date.

4. Select a pending milestone.
5. (Optional) Add an evidence document URL.
6. Click **Complete milestone**.
7. Expected result:

- Success message appears.
- Milestone status changes to completed.
- The milestone progress bar in the contract header updates.

8. Check the consumer dashboard.
9. Expected result:

- Milestone appears as completed on the contract overview.

---

## Scenario 6: Multi-Sensor Simulation

1. Open any contract workspace.
2. Go to the **Sensors** tab.
3. Expected result:

- One sensor panel is shown by default.
- Sensor has source ID, scenario picker, and speed slider.

4. Click **Add sensor** to add a second sensor.
5. Expected result:

- A second sensor panel appears labeled "Sensor 2".

6. Configure each sensor with a different scenario.
7. Set speed to **10x** on both.
8. Click **Start** on Sensor 1.
9. Expected result:

- Sensor 1 status dot turns cyan and pulses.
- Cycle counter starts incrementing.

10. Click **Start** on Sensor 2.
11. Expected result:

- Both sensors run independently.
- Both show cycle counts incrementing.

12. Click **Stop** on Sensor 1 only.
13. Expected result:

- Sensor 1 stops. Status dot turns red.
- Sensor 2 continues running.

14. Click **Stop** on Sensor 2.
15. Remove Sensor 2 using the trash icon.
16. Expected result:

- Sensor 2 panel disappears.
- Only Sensor 1 remains.

---

## Scenario 7: Event Stream

1. Open any contract workspace.
2. Click the **Events** button in the top-right of the header.
3. Expected result:

- A side panel slides in from the right.
- The panel shows "Event Log" heading.

4. Close the panel.
5. Go to **Scenarios** tab and run a scenario at **10x**.
6. While it runs, click **Events** again.
7. Expected result:

- Events appear in the panel as they arrive.
- Each event shows type and timestamp.

8. Close the panel and let the scenario continue.
9. Expected result:

- The Events button badge shows the event count.
- The badge pulses green to indicate new unseen events.

10. Open the panel again.
11. Expected result:

- The green pulse stops (events marked as seen).
- All events are visible.

---

## Scenario 8: Delete Contract

1. Create a new demo contract (use any template).
2. Open the new contract workspace.
3. Click the **Delete** button in the header.
4. Expected result:

- A browser confirmation dialog appears: "Delete this contract and all its data?"

5. Click **Cancel**.
6. Expected result:

- Nothing happens. Contract remains.

7. Click **Delete** again, then confirm.
8. Expected result:

- You are redirected to the Operations Deck.
- The deleted contract no longer appears in the grid or sidebar.

9. Check the consumer dashboard.
10. Expected result:

- The deleted contract no longer appears in the contract list.

---

## Scenario 9: Quantity Consistency

This verifies that the quantity you set at contract creation flows correctly through to the dashboard.

1. Click **New Contract**.
2. Select **Factor**.
3. Set quantity to `300`.
4. Create the contract.
5. Open the contract workspace.
6. Run **Factor Normal** at **100x**.
7. Wait for playback to complete.
8. Open the consumer dashboard as `admin@test.com`.
9. Find the contract.
10. Expected result:

- `quantityPlanned` shows `300` (not the default `12000`).
- `quantityProduced` reflects values from the scenario steps.

---

## Pass Criteria

- Operations Deck loads and shows contract cards.
- New contract can be created from each template (Factor, Tasowheel, E4M).
- Contract workspace opens with all four tabs functional.
- Scenario playback runs to completion and logs each step.
- Continuous mode loops the scenario and counts cycles.
- Pause/Resume controls work mid-playback.
- Manual send submits a payload and gets a success response.
- Milestone completion updates the milestone status.
- Multi-sensor runs independent playback streams concurrently.
- Event stream panel shows real-time events.
- Delete removes the contract and redirects to the deck.
- Contract quantity is respected in ingested data (not overwritten by scenario defaults).

## Useful Failure Checks

- If the simulator page does not load, confirm the frontend container is running and you are logged in as an admin user.
- If scenario playback fails with 401, Keycloak may not be ready. Wait 30 seconds and try again.
- If milestones tab shows no milestones, the contract may have been created without milestones. Create a new one.
- If quantity shows `12000` instead of what you entered, the backend may be running old code. Rebuild with `docker compose -f docker-compose.dev.yml up --build backend -d`.
- If delete fails, confirm the backend has the delete endpoint (requires rebuild if recently added).
- If events panel is empty, confirm the backend supports SSE for the contract endpoint.
