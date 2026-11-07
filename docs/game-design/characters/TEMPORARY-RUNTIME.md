# Temporary character runtime

Authority: on 7 November 2026 the owner approved the current Zuri R4, Wangjai,
Staff A and Staff B character art, including both full-detail originals and the
Hybrid LOD1 files; this decision was relayed by the lead. The earlier 26 October
instruction authorized temporary use and deferred the art decision. The runtime
is still a temporary slice of character behavior; art approval does not qualify
device performance, accessibility, live integration, or further animation work.
The `anime`, `rain`, and `zuri-anime` candidates and rejected or review assets
are not included in this approval.
Audience: Office/Studio implementers and asset reviewers. This is implementation
and verification guidance, not a new platform contract or Agent roster.

The runtime catalog, LOD manifest and Studio/Lab copy now reflect the 7 November
approval for these four appearances. Historical `candidates/*.json` and
`reviews/*.json` retain their generation-time `artApproved:false` records;
the stable `zuri` runtime appearance selects the approved R4 derivative.

## Available characters

| Appearance | Existing asset | Clips |
| --- | --- | --- |
| Zuri | `candidates/zuri-face-r4.glb`, refinement 4 | idle, walking, seated |
| Wangjai | `wangjai.glb` | idle, walking, seated, wave, point |
| Staff A / B | `staff-a.glb`, `staff-b.glb` | idle, walking, seated, wave, point |

Files remain in `web/assets/models/characters/`; existing metadata and credit
stay with each asset. Original geometry and bytes must remain unchanged; the
6 November LOD work below may only add separate derived files.

On 27 October the owner accepted R4 as the temporary human baseline and deferred
asset polish. The stable saved appearance ID remains `zuri`; no floor migration
or Agent edit is needed. R3 is preserved as the Lab before choice. The R4
generation metadata's `floorAdoption:false` describes the original Lab-only
export; current runtime selection is owned by `runtime-catalog.js` and this
later decision, not a mutation of historical provenance. Art approval was still
pending at that checkpoint; the 7 November decision above supersedes it.
See [system continuation](../../SYSTEM-GAP-ANALYSIS.md) for fresh verification.

## LOD optimization — 6 November 2026

The owner authorized additive optimization of the four temporary appearances.
LOD1 files and a separate manifest now exist under
`web/assets/models/characters/lod/`. Hybrid's default `CharacterLibrary` loads
these derivatives through `characterAsset(id, 'hybrid')`. Character Lab uses
`characterAsset(id, 'lab')` for the full-detail originals; its default is still
R4 and its historical Zuri/R3 choices are unchanged. Saved appearance IDs,
Agent IDs/count/roles and floor files do not change. At this 6 November checkpoint
art was unapproved and physical-device performance was unmeasured; the later art
decision above does not supply physical-device performance evidence.

Measurements from the generated GLB bytes, re-read after writing:

| Character | Triangles: original → LOD1 | Bytes: original → LOD1 | PNG sizes: original = LOD1 | Materials: before → after | Meshes: before → after |
| --- | ---: | ---: | --- | ---: | ---: |
| Zuri R4 | 202,880 → 81,438 | 10,498,996 → 5,515,484 | 4 × 1024×1024; 1 × 512×512 | 12 → 12 | 21 → 21 |
| Wangjai | 61,646 → 24,992 | 1,930,704 → 1,065,284 | None | 6 → 6 | 39 → 39 |
| Staff A | 101,544 → 33,264 | 4,095,188 → 2,133,460 | 1 × 256×512 | 23 → 23 | 113 → 113 |
| Staff B | 97,048 → 31,600 | 3,971,668 → 2,066,940 | 1 × 256×512 | 24 → 24 | 110 → 110 |

Only Wangjai meets both guidance targets (25,000 triangles / 1,500,000 bytes).
Zuri exceeds 40,000 / 3,000,000; Staff exceeds 25,000 / 1,500,000. The recipe
retains faces, human contact soles and all animation data. Zuri's protected
geometry is 28,444 triangles before the additional glasses/skin safeguards;
each Staff sculpted face alone is 10,240 triangles. No claim is made that these
are minimum achievable budgets. Further reduction needs additional visual and
deformation work; these targets do not justify changing the current faces.
Mesh/material counts and texture VRAM are not reduced by this pass.

