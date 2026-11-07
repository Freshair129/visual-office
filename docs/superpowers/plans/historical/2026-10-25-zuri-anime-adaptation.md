# Zuri from the approved ready-made base

## Follow-up refinement — 26 October

Owner request: continue refining the candidate against the same approved sheet.
No new direction or floor adoption. Preserve v1 GLB/metadata/source/builder in
`assets-source/characters/candidates/revisions/zuri-anime-v1/` before changing it.

1. Replace the regular thick hair tubes with a connected bob silhouette, tapered
   asymmetric fringe and subtle strand color. Keep the brown/orange identity.
2. Refine eye opening, lash weight, brown iris detail, cheeks/chin and closed
   neutral lips on the existing authored face. Fit glasses to the revised eyes.
3. Render front/quarter/profile and full body; inspect seated/walking deformation.
   Reopen exported GLB for geometry QA and run existing motion/provenance tests.
4. Rebuild and inspect the source and synthetic Worker Character Lab, retaining
   original imports and existing floor models. Record exact metrics and warnings
   in the review record; artwork remains subject to visual acceptance.

Follow-up outcome: refinement 2 completed in Character Lab, final SHA
`179675ed327e9422f2b7a1a597b23696db059f6dc70b1dc9bb63efa9ff36c1fe`.
QA reopened the actual export: zero errors, 35 documented Lab-only warnings.
18 focused tests and app/Worker builds passed. Independent review reran four
checks with no remaining important regression. Source/Worker browser smoke and
served hashes passed; no live calls, floor adoption or changes to prior models.
The supplied sheet still exceeds the model's hair detail; art acceptance remains
with the owner. See the current refinement section of the review record.

Authority: owner approved adapting the Lab's Rigged Anime Girl to Zuri after the
face/hair/glasses/cream-and-charcoal wardrobe proposal. This is a Lab candidate,
not permission to adopt into floors. Visual authority is the approved
`docs/game-design/characters/2026-10-25-brand-study/zuri-sheet-v1.png`.

## Scope and acceptance

1. Preserve CC0 source and existing candidates. Inspect mesh, weights, material
   atlas and bone orientation before modifying a separate derivative.
2. Retain the continuous authored face/body. Soften the face, change green eyes
   to warm brown, create a bob with bangs and orange clip, and fit thin round
   glasses. Match cream cardigan, dark shirt/trousers and cream/orange footwear.
3. Preserve a usable skin. Check relaxed standing and seated deformation; expose
   only clips actually exported and inspected. Avoid claiming production motion
   or floor readiness from a rig or static pose.
4. Add a separate `zuri-anime` Lab choice with source credit, a downloadable GLB
   and unchanged sheet comparison. Never change the floor manifest or Agent data.
5. Reopen exported GLB, measure dimensions, inspect front/quarter/profile/full
   renders and raw geometry QA. Run focused Lab/Worker tests and build, then test
   the actual source and synthetic Worker UI. Record remaining art/rig issues.

## Outputs

### Owner follow-up: refinement 3 (26 October)

The owner asked to refine the current candidate again. Preserve revision 2 in
`assets-source/characters/candidates/revisions/zuri-anime-v2/` before changes.
Focus on a softer asymmetric bob with curved, tapered locks and separated fringe
tips, warmer chestnut shading, and a less pointed lower face. Preserve the authored
face topology, rig, motion clips, approved sheet and all floor models. Reopen the
export, inspect front/quarter/profile and motion, run asset QA plus focused Lab
tests, then rebuild and inspect the synthetic Worker. Evidence goes to
`reports/zuri-anime-refinement3/`. This remains a Lab art study, not floor adoption.

Completed refinement 3: final SHA `c76729078169d44da377e3df3fb3f29d0d0013e14b362a627b3ff75ee9e82cce`,
exported-file QA zero errors (38 documented Lab warnings), 18 focused tests with
zero skips, full build and final Worker rebuild passed. Independent read-only
review found no important defects in this scope. Source and Worker served the
same candidate; in-browser motion/seat/face checks completed with synthetic data.
Previous assets remain unchanged. Likeness, clothing detail, production optimization
and floor adoption remain open; see the adaptation evidence for precise limits.

- Authoring: `scripts/blender/adapt-zuri-anime.py`
- Editable source: `assets-source/characters/candidates/zuri-anime.blend`
- Runtime: `web/assets/models/characters/candidates/zuri-anime.glb` / `.json`
- Evidence: `reports/zuri-anime-adaptation/`
- Review: `docs/game-design/characters/2026-10-25-brand-study/ZURI-ANIME-ADAPTATION.md`

## Execution record

- Started on existing isolated `codex/office-experience-gap` at 4523bf0. Existing
  dirty assets/code are preserved. No live APIs or floor changes are in scope.
- Ruling: the owner's approval settles the art direction; no repeated design
  approval is needed. The finished mesh still requires visual review in Lab.
- Completed 26 October: separate source/GLB/metadata, Lab entry and unchanged
  sheet comparison. Three locally authored clips use a 53-bone skeleton.
- Export reopened with zero geometry errors; 76 warnings are categorized and
  accepted for Lab-only comparison in the review record. 18 focused tests passed,
  full build passed, and the final Worker rebuild included updated attribution.
- Independent review found grounding, unsupported-action and geometry-QA issues
  in earlier iterations. All were repaired; the reviewer rechecked final SHA
  `4bd7db9b179b277708c6399949526a50e54a56ec9709a5e680662c0240815745`
  with no remaining important findings in that scope.
- Source and Worker browser smoke verified seated furniture fit, action fallback,
  candidate switching and no console errors. Worker walking/wireframe and final
  reload were checked. HTTP hashes match; both fixtures report zero live calls.
- Original candidate and branded-model hashes remained unchanged after build.
  No commit, PR, live integration or floor adoption was performed. Art likeness,
  detailed hair and production optimization remain for review and later work.
