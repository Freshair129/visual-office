# Ready-made human bases — Character Lab trial

Authority: owner approved the proposed two-model trial after rejecting local
human modeling. This record describes third-party intake and local comparison;
it does not change the approved Zuri sheet, Wangjai identity or floor roster.

## Sources and local boundary

| Candidate | Received from | License | Web derivative |
| --- | --- | --- | --- |
| Rigged Anime Girl, 3dquads blender | Official Blendkit public asset/download API, free asset v1 | CC0-1.0 | Embedded GLB, original skin, no clips |
| Rain, Blender Studio | Official Rain v3 download | CC-BY-4.0, also in source ReadMe | Static evaluated GLB; source rig preserved separately |

Original files: `C:/Users/suanr/Downloads/visual-office-character-candidates/`.
Editable derivatives: `assets-source/characters/candidates/`.
Runtime candidates and license: `web/assets/models/characters/candidates/`.
Builder: `scripts/blender/prepare-free-character.py`.
Read-only source inspection: `scripts/blender/inspect-character-candidate.py`.
Reopen/raw QA/material and wire review: `scripts/blender/verify-free-character.py`.

No account, payment, provider generation or live business call was needed.
Source files were opened with autoexec disabled; embedded rig UI scripts were
inspected but never executed. The public asset metadata supplied the Blendkit
download endpoint; a new local scene UUID satisfied its required request field.
No provider cache extraction or private/authenticated URL was used.

The `game-dev` CLI is absent. Local package hashes are direct byte verification,
not a game-dev admission receipt or an Asset Library/floor deployment.

## Trial behavior

`character-lab.html?model=anime` and `?model=rain` open separately named candidates.
Front/quarter/profile, orbit, zoom, light direction and wireframe operate on real
GLB geometry. The right pane remains the labelled Zuri target sheet, not a claim
that a third-party character already represents Zuri. Prior characters and GLBs
remain available. Attribution is shown in Lab and embedded in downloaded GLBs.

Both sources lack authored walk/sit clips. Rain's 19 named actions drive facial
controls; they are not locomotion. Animation controls are disabled instead of
borrowing Zuri's unrelated clips or presenting a static pose as animation.
Further rig conversion, retargeting and seat contact evaluation follow base
selection; they have not passed in this trial.

## QA boundaries

Raw source-derived topology QA reports surface contacts between eye shells,
eyelashes/brows and skin, hair locks, teeth and shoe details. These remain raw
findings, not a clean game-asset pass. Preserving the author's appearance for
comparison takes priority over destructive automatic mesh cleanup. Production
cleanup/rig optimization and art acceptance remain open.

The first Rain conversion exposed unresolved UDIM paths. The final builder reads
each original tile into an ordinary atlas and bakes it through the original
shader, preventing a silent material fallback. Early failed logs are retained.
Blender-imported bone-display widgets are excluded from measured asset bounds.

Evidence directory: `reports/free-character-candidates/`. Tests distinguish
portable GLB/hash/credit/identity isolation from visual review and motion quality.
See the trial plan at `docs/superpowers/plans/historical/2026-10-25-free-character-candidates.md`.

## Verified result — 25 October 2026

| Export | Triangles | Meshes / materials | Size | Clips |
| --- | ---: | ---: | ---: | ---: |
| Rigged Anime Girl | 127,505 | 33 / 12 | 5.67 MiB | 0 |
| Rain | 135,325 | 16 / 16 | 10.01 MiB | 0 |

Both GLBs reopened successfully in Blender with ground at approximately zero
and height 1.65 m. Rain's face/hair use a subdivision level for the close-up.
Raw topology QA is **not clean**; see the retained contact findings above.
Material, front/quarter/profile and wire renders were visually inspected.

- 14 focused tests passed, zero skipped: candidates, Lab state, reference,
  dialog, Worker framing and preserved Blender-pilot assets.
- `npm run build` passed; after final geometry corrections,
  `node scripts/build-worker.mjs` and the same 14 tests passed again.
- Actual browser checks on source :4184 and built synthetic Worker :4185:
  imported model switching, credit/disabled motion state, camera views, wireframe,
  and returning to the existing Zuri clips. No browser console errors observed.
- Both models' HTTP bytes on both servers match their recorded SHA-256 hashes.
  Synthetic harness: zero real upstream calls, zero fixture violations.
- Existing Zuri and rejected pilot checks still match pinned hashes. No floor
  adoption, Agent roster mutation, live integration, commit, PR or hosted CI.

Local portable archive: `.local/character-candidates/free-character-comparison.zip`
(about 195 MiB), built by `scripts/package-free-character-candidates.py`.
It includes original sources, editable derivatives, GLBs, credits, QA/renders
and a closed 26-file hash roster. Reopening the ZIP and verifying every entry
passed; its adjacent `receipt.json` is a local integrity record, not art approval.
