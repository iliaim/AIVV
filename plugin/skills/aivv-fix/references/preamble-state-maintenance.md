# Preamble State Maintenance

Read [`.aivv/state-maintenance.md`](../../../.aivv/state-maintenance.md) before
Step 1.0. Bind the shared target/storage context first; there is no provisional
cwd pass. The shared contract owns schema checks, external-only stale-session
reaping (Stale-session reaper), explicit archival, import visibility, scratch ownership, and warning
surfacing. Legacy history is read-only. `/aivv-fix --dry-run` never initializes,
imports, reaps, or writes recovery state.
