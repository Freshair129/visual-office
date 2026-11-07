# Editable character sources

Current face review: `candidates/zuri-face-r4.blend` corrects the head and natural
3D nose/lip/chin profile. See the
[review record](../../docs/game-design/characters/2026-10-25-brand-study/FACE-R4-REVIEW.md).
The owner accepted R4 for temporary floor use on 27 October; it remains the Lab
default. Revision3 stays preserved for comparison; final art polish is deferred.

## Current temporary runtime source

`candidates/zuri-anime.blend` is the latest Zuri Anime revision 3 derivative;
the original base and revisions 1/2 are retained beside it. See the
[adaptation record](../../docs/game-design/characters/2026-10-25-brand-study/ZURI-ANIME-ADAPTATION.md)
and [temporary runtime scope](../../docs/game-design/characters/TEMPORARY-RUNTIME.md).
Wangjai and staff are authored by `web/characters/` and
`scripts/build-brand-characters.mjs`. No model is final approved art.

The studies below are historical comparisons, not the current runtime face.

## Current head correction

`zuri-head-revision.blend` contains the newly authored head, inset almond eyes,
lids, compact neck, bob and glasses. `Zuri_Head_Revision` is separate from the
unchanged wardrobe reference and review studio. This is a static art candidate;
it has no facial rig or animation approval and is not adopted into floors.

Build with `scripts/blender/build-zuri-head-revision.py`, then reopen/inspect with
`scripts/blender/verify-zuri-head-revision.py` using the pinned Blender executable.
The review GLB is `web/assets/models/characters/reviews/zuri-head-revision.glb`.
The builder overwrites that revision, so save manual edits under a new filename
before rebuilding. Old pilot/current GLBs remain untouched.

`zuri-hair-strands-albedo.png` was generated with built-in Imagegen for this local
revision; the prompt is in `zuri-hair-strands.prompt.txt`. Iris paint reuses the
existing local `zuri-face-albedo-v1.png` through eye-surface UVs. Its catchlights
are painted, not a gaze or expression system. Both textures are packed into the
source and portable GLB. No provider geometry is included.

## Rejected MPFB pilot (preserved)

`zuri-blender-pilot.blend` is the Blender 5.2.3 / MPFB 2.0.18 face-fitting pilot.
It contains an editable MPFB base with targets, the separate export collection,
and a review camera/light collection. Source anatomy is hidden by default.

This is a static study, not accepted art. The body rig, hair, glasses and wardrobe
are explicitly reused from the prior local Zuri. The face is based on MPFB CC0
core assets and local adjustments. See the [pilot record](../../docs/game-design/characters/2026-10-25-brand-study/blender-pilot/README.md)
for provenance and remaining work. Blender backup files stay local.

From the repository root, using an installation with MPFB enabled:

```powershell
& '<Blender executable>' --background --python-exit-code 1 --python scripts/blender/build-zuri-pilot.py
& '<Blender executable>' --background --python-exit-code 1 --python scripts/blender/verify-zuri-pilot.py
```

The build writes the separate pilot `.blend`, `reviews/zuri-blender-pilot.glb`
and its JSON metadata; it does not overwrite `zuri.glb`. Do not rebuild over
manual sculpt work: save a named revision first and reconcile it with the script.
Normal `npm run build` packages the existing pilot; it does not invoke Blender.

## Distributed candidate licenses

The packaged comparison GLBs have a separate license ledger at
[Character Lab model licenses](../../web/assets/models/characters/candidates/LICENSES.md).
