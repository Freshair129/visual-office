# Custom GLB Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and one independent review at the end.

**Goal:** Import, author, place and transfer user GLB props without changing Agent authority.

**Architecture:** IndexedDB content-addressed binaries and immutable descriptor snapshots on custom objects; existing local cards/floors and Three.js runtime consume those references. Bundle v2 carries all binary dependencies.

**Tech Stack:** existing JavaScript, Three.js 0.180, IndexedDB, node:test and browser CUA. No new runtime dependencies.

**Spec:** ../specs/2026-10-24-custom-glb-design.md

## Global constraints

16 MB GLB / 200k triangles / 2048 primitive instances / 4096 px image / 64 MB portable bundle. Static embedded assets only. Existing files preserved. No Agent/role/business mutations. No commit/push requested.

## Review focus

Untrusted URI/decoder inputs; measured bounds versus declared metadata; missing/corrupt IndexedDB blobs; stale async preview/import; custom/mixed portable dependencies and physical seat position.

## Tasks

- [x] Write failing custom asset and portability regressions. Add `web/custom-assets.js` descriptor validation, GLB inspection/measurement/normalization and IndexedDB blob store; tests cover malformed data and content identity.
- [x] Extend `tycoon-state`, `tycoon-scene`, `tycoon-blueprint`, `tycoon-activity`, `tycoon-prefabs` for descriptor-aware validation/rendering/footprints/seats/transforms. Preserve shared legacy navigation behavior through adapters. Test custom placements, fresh IDs, coordinates and blocked approaches.
- [x] Add `web/custom-asset-panel.js` import/author/preview/save UI; integrate library cards and existing navigation test tools. Guard stale asynchronous actions and report storage failures.
- [x] Extend portable codec and UI for v2 self-contained custom/mixed bundles. Test old v1 and new binary round-trip, corrupted/missing models and fresh storage.
- [x] Verify full tests/build, live local browser import→place→save→reload→export→separate-storage import. Update docs/routing/evidence, obtain independent review, resolve findings.

## Execution ledger

Implemented locally. User explicitly waived further approval; design and plan preceded code.

- `npm test`: 407 passed, zero failed/skipped (`reports/office-tycoon-design/tests-custom-glb-final.log`).
- `npm run build`: passed, 370 embedded assets (`build-custom-glb-final.log`).
- Browser: imported an independently generated GLB chair, authored seat/approach, previewed, saved card, placed and saved floor, completed walking/seat test, and reloaded. Exported/imported into a separate-origin store and reloaded successfully. Repeated with embedded PNG texture; rendered texture survived transfer.
- Independent review: primitive-instance budget, pre-base64 bundle size budgeting, shared binary parse cache and undeclared loader-extension rejection addressed with regressions. Final focused review recorded in the verification report.
- Documentation/link/Mermaid validation and `git diff --check` run separately from product tests.
- Limits: static embedded GLB props; one interaction per prop; conservative rectangular footprint. Floor JSON requires accompanying asset bundles on a new machine. Physical second-machine testing, hosted CI, live Zuri integration and deployment were not run. No Agent count/role changes and no commit/push.
