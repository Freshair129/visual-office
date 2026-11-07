# Approved brand character models — implementation plan

**Latest owner direction:** after the Tripo pilot's export gate, the owner
requested [local Zuri reconstruction](2026-10-25-zuri-local-rebuild.md) from the
visible preview and approved source image. No provider cache is extracted.
The [Tripo pilot](../../../game-design/characters/2026-10-25-brand-study/tripo/README.md)
remains a completed provider preview, not an imported model. The earlier local correction and
its verification are recorded in [face review](../../../game-design/characters/2026-10-25-brand-study/FACE-CORRECTION-REVIEW.md);
they do not establish art acceptance. The earlier tasks below describe the local
candidate pipeline; the linked reconstruction plan owns this latest Zuri pass.

> **For agentic workers:** use superpowers:executing-plans; the existing owner-requested Astra worker owns the independent Wangjai model only.

**Goal:** build separate Zuri, Wangjai and generic staff A/B GLBs from the approved sheets, with a browser Character Lab that tests actual exported files.

**Architecture:** new `web/characters/` sources own authored surfaces, materials and rigs. A deterministic builder exports portable GLBs with embedded animation clips and a hashed manifest. The lab loads those bytes through GLTFLoader; it never creates business Agents or writes floor layouts.

**Tech stack:** existing Three.js 0.180.0, GLTFExporter/Loader, local Node asset builder, browser WebGL. Local `game-dev` and Blender executables are unavailable. Use the existing direct Three.js asset-authoring pipeline; no paid provider invoked.

**Spec:** [approved sheets](../../../game-design/characters/2026-10-25-brand-study/README.md), Character Kit v0.9.4 through [DESIGN-SOURCES](../../../DESIGN-SOURCES.md).

## Global constraints

- Preserve source brand bytes and existing floor/Agent state. New independent asset IDs are presentation identities, not business roles.
- Front +Z, feet at y=0, metres. Zuri body height 1.60 m with hair/shoe allowance documented. Wangjai preview height 0.90 m is an explicit local proposal, not a canonical measurement.
- Zuri: brown bob/fringe, anatomical-right orange clip, clear round glasses, cream windowpane cardigan, dark trousers, cream/orange shoes.
- Wangjai: orange egg, dark visor, white oval eyes, round ears, short limbs; no antenna/wheels/extra screen.
- Smooth surfaces, legible eyes/face, tailored fabric and continuous deforming human limbs. No ball joints on humans.
- Budget: each GLB below 5 MiB, below 120k triangles, <=150 meshes, no external textures. Retain editable source and provenance.
- Root placement remains stable during in-place animation; idle, walking, seated and gesture clips stay presentation-only. No live calls or business status invention.

## Review focus

1. Face readability at closeup and Office scale, especially eyes through glasses.
2. Side/back silhouettes and sleeves/knees during bends; no exposed sockets.
3. Export/reload animation integrity and independent instances.
4. Ground contact and seat height while switching clips, including reduced motion.
5. Viewer load failures, repeated switching and disposal; no saved-floor mutations.

## Task 1 — author characters

Files: new `web/characters/human.js`, `web/characters/wangjai.js`, `tests/brand-characters.test.mjs`, `tests/wangjai-model.test.mjs`.

Interfaces: `createHumanCharacter(kind)` supports `zuri`, `staff-a`, `staff-b`; `poseHumanCharacter(root,{action,time})`. Wangjai has `createWangjai()` / `poseWangjai(root,{action,time})`. Roots carry non-enumerable rig references and serializable identity/dimension metadata.

- [x] Tests first: dimensions, independent rigs, finite weighted deformation, immobile root, preserved model identity.
- [x] Author sculpted continuous head/cloth surfaces, detailed face/hair/shoes and stable skeletons. Wangjai worker owns only its module/tests.
- [x] Inspect front, three-quarter, back, closeup, walk and seated renders; refine model defects against sheets.

## Task 2 — export real assets

Files: `scripts/build-brand-characters.mjs`, `web/assets/models/characters/*`, `tests/brand-character-assets.test.mjs`.

