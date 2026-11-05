## Schema Migration Notes

Each cycle's breaking schema changes are documented here as separate ### subsections, appended chronologically.

### Cycle C (dev.161)

Renamed the `complexity` field (formerly on `root_cause_analysis`) to `investigation_mode` (now set by the orchestrator at triage and passed as investigator dispatch context). Migration mapping for in-flight state files carrying the legacy `complexity` field:

| Legacy `complexity` value | New `investigation_mode` value |
|---|---|
| `simple` | `skip-permitted` |
| `moderate` | `standard` |
| `complex` | `instrumentation-first` |

The `containment-first` value is new with no legacy equivalent.
