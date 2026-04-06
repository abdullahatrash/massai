---
name: verify
description: Run the backend test suite and report results. Use after making backend changes to verify nothing is broken.
---

Run the backend pytest suite and report results:

```bash
cd backend && uv run pytest -ra
```

If tests fail:
1. Read the failure output carefully
2. Identify the root cause
3. Fix the failing code
4. Re-run the specific failing test with `uv run pytest -k 'test_name' -v`
5. Once fixed, re-run the full suite to confirm no regressions