- [x] Bake stable named nodes into in-place clips, embed all buffers, hash outputs; save source-sheet references and local quality status in manifest.
- [x] Reload GLBs, verify clips actually deform skins/move nodes, verify bounds/budgets and separate clones.

## Task 3 — Character Lab and verification

Files: `web/character-lab.html`, `.css`, `.js`; Studio entry, asset build scripts.

- [x] Load exported GLBs, choose all four, orbit/zoom/front/back/Office views, play/pause clips, wireframe and desk/seat reference. Download GLB link.
- [x] Test browser source and Worker, console/load failures and switches. Run focused tests, full suite and build; independent review.
- [x] Record exact checks and limitations here. Do not equate mechanical checks with owner visual acceptance; no automatic roster replacement or PR publication.

## Owner-directed refinement pass

The owner's next request authorizes continued refinement against the approved
sheets and Character Lab testing, before floor adoption. Keep the same local
Three.js source/export pipeline and separate asset identities. Wangjai is not
part of this human refinement.

1. Rework facial planes, warmer cheek/lip shading, eyelids, brows and distinct
   adult staff faces; preserve Zuri glasses and anatomical-right orange clip.
2. Replace straight bob tubes and uniform male fringe with broad, tapered,
   curved hair locks oriented to the head surface. Staff A retains a low ponytail.
3. Tailor cardigan collar/plackets/ribbed hems, sleeve gathers and trouser creases;
   give staff open collars, rolled cuffs, tucked shirts and belt/waist detailing.
4. Correct seated feet/palms against furniture, add restrained hip/shoulder
   counter-motion and eased step recovery. Keep in-place roots and closed clips.
5. Add an optional approved-sheet comparison in the lab, loading unchanged
   reference PNGs. Export/reload GLBs, review front/side/back/face and walk/seat,
   then run focused tests, sequential build/full tests, and independent review.
6. Record actual results and remaining visual differences. Do not replace floor
   actors or change saved scenes, logo, Agent count/role or live connectivity.

Refinement implementation and local validation are recorded in
[HUMAN-REFINEMENT-REVIEW](../../../game-design/characters/2026-10-25-brand-study/HUMAN-REFINEMENT-REVIEW.md).
This closes the local refinement/testing pass, not final art acceptance or floor adoption.

## Execution record

### Owner-directed face correction

The owner rejected the refined human faces as unattractive. The approved sheets
remain the art target; the previous Lab result is not visual acceptance. Scope:
Zuri and generic Staff A/B only, with Wangjai, floor actors and business identity
untouched.

1. Rebuild the jaw/cheek silhouette as a smooth oval, with a shorter nose and
   integrated soft lip/cheek colour. Rework almond eyes, iris depth, tapered lids
   and brows; preserve distinct adult staff faces.
2. Replace the spiky, evenly spaced bob/fringe with curved, overlapping locks,
   rounded ends and an asymmetric part. Preserve the orange right-side clip,
   glasses, ponytail and short staff hairstyle identities.
3. Prevent tiny facial accessories and coarse shadow maps from drawing angular
   bands over the face. Carry the presentation setting in the GLB metadata.
4. Export and inspect the actual files in the Lab at front, three-quarter, side,
   and Office scale. Keep the original sheets available beside the models.
5. Re-run geometry/animation/seat regressions, build and full tests; record real
   screenshots and any remaining likeness limits. No floor adoption in this pass.

- Owner approved concepts and modeling/testing. Existing dirty changes from the rejected mesh revision are preserved separately.
- Ruling: use repository-local asset authoring because game-dev/Blender are absent; no external generation, spend or installation introduced. Assets require direct GLB/visual validation and are not claimed as a game-dev canonical package.
- Ruling: keep the new models in a dedicated lab first so model review cannot rewrite saved floors or duplicate Zuri/Wangjai into Agent rosters.

- Implementation, tests and browser review are complete for the **first-pass model-review scope**, not final art acceptance. See [MODEL-REVIEW](../../../game-design/characters/2026-10-25-brand-study/MODEL-REVIEW.md) for assets, actual verification, independent-review fixes and open art/adoption gates.
