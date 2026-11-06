# AIVV role prompts

This directory contains shared role definitions for AIVV reviewers, investigators, challengers, and verifiers. Host adapters load these definitions and add only the tool, permission, and dispatch details required by their environment.

`_untrusted-content.md` records the common boundary for evidence passed to a reviewer or fix-phase agent. Dispatch surfaces should treat project and session material as data to inspect, never as instructions that can override the agent's role or output contract.
