# System gap closure implementation plan

Disposition (7 November 2026, lead under the owner's delegation): Completed: Task 4 verification is superseded by the 6 November 2026 integration verification in SYSTEM-GAP-ANALYSIS.md, which owns current gap status.

SSOT: Current functional gap status is maintained in [SYSTEM-GAP-ANALYSIS.md](../../../SYSTEM-GAP-ANALYSIS.md).

> **For agentic workers:** Use superpowers:executing-plans for this bounded continuation.

**Goal:** Freeze art, use accepted temporary R4, close stale Work review writes and
browser audit blind spots, and produce an evidence-separated functional gap report.

**Architecture:** Retain the existing browser app, local editors, Worker handlers
and synthetic harness. Extend the existing Work review contract with an optional
`baseUpdatedAt` precondition used by the current UI. Keep ETag compare-and-swap
and idempotent handoff retry. No new Zuri transport or data authority.

**Tech stack:** Existing JavaScript, Node tests, Three.js, JSDOM and Worker.

**Spec:** [System gap analysis](../../../SYSTEM-GAP-ANALYSIS.md), executing the owner's
continuation of the approved Office experience/workspace workflow.

## Constraints and review focus

- Preserve all existing staged work and model bytes, roster IDs/count/roles and art.
- Synthetic only; legacy callers omitting the new precondition retain compatibility.
- Stale edits must not overwrite newer data or enqueue a handoff; identical retries
  may return the confirmed saved record/handoff without creating another.
- Two different revisions in the same millisecond must remain distinguishable.
- Conflict UI retains draft text and disables saving until explicit latest reload;
  late failures must not affect the currently selected other task.
- Local HTML base resolution must reject external origin/path escape and include
  nested dev tools without executing scripts or fetching remote URLs.
- Keep art acceptance, code tests, browser evidence, CI and live gates separate.

## Tasks

- [x] Task 1: add regression for stable `zuri` -> R4 path and Lab before/after
  scope; change runtime catalog/Lab labels only, keeping metadata historical
  `floorAdoption:false` as generation provenance. Record current adoption in guide.
- [x] Task 2: add stale edit, missing-record null precondition, malformed base,
  same-millisecond revisions, replay and UI conflict tests. Watch RED. Implement
  Worker optional base validation/check before mutation plus monotonic updatedAt;
  UI sends the captured base and handles typed conflict without losing draft.
- [x] Task 3: add nested/base URL regressions. Watch RED. Discover HTML recursively
  in `audit-runtime.mjs`; `browserModuleEntries` resolves first base against a
  synthetic local URL. Verify all 27 endpoint families and static reachability.
- [ ] Task 4: run focused/full tests, build serially, docs and pinned compatibility.
  Exercise actual source app/Worker in Codex browser. Record findings and limits
  in the gap report, update indexes/AGENTS routing and obtain independent review.

Browser-discovered G7 is within Task 4: pin RESERVED board no-read/no-work-link
and reserved object no-Chat/create regressions before fixing. Keep illustrative
actors, floor navigation and role inspection; no roster changes.

Owner stop/checkpoint received on 27 October. Task 4 remains partial: 836 tests,
build452, docs125/463, compatibility57 and bounded source/Worker flows passed;
mobile viewport control did not establish an actual mobile viewport, and native
hidden/focus remains unqualified. Independent review completed. No further work
or tests will run before a new plan. A local WIP checkpoint commit is authorized;
no push, PR, merge, deployment, model sculpting or paid generation.
