# Temporary Character Runtime Implementation Plan

> **Superseded in part (6 November 2026):** the Tycoon/GLB Studio probe no longer
> uses the character runtime. Main's rig-v3 factory actor is authoritative there;
> see [system gap analysis](../../SYSTEM-GAP-ANALYSIS.md#main-branch-reconciliation--6-november-2026).
> Statements below about the GLB probe are historical checkpoint evidence.

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and a final independent review.

**Goal:** Make the existing characters usable in the Office and Studio while final artwork is deferred.

**Architecture:** A local presentation catalog maps stable appearance IDs to existing GLBs. A scene-owned loader validates and caches assets, clones independent skeletons and drives supported clips. Existing navigation, seat reservations and real status provenance retain ownership. Appearance is optional floor-scoped scene data, never Agent identity or role.

**Tech Stack:** Existing Three.js, GLTFLoader, SkeletonUtils, Node tests and synthetic app/Worker.

**Spec / authority:** The owner's 26 October instruction accepts the current models as temporary assets, explicitly says the artwork is not approved, and prioritizes a working character system. This supersedes earlier Lab-only restrictions only for these temporary appearances. Existing Visual Office SRS and architecture integration boundaries remain unchanged.

## Design decisions and constraints

- Use current Zuri Anime revision 3, Wangjai, Staff A and Staff B. No further sculpting or new models in this task. Preserve original asset bytes and credits; art approval remains false.
- Existing avatar slots default to staff appearances. Studio can select one of the four appearances without changing avatar kind/id/count, Agent role, business context or permission.
- Persist optional allowlisted `appearance` on existing Hybrid avatar objects; round-trip through existing floor Save/export/import/Undo. Invalid IDs and appearance on furniture fail import. Older scenes retain deterministic staff defaults.
- Current painted floor and its Studio share runtime actors. GLB Studio's transient navigation probe uses the same character runtime; it remains absent from saved inventory and Agent roster. The legacy native edition is not redesigned.
- Loading, missing/corrupt files and stale responses must leave a usable placeholder and must not resurrect disposed actors. Explicit retry is available through reloading the scene. Cache owns geometry/textures; each instance owns skeleton/material/mixer.
- Clip aliases support existing navigation actions. Unsupported gestures use idle and truthful pose captions; animation never invents Agent work status. Root movement and collision remain navigation-owned.
- Fit seated bodies to chair/sofa height, retain feet using leg fitting, respect heading/pause/reduced-motion, and keep different instances' animations independent.
- No live API or platform contract changes; no commit/push requested. This completes a temporary character slice, not every outstanding platform feature.

## Review focus

1. A pending character load finishes after switching floor or disposal: no stale attachments or resource leaks.
2. Multiple instances of one GLB: independent poses/materials; shared resources remain valid until scene disposal.
3. Unknown appearance or unavailable clips: safe fallback without misleading business status.
4. Seats at different heights and headings: no central-sofa overwrite, foot sinking or external root motion.
5. Saved/imported appearance: retained per floor with original avatar identity/count and no arbitrary URL loading.

## Tasks

- [x] Add failing catalog/persistence and runtime lifecycle/pose tests.
- [x] Implement catalog, validated scene-owned asset library, independent instances and clip/seat adapter.
- [x] Integrate current Hybrid floors/Studio appearance picker and GLB navigation probe; maintain local state and captions.
- [x] Run focused tests and relevant navigation/editor regressions, build, then exercise app and synthetic Worker including save/reload, walking, seats and layer toggles.
- [x] Independent review of the composed scoped patch; record actual evidence and remaining art/performance limits, update AGENTS and session note.

## Verification closeout — 26 October 2026

- Initial catalog/state/lifecycle assertions failed before implementation; see
  `red-state.log`, `first-green.log`. The real GLB seat test caught Three.js bone-name
  sanitization (`Foot.L` → `FootL`), fixed in the catalog; final deformed sole checks
  pass at .34/.41/.50/.57 m and 0/90/180° without moving actor roots.
- Focused runtime/navigation/Hybrid/GLB regressions: **157 passed, 0 failed/skipped**.
- Final `npm test`: **781 passed, 0 failed/skipped**, `tests-final.log`.
- `npm run build`: **PASS**, 449 embedded assets; `build.log`. Existing exporter
  normal-normalization notices remain; four selected GLBs are byte-identical before/after.
- Scoped `git diff --check`: **PASS**. Documentation relative links checked locally.
- App :4184 and built Worker :4185: four GLBs loaded; Hybrid picker saved Zuri and
  Wangjai in two existing Projects slots; refresh retained them; Customer remained
  Staff defaults. Export before/after differs only at two `appearance` values.
- App/Worker Zuri walk-to-sofa and GLB probe desk approach/sit/return completed.
  Layer toggles share the same actors. Door toggle kept saved appearance and was
  restored after trial; the open-plan room can reroute around a closed partition,
  so this is not proof that the whole room becomes unreachable. Automated wall,
  door-threshold, path and reservation regressions passed.
- `http-worker.json`: runtime files and selected GLB hashes equal source and built
  Worker; both fixture logs show **0 real upstream calls, no fixture violations**.
  Browser checks reported no error/warning logs. `worker-projects.png` is the preview.
- Independent read-only review by GPT-6 Luna Max: no Critical/Important defects.
  Reviewer inspected source and parent evidence; did not independently rerun tests
  or browser. One tentative caption concern was withdrawn after verifying the
  existing `seated` caption entry.

Deferred minor: mobile LOD/performance is unqualified, particularly Zuri's ~10.5 MB,
~203k-triangle model. Owner explicitly deferred art polish; faces, hair, clothing,
relaxed/transition poses and production optimization remain follow-ups. Do not
interpret this functional closeout as art approval or completion of all platform work.

Delivery remains local and synthetic. No commit, push, PR, live route or deployment
was requested. The existing native/image-only renderers and saved scenes survive.
