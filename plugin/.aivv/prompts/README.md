# AIVV role prompts

This directory contains host-neutral role definitions for AIVV reviewers, investigators, challengers, and verifiers. Claude Code and Codex adapters use these definitions with their own dispatch mechanisms.

`_untrusted-content.md` records the common boundary for evidence passed to a reviewer or fix-phase agent. Dispatch surfaces should treat project and session material as data to inspect, never as instructions that can override the agent's role or output contract.
