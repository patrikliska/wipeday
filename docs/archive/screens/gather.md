# Screen: `gather` (result)

**Reached from:** `base` -> Gather or Collect. **Visibility:** the home message itself
(edited in place); there is no separate result message.

## Purpose
Rule 10: every click changes something visible. Both actions re-render the base screen
with the deltas in the details line: `+214 wood · +160 stone`. Gather adds `Gather bonus`
to the line; Collect with nothing waiting shows `Nothing to collect yet`.

## Follow-up (rule 2)
The advisor recomputes the primary after the action, so the natural next step is already
highlighted (usually Tools once the upgrade becomes affordable).

## Idempotency
Collect consumes the accrual window inside one transaction: a double click banks once and
the second click shows `+0`. Gather checks the cooldown inside the same transaction.
