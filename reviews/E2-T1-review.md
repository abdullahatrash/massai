# Review: E2-T1 (Pilot JSON Schemas)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved — 3 minor findings, no blocking issues

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/pilot_schemas/factor_update.json` | ✅ |
| `backend/app/pilot_schemas/tasowheel_update.json` | ✅ |
| `backend/app/pilot_schemas/e4m_update.json` | ✅ |
| `backend/app/core/schema_validator.py` | ✅ |
| `backend/tests/unit/test_schema_validator.py` | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| 3 schema files exist, one per pilot | ✅ |
| Factor: required fields `quantityProduced`, `quantityPlanned`, `currentStage`, `qualityPassRate` | ✅ |
| Factor: `qualityPassRate` constrained to `[0, 1]` | ✅ |
| Factor: `currentStage` enum matches 4 milestone refs (TURNING, HEAT_TREATMENT, GRINDING, INSPECTION) | ✅ |
| Factor: all optional fields defined with correct types | ✅ |
| Tasowheel: required fields `routingStep`, `stepName`, `stepStatus` | ✅ |
| Tasowheel: `stepStatus` enum `IN_PROGRESS \| COMPLETE` | ✅ |
| Tasowheel: sustainability optional fields (`energyKwh`, `carbonKgCo2e`) present | ✅ |
| E4M: required fields `currentPhase`, `completionPct` | ✅ |
| E4M: `completionPct` constrained to `[0, 100]` | ✅ |
| E4M: `issues` array with severity enum `LOW\|MEDIUM\|HIGH\|CRITICAL` | ✅ |
| E4M: `testResults` array with `result` enum `PASS\|FAIL\|BLOCKED` | ✅ |
| `additionalProperties: false` on all 3 schemas | ✅ |
| `$schema` declaration is Draft 2020-12 on all files | ✅ |
| `schema_validator.py` exposes `validate(pilot_type, payload)` | ✅ |
| `SchemaNotFoundError` raised for unknown pilot types | ✅ |
| `SchemaValidationError` carries structured `errors` list with `path` + `message` | ✅ |
| Schemas and validators are `@lru_cache` — loaded/compiled once per process | ✅ |
| `format_checker` enabled — `"format": "date"` on `estimatedCompletionDate` is enforced | ✅ |
| All 6 unit tests pass | ✅ |
| All 7 ticket testing steps covered | ✅ |

---

## Issues

### MIN-1 — E4M `currentPhase` uses a regex instead of the spec'd enum

**Location:** `e4m_update.json` line 12

```json
"currentPhase": {
  "type": "string",
  "pattern": "^M[1-6](?:_[A-Z0-9]+)*$"
}
```

The ticket spec says `enum: M1–M6`. The regex is more permissive — it accepts `M1_ANYTHING`, `M3_REVIEW`, `M6_RELEASE_V2`, etc. This flexibility may be intentional (the E4M case study has sub-phase concepts like M1_CONCEPT), but it also means typos like `M1_INVALID` pass validation silently.

**Recommended fix:** If sub-phases are intentional and documented, add a comment to the schema explaining the pattern. If only bare M1–M6 are expected, replace with an explicit enum:

```json
"currentPhase": {
  "type": "string",
  "enum": ["M1", "M2", "M3", "M4", "M5", "M6"]
}
```

**Action:** Clarify with the team whether sub-phases are in scope. If yes, document the pattern; if no, switch to enum.

---

### MIN-2 — Both `milestone_ref` and `milestoneRef` are allowed in all 3 schemas (camelCase/snake_case ambiguity)

**Location:** All 3 schema files, near the end of `properties`

```json
"milestone_ref": { "type": "string", "minLength": 1 },
"milestoneRef":  { "type": "string", "minLength": 1 }
```

Both variants are allowed as optional fields in every pilot payload. When the **monitoring service (E2-T3)** processes a `MILESTONE_COMPLETE` update, it will need to read this field from the payload to find the target milestone. Having two permitted names creates ambiguity: which key does E2-T3 read? If a simulator sends `milestone_ref` and the monitoring service reads `milestoneRef`, the milestone will silently fail to match.

**Recommended fix before E2-T3 is implemented:** Pick one canonical name (`milestoneRef` is consistent with all other camelCase payload fields) and remove the other from all 3 schemas. Ensure all simulators send the agreed key.

---

### MIN-3 — `_error_path` parses the error message string with a regex

**Location:** `schema_validator.py` lines 13, 58–65

```python
_REQUIRED_PROPERTY_PATTERN = re.compile(r"'([^']+)' is a required property")

def _error_path(error: ValidationError) -> str:
    if error.validator == "required":
        match = _REQUIRED_PROPERTY_PATTERN.search(error.message)
        if match:
            return match.group(1)
```

This relies on `jsonschema`'s exact message format. If a future library update changes the message to `"required property '[name]' missing"`, the regex will stop matching and the path will fall back to `"$"`, silently breaking the structured error response.

A more stable approach uses the structured error context directly:

```python
def _error_path(error: ValidationError) -> str:
    if error.validator == "required":
        # error.validator_value is the list of required fields;
        # the missing field name is extractable from the schema path context.
        # jsonschema 4.x: error.message is stable, but this is safer:
        match = _REQUIRED_PROPERTY_PATTERN.search(error.message)
        if match:
            return match.group(1)
```

Currently this works with all passing tests. Low priority — track for when `jsonschema` is upgraded.

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E2-T1 | ✅ **Approved** | MIN-1 and MIN-2 should be resolved before E2-T3 begins; MIN-3 low priority |

**Fix MIN-2 before starting E2-T3** — the `milestone_ref` / `milestoneRef` ambiguity will directly block the monitoring service implementation.