The reproducible recipe is
[`build_character_lods.py`](../../../scripts/asset-factory/build_character_lods.py).
It pins source SHA-256 values, refuses nonempty output directories, decimates
individual primitives and compacts the GLB buffers. Node names, hierarchy,
rest transforms, joint order, inverse-bind matrices, materials, PNG bytes,
clip names/channels/interpolation and every animation sample are preserved.
Wangjai has animated rigid nodes and no skin; Staff has 15 skins sharing 17
joints; R4 has 53 joints. Existing stock GLTFLoader/TextureLoader paths do not
configure Draco, Meshopt or KTX2; no new decoder extension is introduced.

The original failed recipe had three issues: a fixed ratio exceeded the 2%
skin-influence truncation guard, Staff vertex colors were unsupported, and
treating UV-split vertices as disconnected geometry tore Zuri's sleeves/pants.
The corrected recipe preserves linear vertex colors and reconnects only exact
position/normal/color/skin matches, carries UVs on Blender corner layers, then
splits them back into glTF vertices. A new regression rejects newly opened
surface boundaries on Zuri's hands, jacket and pants. No cross-mesh merge,
texture resampling, normal bake, skeleton change or original re-export occurs.

**The 2% guard is unchanged.** A failed primitive retries from its original at
higher ratios; if none pass it remains unchanged. Every mesh retaining more
geometry than initially planned is listed below (six Zuri and twelve Wangjai
meshes; none in Staff):

| Mesh | Original triangles | Planned retained ratio | Applied retained ratio | Output triangles | Reason |
| --- | ---: | ---: | ---: | ---: | --- |
| `Zuri_Cardigan_Torso` | 25,024 | 0.08 | 0.98 | 24,522 | Lower attempts 0.08/0.25/0.50/0.75/0.90 exceed the 2% skin guard |
| `Zuri_Glasses_Bridge` | 496 | 0.25 | 1.00 | 496 | Preserve glasses after the first visual/overlap review |
| `Zuri_Glasses_Rim_1` | 3,840 | 0.25 | 1.00 | 3,840 | Same glasses safeguard |
| `Zuri_Glasses_Rim_-1` | 3,840 | 0.25 | 1.00 | 3,840 | Same glasses safeguard |
| `Zuri_Glasses_Temple_1` | 976 | 0.25 | 1.00 | 976 | Same glasses safeguard |
| `Zuri_Glasses_Temple_-1` | 976 | 0.25 | 1.00 | 976 | Same glasses safeguard |
| `wangjai-shell` | 8,960 | 0.50 | 1.00 | 8,960 | Keep nested shell/visor surfaces from exposing orange through the face |
| `wangjai-visor` | 2,560 | 0.50 | 1.00 | 2,560 | Same face safeguard |
| `wangjai-ear-left-gasket` | 256 | 0.20 | 1.00 | 256 | Preserve the concentric ear surfaces after visible edge artifacts |
| `wangjai-ear-left-shell` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |
| `wangjai-ear-left-bevel` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |
| `wangjai-ear-left-recess` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |
| `wangjai-ear-left-face` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |
| `wangjai-ear-right-gasket` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |
| `wangjai-ear-right-shell` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |
| `wangjai-ear-right-bevel` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |
| `wangjai-ear-right-recess` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |
| `wangjai-ear-right-face` | 256 | 0.20 | 1.00 | 256 | Same ear safeguard |

The new manifest follows existing `id`, `file`, `bytes`, `sha256`, `triangles`,
`meshes`, `clips` fields and adds source/pipeline hashes, measurements, each
primitive's requested/applied ratios, rejected attempts and target compliance.
Runtime checks the allowlisted filename/LOD level, size and SHA-256 before
parsing. A missing/corrupt LOD keeps the procedural fallback. The generator's
`candidate-unreviewed` quality field is conservative generation provenance;
review observations and limitations were separate evidence at generation time;
the subsequent owner art decision is recorded above.

