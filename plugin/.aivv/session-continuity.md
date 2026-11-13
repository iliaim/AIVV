# Session Continuity

Read this before registering progress in an actual `/aivv` or `/aivv-fix` run.
Help, contract lookups, and registry-only early exits do not use it.

An AIVV run often starts in the middle of a larger task that already has a
progress list (for example: two steps done, three pending). AIVV must keep that
list intact, slot its own items in at the current point, and hand control back
when it ends. Host tool names and limits belong in the active platform adapter.

Progress tracking is informational. If a merge cannot be done safely, skip the
list and give short text updates at phase changes instead. A skipped or missing
progress list never skips, delays, weakens, or relabels a review, dispatch, fix,
safety, or verification gate, and it is not a `capability_degradations` entry.

## Progress items

Always use this fixed set. The workflow steps decide what runs; these items only
show where the run is.

| Run | Items, in order | Workflow steps covered |
|---|---|---|
| `/aivv` | `AIVV review: prepare scope`, `AIVV review: run reviewers`, `AIVV review: present and record results` | 1-4, 5, 6-8 |
| `/aivv-fix` | `AIVV fix: collect and triage findings`, `AIVV fix: investigate and plan`, `AIVV fix: apply approved fixes`, `AIVV fix: verify and document` | 1-2, 3-4, 5, 6-7 |

If adding these items would exceed the host's item limit, use one item instead
(`AIVV review: <current phase>` or `AIVV fix: <current phase>`) and update its
text at each phase. If even one item does not fit, use text updates.

## Merge, never replace

1. **No existing list:** create AIVV's items as the whole list.
2. **Nested run:** if unfinished AIVV items from an enclosing run are already on
   the list (a `/aivv --fix` chain, or an outer-loop cycle re-entering `/aivv`),
   this run is nested. Reuse its own items if present (set them back to pending
   for a new cycle); otherwise insert them immediately after the enclosing run's
   in-progress AIVV item. A nested run does not pause or restore user items and
   does not hand back; the outermost run does.
3. **Insertion point:** insert AIVV's items immediately before the in-progress
   item; if none is in progress, before the first pending item; otherwise at
   the end.
4. **Preserve user items:** keep the wording, status, and order of every item
   AIVV did not create. Never complete, edit, or delete them. The one exception:
   where the host allows only one in-progress item, set the in-progress user
   item to pending while AIVV works, remember its prior status, and restore that
   exact status when the run ends.
5. **Whole-list tools** (each write sends the complete list): write only when
   every existing item can be reproduced exactly (wording, status, and order)
   from what is visible now. If any part of the list is missing from view, for
   example after context compaction, do not write a list; use text updates.
6. **Item-by-item tools** (create or update one item at a time): create and
   update only AIVV's items, plus the paused item's status. If the tool cannot
   place an item at the insertion point, use its ordering or dependency fields
   when it has them; otherwise accept AIVV's items at the end. Never delete and
   recreate user items to force an order.

## Hand back

Applies to every ending of the outermost run, with or without a progress list:
normal completion, dry-run halt, a held or cancelled scope question, an exhausted
rework budget, a verification failure, an outer-loop stop, an installation or
stale-cache halt, and a failed skill handoff.

1. **Close AIVV's items:** mark completed the items whose phases ran; remove the
   items whose phases did not run. Remove only items AIVV created. Restore the
   paused item's exact prior status.
2. **Restate what remains:** after AIVV's summary, name the session's remaining
   items in one short line, if there are any.
3. **Continue only on a clean outcome.** Go straight on to the next remaining
   item only when all of these hold:
   - the run completed (not a dry run, not halted, held, or cancelled);
   - no CRITICAL or MAJOR finding is left unresolved;
   - verification passed wherever it ran;
   - no user decision is pending, and the next item does not need user input.

   Otherwise stop after the summary, name the next remaining item as the next
   action, and say what blocks it (for example, open findings or a dry run
   awaiting approval).
4. AIVV's summary is not the end of the session's work while items remain.
   When the session had no list before AIVV started, the run ends as usual.
