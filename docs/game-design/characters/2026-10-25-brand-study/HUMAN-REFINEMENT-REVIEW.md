# Human character refinement — 25 October 2026

Status: **Character Lab review candidates; final visual acceptance remains open**.
This is local production evidence for the owner's requested refinement of Zuri
and Staff A/B against the [approved sheets](README.md). It follows the
[first-pass evidence](MODEL-REVIEW.md), which is retained as history. It does not
change the canonical Character Kit, Agent roster or floor scene contracts.

## Changes in this pass

- Distinct cheek/jaw/nose forms for the three humans; softer lip and cheek color,
  surface-aligned eyes, brows and lids, plus a short blink in idle/seated clips.
- Curved tapered bob/fringe, ponytail and male swept locks with restrained color
  variation. Zuri retains round glasses and the anatomical-right orange clip.
- Cardigan plackets, cuff/hem gathers, trouser creases, waistband/pockets and
  staff shirt collars. Shoe laces and orange stripes now follow the actual upper.
- More neck clearance above clothing, a lower Zuri crew neckline, and one
  weighted neck/clavicle surface instead of separate visible neck pieces.
- Eased knee recovery, hip/shoulder counter-motion and supporting-foot correction
  during in-place walking. Seated soles stay grounded; wrists and subtle finger
  motion are reposed above the desk. Roots remain caller-owned and stationary.
- A **เทียบชีตที่อนุมัติ** panel in Character Lab, with front/clothing, face/hair
  and full-sheet views. Reference PNG bytes are copied unchanged; cropping is a
  display-only SVG view. Model switching updates the matching reference.

Sources: `web/characters/human.js`, `sheet-reference.js`, `lab-furniture.js` and
`web/character-lab.*`. Builder: `scripts/build-brand-characters.mjs`.
Runtime preview loads exported GLBs, not the authoring factory.

## Final asset snapshot

| ID | Bytes | Triangles | Meshes |
| --- | ---: | ---: | ---: |
| zuri | 4,635,360 | 113,864 | 129 |
| staff-a | 3,695,964 | 90,704 | 106 |
| staff-b | 3,847,656 | 94,432 | 110 |

All have five positive-duration clips: idle, walking, seated, wave and point.
Exact hashes and approved-sheet provenance are in
`web/assets/models/characters/manifest.json`. Wangjai is byte-identical to the
previous candidate: SHA-256
`5bf4e7886fd6f0844ebd54b60aa31a1383e32f0bf1bfa5bfb681d8a60aa4f09e`.

## Validation and independent review

Tested uncommitted tree: branch `codex/office-experience-gap`, based on
`4523bf0392c027a98aee297bddd7ac3633b35060`. Earlier unrelated dirty changes are
preserved. This pass did not commit, push, update a PR, merge or deploy.

- Final `npm run build`: PASS; 429 embedded Worker assets. Export normal
  normalization messages remain, while actual loaded GLB normals pass checks.
- Final `npm test`, run after generation finished: **750 passed, 0 failed,
  0 skipped**. Logs: `reports/character-refinement/build.log` and `tests.log`.
- Focused source/GLB/reference tests: **16/16**. Tests cover independent rigs,
  finite skin deformation, root stability, preserved identity, budgets, byte
  hashes, closed loops, exported blink and supporting soles. Approved reference
  copies must match byte-for-byte and all crops remain within the PNG bounds.
- The first seated regression failed on actual palm penetration at y=0.7246 m.
  The pose was corrected. Independent review then caught sleeves/cuffs/forearms
  still intersecting the lab desk, which wrist/palm-only assertions had missed.
  The desk edge was moved from z=0.315 to 0.430 m, under the palms. Its actual
  renderer and tests share `HUMAN_DESK`, preserving height and depth.
- Source and loaded GLB tests now sample the entire seated loop and check
  deformed sleeve, cuff, forearm, palm, finger, thumb and nail vertices against
  the rendered tabletop volume. Reviewer independently verified surface reach
  and no tested penetration, and found no code regression in the final neck edit.
  This sampled geometry evidence is not a continuous collision solver or an
  independent artistic approval.

## Browser evidence

Source app `127.0.0.1:4184` and built Worker `127.0.0.1:4185` use the existing
synthetic-only harness. Final Worker review covers human identity switches,
approved-sheet panel/crops, closeup/front/back/side/Office cameras, walk and
seated clips with scaled reference furniture, pause and wireframe controls.
Local WebGL screenshots are retained under `reports/character-refinement/`;
files ending `-worker.png` are built Worker evidence. These are actual model
renders, not generated concept images. Desktop browser checks are separate from
mobile-device performance, hosted CI and real Zuri integration.
Final Worker console inspection returned no errors or warnings.

## Remaining visual and adoption work

The models are more detailed but still simpler than the painted concepts:
hair clumps remain broad, facial planes are stylized, and staff collars/fabric
folds still need sculptural polish. The seated clip is a typing preview; fingers
hover about 17 mm over the bare reference surface, not an IK-driven keyboard
interaction. Final art likeness and naturalness require visual review, not a
test-count inference. Keep these limits visible when showing the lab.

No adoption into real floors occurred. Floor images, logo, saved layouts,
Agent counts/roles and Wangjai geometry remain unchanged by this refinement.
Actual scene navigation, seat-specific IK/contact, performance/LOD and live
business state remain separate integration work after the character art review.
