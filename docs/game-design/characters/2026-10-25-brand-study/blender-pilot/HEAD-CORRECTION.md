# Zuri head correction — Character Lab review

Authority: implementation evidence for the owner's `fix it` after rejecting the
MPFB pilot. The approved Zuri sheet remains the character authority. This revision
is not owner-approved art and is not adopted into Office floors.

## Changes

- New cheek/jaw/forehead surface with inset almond eye apertures and enclosing
  upper/lower lid geometry. The old protruding sphere eyes are absent.
- Smaller nose/lip relief, compact lower face and short neck into the collar.
- New rounded bob with curved tips, textured chestnut strands, amber clip attached
  to its actual surface, and fine round glasses with connected bridge/side arms.
- Side hair sits behind the temple so the profile is visible. Front, profile,
  three-quarter and back were rendered and inspected during correction.
- The original body/wardrobe remain fitting references. This head is static and
  exports no animation clips. No staff, Wangjai, floor or Agent identity changed.

## Files and provenance

- [Editable source](../../../../../assets-source/characters/zuri-head-revision.blend)
- [Portable GLB](../../../../../web/assets/models/characters/reviews/zuri-head-revision.glb)
- [Measured metadata](../../../../../web/assets/models/characters/reviews/zuri-head-revision.json)
- [Build script](../../../../../scripts/blender/build-zuri-head-revision.py)
- [Reopen and QA](../../../../../scripts/blender/verify-zuri-head-revision.py)
- [Hair texture prompt](../../../../../assets-source/characters/zuri-hair-strands.prompt.txt)

New geometry is locally authored in Blender 5.2.3; the rejected MPFB face is not
stretched or reused. Built-in Imagegen made the hair albedo, packed into `.blend`
and GLB. Iris paint reuses the existing local face albedo through eye-surface UVs;
its catchlights are painted. No Tripo mesh/cache extraction or provider job was
used. Exact output hashes and verification are in `head-correction-provenance.json`.

The rejected `zuri-blender-pilot.glb` remains byte-identical at SHA-256
`de69ba1c10b605bc59d4b062d4f2262031c842317cf032b66b4700af5d3bd12e`.
The prior `zuri.glb` remains byte-identical at SHA-256
`70978ebebfd79314951243e233a08f0e01ae02ba183d9dbb3d0dd4c529dd7499`.

## Actual verification

- Rebuilt `.blend`, reopened it, and reimported exported GLB; metric body height
  is approximately 1.599 m. Portable output has 127,568 triangles, 117 meshes,
  embedded textures and zero clips, below the 150k / 15 MiB Lab ceiling.
- Full new-head assembly QA passed with zero errors. The overlap probe is 10 µm,
  below the thin authored lock section dimensions; the default 1 mm probe
  would cross complete thin locks. Attachment tolerance is 3 mm.
- Accepted **static review** warnings: eye/hair inside shells intentionally share
  UVs with their fronts; these are not unique bake UVs. Boolean eye rims and flat
  hair caps retain n-gons in source and triangulate on GLB export. Close tip
  vertices preserve thin lock sections. Interior eye/lid/hair shell contacts and
  a head origin above ground are expected in this assembly. Retopology, unique
  bake UVs and deformation QA remain required before a production facial rig.
- Eleven focused asset/Lab/reference/dialog/Worker tests passed with no skips.
  Full application build passed before final shape refinement; the final asset
  was rebuilt, reopened, retested and packaged into the 439-asset Worker.
- Source app :4184 and built Worker :4185 load the final file and approved sheet.
  Browser checks cover reference comparison, face camera presets, wireframe,
  rejected/current/corrected switching and original walking-clip availability.
  The corrected static model disables motion controls. Console warn/error empty.
- Served Worker bytes match the local GLB hash. Synthetic fixture reports zero
  real upstream calls and zero violations. No hosted CI/release/live claim.

Screenshots and raw reports are local under `reports/zuri-head-correction/`.
They are evidence of this candidate, not a replacement for the approved sheet.

## Remaining art/production work

The exaggerated eye/lip/neck defects have been replaced, but this is still a
modeling candidate. Hair grouping and expression fidelity are simplified relative
to the sheet. It is not a final Tripo-quality or sheet-identical claim. The old
wardrobe is not newly approved. Blink/gaze/expression rigging, walk/sit deformation,
crowd optimization and owner art acceptance are still open. Review the face first.
