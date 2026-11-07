# Zuri surface refinement and Lab comparison

> **For agentic workers:** use superpowers:executing-plans for this scoped owner-requested refinement.

**Goal:** bring the local Zuri face, bob and garments closer to the visible Tripo
preview; review the real animated GLB against that reference in Character Lab.

**Architecture:** retain the local editable sculpture, approved identity and rig.
Refine the facial surface and material response, replace the blunt hair edge with
flowing layered surfaces, and add cloth compression/tailoring detail. Lab-only
comparison shows captured reference pixels and an immutable pre-refinement GLB.

**Spec / approval:** owner request on 25 October: refine face/hair/clothing,
realistic facial curves and sheen, compare in Lab, no adoption into floors.
This is refinement of the approved character workflow, not a new art direction.
**Stack:** existing Three.js 0.180 / GLTFExporter / Node tests. Local game-dev and
Blender executables are unavailable; use the existing authored GLB pipeline.

## Constraints and review focus

- No provider model extraction, paid job, new credit use, floor adoption, agent
  count/role changes or brand-sheet edits. Preserve all unrelated dirty changes.
- Five existing clips, metre scale, actual furniture contact and independent
  skeletons remain. GLB under 120k triangles / 5 MiB / 150 meshes.
- Face volume and specular response must be real 3D properties; reference images
  are labelled screenshots, never presented as locally imported provider models.
- Recheck blink coverage, accessory surface gaps, normals and seated sleeves.
- Same lighting/camera for before and after. Stale model loads may not replace a
  newer choice. Zuri-only comparison must reset on other character selections.

## Task 1 — surface refinement

Files: `web/characters/zuri-head.js`, Zuri branches of `human.js`, builder,
`tests/zuri-local-rebuild.test.mjs`, exported asset tests.

- [x] Preserve pre-pass GLB/hash and editable source in local reports.
- [x] Add meaningful regression checks for curved face normals/materials and
  hair surface coverage; see failures before implementation.
- [x] Sculpt cheeks, nose, eye sockets and lips; add bounded skin/cornea sheen.
- [x] Author curved fringe and bob flow; retain fitted eyewear/orange clip.
- [x] Refine draped folds and ribbing without changing staff model bytes.
- [x] Export and run source/exported-model checks; fix actual rendering defects.

## Task 2 — review in Character Lab

Files: `web/character-lab.{html,css,js}`, `web/characters/lab-state.js`,
`sheet-reference.js`, builder reference copying, related Lab tests.

- [x] Preserve existing GLB as `reviews/zuri-before-refinement.glb`; compare with
  current by a bounded version selector that retains camera/action.
- [x] Add Zuri Tripo front/face screenshot options with explicit provenance and
  correct image dimensions; approved sheets remain selectable and unchanged.
- [x] Add neutral studio reflections and a light-direction control to inspect
  actual curvature; apply the same conditions to both local GLB versions.
- [x] Test reference bounds/version paths and exported portability; inspect stale-load
  generation guards and perform a rapid browser selection smoke (not a forced-delay race test).
- [x] Build and test; inspect source and built Worker face/side/back/walk/seat,
  before/after, reference switching and console. Independent final patch review.
- [x] Record hashes, actual evidence and remaining art limits. Keep in Lab.

## Evidence

Completed 25 October 2026. `npm run build` passed (435 Worker assets); `npm test`
passed 759/759 with no failures/skips. Source and built Worker rendered the
comparison, light changes, walking and seated clips. Final Worker side/back and
Zuri-to-Staff selection were inspected; browser warning/error logs were empty.
Independent review found a 3.6 mm nonperiodic hair seam; the integrator corrected
it with a failing-then-passing seam position/normal regression and reran build/tests.
The reviewer did not repeat review after that correction.

Runtime screenshots/logs are in ignored `reports/zuri-local-refinement/`.
[Provenance](../../../game-design/characters/2026-10-25-brand-study/local-refinement/provenance.json)
records final hashes, evidence scope and pending owner visual acceptance.
No floor adoption or provider generation occurred.
Reference screenshot source files are in `docs/game-design/characters/2026-10-25-brand-study/local-refinement/`.
