# E3-T6 Review — Documents API Endpoint

**Date:** 2026-03-16  
**Ticket:** E3-T6: Documents API Endpoint  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — no blocking issues, 4 minor findings

---

## Summary

`GET /contracts/{id}/documents` and `GET /contracts/{id}/milestones/{mId}/documents` are
correctly implemented and all 5 integration tests pass. Evidence aggregation, sort order,
optional `milestoneId` filter, 403 guard, and empty-array semantics all match the ticket spec.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | `GET /documents` — flat list aggregated across milestones | ✅ |
| 2 | Response fields: `id`, `milestoneId`, `milestoneName`, `name`, `url`, `format`, `uploadedAt` | ✅ |
| 3 | Sourced from `milestones.evidence` JSONB | ✅ |
| 4 | Ordered by `uploadedAt` descending | ✅ |
| 5 | Optional `?milestoneId=M2` filter | ✅ |
| 6 | `GET /milestones/{mId}/documents` — single milestone | ✅ |
| 7 | Files: `documents.py`, `schemas/document.py` | ✅ |
| 8 | Consumer token for wrong contract → 403 | ✅ |
| 9 | Empty evidence → `[]`, not 404 | ✅ |
| 10 | Router registered in `router.py` | ✅ |

**Test results:** 5/5 passed

---

## Findings

### MIN-1 — `_assert_contract_access` duplicated again (6th copy)

`documents.py` adds a sixth identical copy of `_assert_contract_access` across
`contracts.py`, `milestones.py`, `timeline.py`, `alerts.py`, `analytics.py`,
and `documents.py`. This helper belongs in `app/core/contracts.py` and should be
imported everywhere.

### MIN-2 — `?milestoneId` filters by `milestone_ref`, not UUID

```python
# documents.py:148-153
milestone_ref: Annotated[str | None, Query(alias="milestoneId")] = None
...
milestones = [m for m in milestones if m.milestone_ref == milestone_ref]
```

The query param is named `milestoneId` but accepts a logical ref string (e.g., `M2`,
`TURNING`), not a UUID. This matches the ticket spec (`?milestoneId=M2`) but is
semantically misleading. The internal variable name `milestone_ref` makes the intent
clear. Consider renaming the query param to `?milestoneRef` for clarity, or add an
OpenAPI description clarifying the expected value.

### MIN-3 — No sorting test with multiple milestones

The test `test_contract_documents_returns_aggregated_document_references` only checks
that one document is returned (the APPROVAL_NOTE entry is skipped, so there's only one
valid document per milestone). There is no test that places documents from two different
milestones with different `uploadedAt` values and verifies they are returned newest-first.

### MIN-4 — `_get_milestone` duplicated from `milestones.py`

`documents.py` re-implements `_get_milestone` (lines 34–61) which is identical to the
same private helper in `milestones.py`. Should be extracted to `app/core/contracts.py`
alongside `get_contract_by_public_id`.

---

## No blocking issues

Evidence entries that are raw URL strings or missing required fields (`url`, `name`) are
silently skipped rather than raising — this is the correct behaviour for an aggregation
endpoint that should never fail due to malformed legacy evidence. The fallback `id`
(`"{milestone.id}:{index}"`) is positionally stable as long as evidence arrays are not
reordered, which is acceptable for reference-only documents.
