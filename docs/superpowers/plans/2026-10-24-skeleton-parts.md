# Individual skeleton calibration implementation plan

Spec: ../specs/2026-10-24-skeleton-parts-design.md

- [x] Generate and preserve versioned perspective art before individual-edit implementation.
- [x] Add strict optional art/part codecs, stable target definitions and transient physical derivation; prove no Agent/art-coordinate mutation.
- [x] Apply wall/prop overrides to geometry, masks, nav blockers and station anchors consistently.
- [x] Extend Dev controls with target and art selectors, bounded edits, one-Undo drag/cancel, explicit per-floor Save.
- [x] Run focused/full tests, build, independent review and browser Worker save/reload; record evidence.

## Verification and delivery

- Final npm test: 614 passed, zero failures/skips. npm run build passed (386 embedded Worker assets). git diff --check passed. Synthetic fixture audit: realUpstreamCalls=0, no live integration.
- Focused checks cover strict rejection of avatars/unknown/duplicate/authority-bearing targets; file exchange, authored inventory preservation, wall model/span agreement, removed-prop pruning, actual matched chair ownership with arbitrary IDs, one-Undo/cancel drag, miss-pick no-op, retained mesh preview offsets and floor isolation.
- Built Worker at :4185: explicitly selected perspective-v5 for Projects, edited chair X=10 px/105% and front-3 wall Y=4 px, saved, reloaded and read the same independent values. Customer retained legacy-v4/zero calibration. Four original avatar IDs and 16 total objects remained. Reset only the two test piece overrides and saved again; Projects keeps the newly requested art pack, baseline transforms and original inventory.
- Direct pick in browser selected object:role-1-desk and kept the saved-room status clean. New desk/chair reference images loaded from versioned v2 assets; backdrop v5 loaded. Evidence: reports/dynamic-context/skeleton-parts-studio.png, skeleton-parts-{tests,focused,nav,model,build}.log and perspective-v5-assets.json (dimensions, corner alpha, hashes).
- Independent review fixes: custom seats follow the baseline navigation's matched chair rather than an ID suffix; a pick miss cannot drag the previous target; normal mesh preview derives part offsets from authored state once. Fixture wall scaling retains actor clearance. Closure review reported no material findings; reviewer did not run checks.
- No source asset was overwritten, logo changed, Agent inventory/role written, PR opened, merge performed or live call enabled. Generated camera-guided art is not a claim of pixel-exact reconstruction: the editor supports fine alignment against fixed images. Device input and live acceptance remain separate.

Production asset prompts and saved paths are in ../specs/2026-10-24-skeleton-parts-art-prompts.md. Optional officeArt and skeletonParts stay within existing local per-floor scene snapshots and file exchange. Global alignment and individual calibration are distinct fields; they never edit authored raster object positions.