Run from the repository after fresh storage admission (use a **new or empty**
output directory; never overwrite existing LODs):

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
& 'G:\AI-Studio\Blender\blender.exe' -b --factory-startup --python-exit-code 1 -t 4 -P scripts/asset-factory/build_character_lods.py -- --output web/assets/models/characters/lod
node --test scripts/asset-factory/character-lods.test.mjs
```

Blender 5.2.2 LTS (`d13f752e3b9c`) completed all four outputs, exit 0.
The final generation log is `reports/character-lod/generation-4.log`; earlier
partial/rejected candidates remain in that ignored report directory. No
original asset was modified. `CHARACTER_LOD_DIR` can point the asset tests at a
fresh repository-local candidate; runtime selection tests target the shipped
`lod/` directory. `tests/character-lods.test.mjs` includes the four asset checks
in the standard suite.

Focused asset/selection/runtime/Lab/appearance tests passed **33/33**, zero
failures/skips, with `node --test --test-isolation=none`. This includes actual
GLB skeleton/clip/sample comparison, protected geometry, vertex colors,
surface-boundary regression, hash/size/fallback behavior and seat contacts for
both original and LOD variants. The requested standard `node --test` command
failed before execution at sandbox child-process `spawn EPERM`; the in-process
result is reported separately. Full suite and build are reserved for the lead;
`npm run build` was not run (it regenerates original assets).

Storage authority is the delegated lead's 6 November decision, not a new human
approval: C: holds repository/temp/Blender runtime writes, G: Blender install
is read-only; peak additional allocation is at most 1 GiB, with a 50 GiB C:
OS/runtime floor and no planned concurrent checkout job. The lead's 22:10
reading was approximately 929 GiB capacity / 134 GiB free / 133 GiB projected.
Fresh launch readings
are saved under `reports/character-lod/*preflight*.json`; before the final
generation C: had 142,801,702,912 bytes free (133.00 GiB), projected
141,727,961,088 bytes (132.00 GiB), above both the 50 GiB floor and 10% warning
line. The generator also checks the projected floor itself. Process TEMP/TMP
and Blender user resources were directed into the repository report directory.

The reproducible comparison script is
[`review_character_lods.py`](../../../scripts/asset-factory/review_character_lods.py).
It imports originals and outputs independently, uses matched front/side
full-body and face cameras, and invokes the installed `blender-asset-qa` checks.
All images/QA diagnostics stay under ignored `reports/character-lod/`; these
static Blender comparisons do not qualify browser rendering or animation under
load. Commands executed for the final comparisons:

```powershell
& 'G:\AI-Studio\Blender\blender.exe' -b --factory-startup --python-exit-code 1 -t 4 -P scripts/asset-factory/review_character_lods.py -- --label final --qa-script 'C:\Users\suanr\.codex\skills\blender-asset-qa\scripts\qa_check.py'
& 'G:\AI-Studio\Blender\blender.exe' -b --factory-startup --python-exit-code 1 -t 4 -P scripts/asset-factory/review_character_lods.py -- --label final-wangjai --only wangjai --qa-script 'C:\Users\suanr\.codex\skills\blender-asset-qa\scripts\qa_check.py'
```

Both commands exited 0. Use `final/` images for Zuri/Staff and
`final-wangjai/` for Wangjai; the latest generator reproduced the other three
GLB hashes exactly. Each character has original/LOD front, side and face
close-ups. Observed at these static views: Zuri's face/profile/glasses are
retained, with the initial sleeve/pants tearing corrected; Staff faces and hair
retain their appearance, while clothing folds become slightly simpler/more
faceted; Wangjai's orange face spot and jagged ear edges are corrected by the
full-detail safeguards. No obvious silhouette break remains in these views.

**Raw automated QA is not a blanket PASS.** Game-profile errors/warnings,
original → LOD: Zuri **0/37 → 0/37**; Wangjai **14/55 → 9/53**; Staff A
**57/134 → 51/109**; Staff B **51/131 → 45/102**. Source diagnostics include
degenerate pole triangles, preserved local scales, overlapping eye/hair layers,
UV overlaps, duplicate seam vertices and separated decorative pieces. They
were not silently repaired by changing the original node/face contract. LOD
also changes some small surface-contact diagnostics, including a new detached
right point-finger flag on Wangjai and low-count hair/hand/button overlap flags
on Staff. These remain geometry and animation review risks despite the static
pictures. This 6 November inspection did not itself claim clean geometry,
animated visual acceptance or art approval; see the later owner decision above.

`npm.cmd run docs:check` could not spawn Git (`spawnSync git EPERM`). The same
documentation auditor called in-process with shell-supplied inventory,
excluding protected `handoff/`, checked **154 documents / 628 links, 0 errors**.
This is bounded evidence, not a successful standard entrypoint. `git diff
--check` passed. Full tests/build, browser loading/animation, physical-device
performance, remaining geometry diagnostics and the then-pending art decision
remained with the lead/QA. **Disposition at that checkpoint: IMPLEMENTED — READY FOR LEAD INTEGRATION CHECKS.** No
commit, Git write, merge, deployment or cleanup eligibility is implied.

## G6 draw-call batching — 7 November 2026

Worker scope: `feat/g6-drawcall-reduction-20261107`, base
`78182b5d20a94af27f67c1712dd82c2f24d85ee2`, assigned worktree
`C:/Users/suanr/workspace/visual-office-g6-drawcalls`. No Git writes, build,
browser launch, Docker/RustFS operation or change to original character bytes.

`build_character_lods.py` first reproduces the exact approved LOD1 hashes, then
batches compatible opaque surfaces. Identical shaders may fold their constant
base colour into linear vertex colours; textures, UVs, roughness and all other
shader settings stay intact. No atlas, decoder or runtime special case is needed.
Binary zero/one weights use normalized u8 exactly; soft weights remain floats.

The original transform nodes, bone names, hierarchy, skins, inverse binds and
animation samples remain. An additional shared skin palette references those
same nodes, including existing rigid animation transforms (Wangjai limbs and
Staff fingers). It adds no transform/bone node and changes no clip target.
Animated scale subtrees, including blinking eyelids, remain ordinary meshes to
preserve their inverse-transpose normal treatment. New nodes only hold batches.

| Appearance | Meshes | Materials | Draw-call primitives | Bytes | Triangles | Maximum dropped skin weight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Zuri R4 | 21 → 12 | 12 → 12 | 24 → 12 | 5,515,484 → 5,250,548 | 81,438 → 81,438 | 1.334298% → 1.334298% |
| Wangjai | 39 → 7 | 6 → 6 | 39 → 7 | 1,065,284 → 1,166,624 | 24,992 → 24,992 | 0% → 0% |
| Staff A | 113 → 24 | 23 → 18 | 113 → 24 | 2,133,460 → 2,233,852 | 33,264 → 33,264 | 0% → 0% |
| Staff B | 110 → 25 | 24 → 19 | 110 → 25 | 2,066,940 → 2,158,136 | 31,600 → 31,600 | 0% → 0% |

Distinct GLB bytes total **10,809,160** (was 10,781,168); batching adds no dropped
influence or triangle loss. All accepted per-character/floor inventory ceilings
pass. These are GLB primitives, not a measured full-floor render-call count.
The manifest contains `beforeBatch` hashes and source-part ranges for auditing;
contact tests now inspect those actual vertex ranges in the merged meshes.

Blender **5.2.2 LTS**, build `d13f752e3b9c`, completed the final generation.
Local evidence is under ignored `reports/character-lod/`: `g6-before/` retains
approved LOD1 bytes; `g6-delivery/` holds the generated bytes copied into the normal
LOD paths, byte-identical to the rendered `g6-root-preserved/` GLBs.
`g6-delivery-build.log` records generation. The inherited C: admission
basis is a 50 GiB operational floor and at most 1 GiB peak writes; fresh free
space was 126,585,143,296 bytes. Inputs/toolchain are read from this checkout and
`G:/AI-Studio/Blender`; outputs, logs, temporary imports and Blender user-cache
paths are confined to this worktree. Early importer attempts to write its usual
AppData extension cache were denied; subsequent runs redirected that cache.

`verify_character_batches.mjs` loads both GLBs through Three's production GLTF
loader and compares every vertex/normal at the default pose and five sample
times in every clip. It does not decode images or claim browser acceptance.
Frames / vertices compared / maximum position error in metres:
Zuri **16 / 913,600 / 0**; Wangjai **26 / 421,278 / 5.854e-8**;
Staff A **26 / 501,722 / 1.280e-7**; Staff B **26 / 477,594 / 1.270e-7**.
Maximum unit-normal error is below **1.361e-7** for every character.
UVs and triangle order/winding are exact; maximum linear base-colour error is
**1.959e-8**. The final receipt is `g6-delivery-equivalence.log`.

```powershell
node scripts/asset-factory/verify_character_batches.mjs reports/character-lod/g6-before web/assets/models/characters/lod
& 'G:\AI-Studio\Blender\blender.exe' -b --factory-startup --python-exit-code 1 -t 4 -P scripts/asset-factory/review_character_lods.py -- --label g6-frozen-review --freeze --before-dir reports/character-lod/g6-before --after-dir reports/character-lod/g6-root-preserved --qa-script 'C:\Users\suanr\.codex\skills\blender-asset-qa\scripts\qa_check.py'
```

The review path disables bone display geometry (widgets previously polluted
camera bounds) and removes animation declarations in a local comparison copy.
The optional `--freeze` evaluates glTF default node/skin transforms into static
geometry before import, avoiding Blender's armature retargeting. It retains UVs,
colours, material settings and texture bytes. Animated equivalence is verified
separately by Three, not by this static wrapper.

The four comparison sheets and per-view JSON metrics are in
`reports/character-lod/g6-frozen-review/`. Rows are front, side, face-front,
face-side; left is the approved LOD1, right is batched. Same shared cameras,
384×512 RGBA8, CPU Cycles 16 samples, AgX. RGB8 mean absolute pixel differences
(0–255 scale, including render sampling/float differences):

| Appearance | Front | Side | Face front | Face side |
| --- | ---: | ---: | ---: | ---: |
| Zuri R4 | 0 | 0 | 0 | 0 |
| Wangjai | 0.000232 | 0.000336 | 0.000383 | 0.000171 |
| Staff A | 0.001156 | 0.000988 | 0.002762 | 0.003176 |
| Staff B | 0.000941 | 0.000476 | 0.004803 | 0.003281 |

No pixel differs by more than 5 channel levels; no changed silhouette, colour
or face was observed in these evaluated-glTF sheets. This is not a browser or
physical-device render claim.

**Unresolved import discrepancy — do not hide it:** ordinary Blender armature
import still renders Staff B with visibly shifted scale/limb/face placement.
The retained `g6-noguess/staff-b-comparison.png` has per-view MAE
**0.948602 / 0.787569 / 4.010535 / 3.230579**. Changing bind-pose guessing or mesh
parent placement did not remove it. The glTF-evaluated renders and Three geometry
agree, so this remains a Blender import/retarget compatibility issue requiring
lead inspection; do not call the ordinary Blender import visually equivalent.
The lead must check Staff B in the actual browser before closing visual acceptance;
any visible runtime change requires owner re-review. The approval flags record
the 7 November decision, not fresh acceptance of this import discrepancy.

Automated game-profile QA is **not a blanket pass**. Evaluated-pose
errors/warnings, approved → batched: Zuri **0/35 → 0/26**;
Wangjai **7/53 → 6/16**; Staff A **24/107 → 16/50**;
Staff B **20/98 → 18/49**. Existing degenerate poles, overlaps, seams and
decorative islands remain; grouping changes per-object diagnostic counts.
No geometry repair or source rewrite was performed to suppress these findings.

Four new external-asset-aware tests enforce ≤30 mesh definitions and instantiated
draw-call primitives. Existing tests now check batch provenance/ranges, compatible
shaders, original transform hierarchy/skin samples, protected geometry, weights,
clips and actual contact vertices. Approval assertions changed only for the four
runtime appearances; candidate/review false assertions remain.

The requested full-suite command was attempted during implementation:
**1,269 tests, 1,201 pass, 65 fail, 3 todo, 0 skipped**, in `g6-tests.log`.
Of the failures, **57** are sandbox `spawn EPERM` / `spawnSync git EPERM`
(esbuild and Git subprocesses); **8** are `floor-tasks.test.mjs` fixtures becoming
older than the 30-second freshness limit in the shared process. That unchanged
file passes **18/18** when run separately (`g6-floor-tasks-isolated.log`).
This is not a clean full-suite result, and the final composed tree still needs
the lead's full run. The final delivered files pass **53/53 focused tests**
(`g6-delivery-tests.log`, no failures/skips/todo), covering LOD budgets and
provenance, runtime loading/clones/fallback, seat contact, approval labels,
candidate exclusions and inventory ceilings. Standard `npm.cmd run docs:check` also hits Git-spawn EPERM;
the same auditor with shell-supplied read-only inventory checked **161 documents,
899 links, 0 errors**. External assets verify **88/88**.

Disposition: **IMPLEMENTED — LEAD VERIFICATION PENDING**. The lead must run the
build, pinned compatibility checks and `npm run perf:hybrid` on the composed
tree, retaining the 120-second cases. Check source hashes, ready/fallback state,
zero errors, hardware renderer, calls/triangles, desktop load/frame limits and
4×/6× proxies. Check blinking, fingers, all clips and seated/standing contact in
the browser. Physical-phone performance and full lifecycle remain open; earlier
desktop qualification does not transfer automatically to regenerated hashes.

## Use and save

1. Open Design Studio → Hybrid room → select the floor → edit its current scene.
2. Select an existing avatar. Choose **ตัวละคร** in the inspector.
3. Save that floor. Appearance survives refresh and existing floor file export/import.
4. In the floor, click a character (or focus it and press Enter) to try local
   walk, desk and sofa activities. Existing walls, closed doors, furniture and
   seat reservations determine the route. Skin/model/wire toggles share the scene.
5. Tycoon GLB Studio keeps its measured rig-v3 actor and desk for navigation,
   seat-contact and pose checks. The approved character appearances do not replace
   that probe or its physics descriptors; try them in Hybrid Studio or Character
   Lab. This preserves the accepted low-rate Tycoon path and does not add a saved
   furniture item or Agent.

`appearance` is an optional presentation-only allowlist value. Older avatar
slots default deterministically to Staff A/B. Agent IDs, count, role, business
context and authority are untouched. Only existing synthetic activity/state is
shown; unknown remains unknown and idle is not claimed as business execution.
Unsupported clips fall back to idle and the displayed pose describes that fallback.

## Ownership and failure handling

`runtime-catalog.js` owns IDs and clip aliases. `runtime.js` checks size and SHA-256,
caches source GLBs and their shared manifest per scene and clones independent
skeleton/material/mixer state. A failed manifest or asset load evicts the manifest
for a later retry; scene disposal clears it.
Geometry and textures stay shared until scene teardown. Late loads cannot reattach
a removed actor. Missing/corrupt assets keep a procedural placeholder, display a
loading/failure notice, and retry on scene reload. `seat-fit.js` fits the fixed-length
leg chain to seat height while preserving ankle position and sole orientation.
Root position and heading remain navigation-owned; no clip moves business data.

Wangjai uses a short rigid leg/ankle structure, not the human two-segment IK.
Its egg shell rests on the cushion while its short feet naturally dangle from
human-sized chairs/sofas. Do not stretch those legs to imitate human foot contact.
The runtime converts the cushion height to actor-local units and retains shell
contact even when the appearance is scaled; standing clears that seat offset.
The reconciliation regression measures the actual exported shell and sole at
.34/.41/.50/.57 m, scales .8/1/1.12 and three headings. Human appearances retain
the separate ground-contact/leg-fitting checks.

## Verification and limits

As of 6 November 2026 the Tycoon/GLB Studio probe uses main's rig-v3 factory
actor, not this runtime; the probe evidence below is historical (26–27 October
checkpoint). Current integration checks are in the
[system gap analysis](../../SYSTEM-GAP-ANALYSIS.md#integration-verification--6-november-2026).

Evidence: `reports/temporary-character-runtime/` (local, ignored).
Final `npm test`: 781 passed, 0 failed/skipped. Build passed with 449 embedded
assets. App and built Worker were exercised; exact evidence and independent
review (no Critical/Important defects) are recorded in the implementation plan. Source browser confirmed
appearance save/reload, four existing slots, Zuri sofa activity, layer toggles,
and Zuri/Wangjai GLB probe use; synthetic only.

This is a functional temporary behavior slice, not production qualification.
Relaxation/transition gestures, facial expressions, per-character collision
envelopes, remaining geometry diagnostics and mobile LOD/performance tuning
remain follow-ups. The owner approved the current art as specified above. The LOD pass reduces Hybrid payloads while keeping
full-detail originals in the Lab; the roster is not mobile performance-qualified.
Existing navigation uses its established actor clearance;
this work does not replace it with a crowd solver. Legacy native editions and
image-only garden/city scenes retain their current character renderer.
