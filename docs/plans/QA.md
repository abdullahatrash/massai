**QA Manual Test**

Use this as an end-to-end manual test for the full studio flow.

**Preconditions**

1. Start the stack from `/Users/abodiatrash/projects/massai`:

```bash
docker compose -f docker-compose.dev.yml up -d postgres keycloak keycloak-setup backend frontend simulator-studio
```

1. Open these URLs:

- Studio: [http://localhost:3001](http://localhost:3001)
- Operator Guide: [http://localhost:3001/Operator_Guide](http://localhost:3001/Operator_Guide)
- MaaSAI Dashboard: [http://localhost:3000](http://localhost:3000)

1. Log into MaaSAI with:

- Username: `admin@test.com`
- Password: `password`

1. Confirm the studio opens without errors and the Operator Guide page shows the flow diagram.

**Scenario 1: Happy Path, New Factory To Live Updates**

1. In the Studio home page, go to `Factory Catalog`.
2. In `Create factory`, choose `Factor`.
3. Enter:

- Factory name: `QA Factor Demo`
- Factory key: `qa-factor`
- Product name: `QA Gear Batch`
- Quantity total: `500`
- Delivery date: any future date

1. Click `Create factory`.
2. Expected result:

- A new factory card appears in `Demo Factories`.
- That factory becomes the active factory.
- The selected card should not show `Open factory`.
- If not provisioned yet, it should show `Provision to open simulator`.

1. Open the `Factory Setup` tab.
2. Verify:

- Pilot is `FACTOR`
- Provider client is `provider-factor-sa`
- Contract ID looks like `contract-factor-qa-factor-001`
- Milestones are visible

1. Change one milestone name or planned date.
2. Click `Save milestones`. pass
3. Expected result: pass

- Success message appears.
- Refreshing the page keeps the milestone change.

1. Open the `Ingest Profile` tab.
2. Leave `Profile mode` as `builtin`.
3. Verify fields are visible for the Factor update types.
4. Do not change anything for this scenario.
5. Open the `Sensors` tab.
6. Verify at least one enabled sensor exists.
7. Confirm there is a `PRODUCTION_UPDATE` sensor with a scenario like `factor_normal`.
8. Open the `Provision` tab.
9. Click `Provision demo contract`.
10. Expected result:

- Success message appears.
- Factory status becomes provisioned.
- The selected card now shows `Open simulator`.
- `Open contract dashboard` and `Open MaaSAI simulator view` links are available.

1. Click `Open contract dashboard`.
2. Expected result:

- The contract opens in MaaSAI.
- Contract overview page loads without error.

1. Go back to the Studio and open `Run Console`.
2. Click `Run one cycle`.
3. Expected result:

- A new log entry appears.
- The log shows a request payload.
- The log shows a MaaSAI response, not an error.

1. Return to the dashboard contract page.
2. Refresh if needed.
3. Expected result:

- Contract feed or overview reflects the new update.
- Progress fields or state change from the ingested payload are visible.

1. Back in Studio, click `Start streaming`.
2. Wait 30 to 60 seconds.
3. Expected result:

- Multiple successful run log entries appear.
- Dashboard data continues changing over time.
- If the scenario includes degraded quality or milestone logic, alerts or milestone status may change.

1. Click `Stop streaming`.
2. Expected result:

- New log entries stop appearing after a short delay.

**Scenario 2: Custom Profile Flow**

1. Create a second factory from `Factor` or `E4M`.
2. Open `Ingest Profile`.
3. Change `Profile mode` to `custom`.
4. Change:

- Profile key to something unique like `QA_FACTOR_CUSTOM`
- Profile version to `1`
- One field label
- One default value
- One required field selection

1. Click `Save profile definition`.
2. Open `Provision`.
3. Click `Provision demo contract`.
4. Expected result:

- Provision succeeds.
- MaaSAI accepts the custom profile version.
- Factory remains usable in the run console.

1. Click `Run one cycle`.
2. Expected result:

- Ingest succeeds with the custom profile.
- No schema validation error appears in the run log.

**Scenario 3: Guardrail Check**

1. Create a fresh factory but do not provision it.
2. Look at the selected factory card.
3. Expected result:

- The button says `Provision to open simulator`.
- It is disabled.
- There is no misleading live simulator link before the contract exists in MaaSAI.

**Pass Criteria**

- Studio loads on `3001`
- Operator Guide loads and shows the architecture flow diagram
- New factory can be created
- Milestones can be edited and saved
- Built-in or custom profile can be used
- Provisioning creates a real MaaSAI contract
- Selected factory card changes to `Open simulator` after provisioning
- Run console can send successful v2 ingest updates
- MaaSAI dashboard reflects the incoming data

**Useful Failure Checks**

- If provisioning fails, check that `backend`, `keycloak`, and `keycloak-setup` are running.
- If streaming fails, confirm the factory was provisioned and at least one sensor is enabled.
- If dashboard data does not change, inspect the latest run log payload/response in the Studio.

If you want, I can turn this into a formal QA test case template with:

- `Test ID`
- `Preconditions`
- `Steps`
- `Expected Result`
- `Actual Result`
- `Pass/Fail`

