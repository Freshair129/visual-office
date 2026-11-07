# Local Zuri rebuild

This page records the first local reconstruction. The current owner-requested
detail pass and Lab before/after comparison are in
[surface refinement](../local-refinement/README.md); counts below describe the
preserved first-pass baseline, not the latest GLB.

Authority: owner-requested local modeling from the visible Tripo preview and
approved Zuri image. No provider cache/model extraction or further paid job.

The single-character input in `../tripo/zuri-front-input-v1.png` is the identity
reference for an original face albedo. Geometry remains editable local Three.js
source and is exported as a real animated GLB, never a billboard or downloaded
Tripo asset. See the [execution plan](../../../../superpowers/plans/historical/2026-10-25-zuri-local-rebuild.md).

The local Zuri GLB is rebuilt and tested in Character Lab. Previous candidate
bytes are preserved in ignored `reports/zuri-local-rebuild/` before editing.

## Source and output

- `web/characters/zuri-head.js`: rounded head, original facial projection, actual
  nose/jaw volume, moving skin eyelids, continuous bob, fitted eyewear and clip.
- `web/characters/human.js`: Zuri-only longer cardigan, patch pockets, fuller
  sleeves and trouser hem. Existing shared pose/seat/ground behavior is retained.
- `zuri-face-albedo-v1.png`: original built-in ImageGen output, **1254 × 1254**.
  The prompt requested 1024 square, but the tool returned 1254 square; the source
  bytes are retained unchanged and embedded byte-for-byte in the GLB.
- [Exact prompt](face-albedo.prompt.md), [source provenance](provenance.json).
- Output: `web/assets/models/characters/zuri.glb`; editable sources above.
  **87,224 triangles, 97 meshes, 5,032,944 bytes (4.80 MiB)**; five clips: idle,
  walking, seated, wave, point. All three textures are embedded.

## Verification and review

- Final sequential `npm run build` and `npm test`: **430 Worker assets;
  753 passed, zero failed/skipped**. Logs are under `reports/zuri-local-rebuild/`.
- Actual GLB source Lab inspection: front face, side face, back, walking and
  seated with the reference desk/seat; no browser warning/error observed.
- Built Worker Lab on `http://127.0.0.1:4185/character-lab.html`: verified the
  new face, walking and seated pose against the reference desk/seat. The UI
  reports 87,224 triangles, 4.80 MiB and five animations; captured console
  warning/error list is empty. Screenshots: `worker-face.png`,
  `worker-walk.png`, `worker-seated.png` in the ignored report folder above.
- Independent review found floating eyewear/clip and these were corrected.
  Regenerated GLB raycasts measured frames 5.6–7.8 mm from the face; clip about
  -1.1 to +13.6 mm from hair (small embedded contact at the low end). Regression
  checks require <=12 mm for frames and <=18 mm for clip, penetration <=2 mm.
- Reviewer reran reconstruction tests **3/3** and exported asset regressions
  **5/5**. Normals, albedo identity, clip loops, seating and foot contact pass.
- Wangjai and Staff A/B output hashes exactly match the pre-pass manifest.
  Approved sheets remain unchanged. No Agent/floor adoption or live call.

The render has more detailed facial colouring and a new rounded head/hair form.
It remains an original local interpretation, **not a copy of the Tripo mesh**.
Hair locks and fine garment folds remain simpler than the provider preview;
the painted eye material does not provide independent gaze or lip-sync. Blinks
and five body clips work, but those limits and the owner's visual acceptance
remain separate from the passing geometry tests.

Runtime evidence and latest model hash are recorded in `provenance.json` and
the generated model manifest. The Tripo export gate still applies to that
separate provider asset; this local model does not consume additional credits.

## Character continuation references

- [zuri-face-albedo-v1.png](zuri-face-albedo-v1.png)
