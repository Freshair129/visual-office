# Zuri adaptation from the ready-made Anime Girl

Status: artwork remains unapproved; temporary runtime use authorized 26 October 2026.
See [temporary runtime](../TEMPORARY-RUNTIME.md) for the later owner decision.
The Lab-only statements below describe historical evidence, not the current runtime restriction.
Owner authority: approval of the Anime Girl-to-Zuri proposal. This evidence record
does not change the approved sheet or authorize replacing floor characters.

## Current refinement 3 — 26 October 2026

Owner requested another refinement of the existing Anime-base candidate. The
complete revision 2 GLB, metadata, Blender source and builder are preserved in
`assets-source/characters/candidates/revisions/zuri-anime-v2/`.

The bob now has an asymmetric crown flow, curved locks and separated, tapered
tips. The roots share geometry; they are not overlapping painted shells. A radial
inner surface provides thickness without folding the narrow tips. The chestnut
color is warmer with fine strand variation. Face edits soften the chin/cheeks,
narrow the mouth and slightly increase the eye opening. The glasses temple bends
inward under the fringe. Skeleton, clip identity and floor assets are unchanged.

Evidence: `reports/zuri-anime-refinement3/`. This is still a stylized Lab study:
the fringe remains chunky, the hair is rigidly head-bound, the cardigan neckline
needs later polish, and likeness is not exact. No facial-expression rig, production
LOD, floor adoption or owner art acceptance is claimed.

Final SHA-256: `c76729078169d44da377e3df3fb3f29d0d0013e14b362a627b3ff75ee9e82cce`.
The export has 10,499,000 bytes, 202,880 triangles, 21 meshes, 12 materials,
one skin, 53 bones and `idle`/`seated`/`walking`. Posed height is 1.65575 m.
The raw QA report contains the per-object triangle breakdown; the largest are
hair 71,552, trousers 36,288, cardigan torso 25,024 and face/neck 21,156.

Verification for this revision:

- Final exported-file round-trip (`review-6.log`) passed with zero errors and
  38 warnings. Earlier failures remain recorded: folded hair thickness,
  degenerate UV triangles and hair/temple coplanar contact were repaired.
- Accepted Lab-only warnings: UV/material seam vertex splits (all loose-vertex
  counts zero); source mirrored/stacked brows, lashes, hands and sleeve UVs;
  reused iris color UVs (~19%) and face atlas (~5.5%); shared inner/outer hair
  color mapping (~64.3%, not suitable for unique lightmap baking). Hidden
  back-to-back contact remains at the closed mouth, garment, hair rim, face/hair,
  eyes, brows and clip/glasses contact. These are documented cleanup work,
  not waivers for production adoption. No coplanar flicker or zero-area UV errors
  remain. No geometry checks were skipped for triangle count.
- 18 focused Lab/import/Worker/motion tests passed, zero skipped. Full application
  build passed; the Worker was rebuilt after the final asset and credit changes
  with 446 embedded assets. Logs are in the evidence directory.
- Independent read-only review inspected the exact final hash, source/baseline
  preservation and multi-angle renders/reports: no Critical or Important findings
  in this Lab scope. It did not independently rerun Blender or tests and did not
  grant art approval. Outfit trim/knit detail remains a minor art limitation.
- Source `:4184` and built synthetic Worker `:4185` returned the same final SHA
  and revision 3. Source seated fit and Worker idle/walk/seated/face comparison
  were inspected in-browser. Both fixtures report zero live upstream calls and
  no violations; both browser console warning/error lists are empty. Evidence:
  `worker-face.png`, `worker-walk.png`, `worker-seated.png`, `source-seated.png`,
  `runtime-verification.json` and `browser-console.json`. Original Zuri, Wangjai,
  staff and imported base hashes match
  the preserved baseline. No commit, push, floor adoption or live call occurred.

## Historical refinement 2 — 26 October 2026

Owner requested further refinement. The previous GLB, metadata, editable source
and builder are preserved in `assets-source/characters/candidates/revisions/zuri-anime-v1/`.
This pass softens the eye opening/lashes, adds brown iris detail and subtle skin
tint, shortens the lower face, narrows the neutral mouth and thins the glasses.
One continuous bob surface replaces the repetitive thick hair pieces. The clip
is fitted to the new surface with attachment pins. Clean sleeve cuts are fitted
to the cardigan shoulder. Existing skeleton, motion and floor identities remain.

Current SHA-256: `179675ed327e9422f2b7a1a597b23696db059f6dc70b1dc9bb63efa9ff36c1fe`.
The GLB is 10,787,488 bytes, 213,408 triangles, 21 meshes, 12 materials, one skin,
53 bones and the same three clips. Posed height is 1.6558 m. This remains a
high-detail Lab study, not a performance-qualified floor character.

Evidence: `reports/zuri-anime-refinement/`. Final round-trip `review-8.log` and
`roundtrip.json` report zero errors and 35 warnings. Earlier failed iterations
remain available. The QA script now fails its process if raw geometry QA fails;
render completion cannot be mistaken for a passing geometry result.

Warning treatment remains Lab-only: GLB UV/material splits create coincident
vertices, original symmetric atlases retain stacked UVs, and thin garment/eye/
accessory contact surfaces retain hidden back-to-back faces. These are not
permission to skip optimization or later production validation. There are no
remaining zero-area UV or coplanar flicker errors in the final export.
Hair inner/outer surfaces share the same longitudinal color atlas (23.44% overlap);
the projected iris color atlas has about 19.3% overlap per eye. These mappings are
intentional for color reuse, not unique AO/lightmap bake layouts. Closed-mouth
inner faces and the clip attachment pin also retain hidden contact surfaces.

Hair is still a simplified stylized surface rather than individual strands, and
the face is not an exact reproduction of the sheet. Original source imports,
approved images, Wangjai and other branded models are unchanged. User art
acceptance, facial expressions, production LOD and floor adoption remain open.

Final checks for refinement 2:

- 18 focused tests passed, zero skipped, on the final export (`tests-final.log`).
- Full application build passed; after the final asset/credit update, the Worker
  was rebuilt successfully with 446 assets (`worker-build-final.log`).
- Independent read-only review found no remaining important regressions on the
  final SHA and independently reran four asset/motion tests. The earlier hair UV
  and clip-attachment findings were repaired. Existing neckline simplification
  remains a visible limitation; this is not an art-approval finding.
- Source `:4184` and Worker `:4185` were reloaded with revision 2. Seated furniture
  fit was inspected in both; Worker idle/walking and face comparison were checked.
  Console warnings/errors were empty. Evidence: `source-seated.png`,
  `worker-face.png`, `worker-seated.png`, `worker-walk.png`, `browser-console.json`.
- Both servers return the exact final hash above, revision 2 metadata and zero
  live upstream calls/fixture violations (`runtime-verification.json`). The six
  existing source/branded GLB hashes still match the pre-build baseline.
- JavaScript syntax and default `git diff --check` passed. No commit/push/PR,
  live integration or floor adoption was performed.

The sections below describe the preserved **revision 1** implementation and its
historical validation.

## Source and reproducibility

Visual target: [approved Zuri sheet](zuri-sheet-v1.png). Base: **Rigged Anime Girl**
by **3dquads blender**, [official asset page](https://www.blendkit.com/asset-gallery-detail/1d63f553-863b-41d4-b3bd-d92222700fee/),
CC0-1.0. See [trial provenance](FREE-MODEL-TRIAL.md) and the runtime candidate
`LICENSES.md`. No Tripo geometry, cache or provider export was used.

- Authoring: `scripts/blender/adapt-zuri-anime.py`.
- Inspection and QA: `inspect-anime-adaptation.py`, `verify-zuri-anime.py`.
- Editable source: `assets-source/characters/candidates/zuri-anime.blend`.
- Standalone runtime: `web/assets/models/characters/candidates/zuri-anime.glb`.
- Runtime metadata: sibling `zuri-anime.json`; `artApproved:false`, `floorAdoption:false`.
- Blender 5.2.3 LTS, factory startup, embedded source Python disabled.
- Original GLB SHA-256: `39fc8b555922a7b236e0ad46abe695c7f30c1044948d1cd915de74740d329c50`.
- Final derivative SHA-256: `4bd7db9b179b277708c6399949526a50e54a56ec9709a5e680662c0240815745`.

The source face/hands and useful garment surfaces retain their authored topology,
UV and skin information. The derivative changes face proportions, material/skin
color, brown eyes, bob/bangs, round glasses, orange clip, cardigan and dark
clothing. A compact skeleton and three motion studies were authored locally.
UV-seam vertices were welded before subdivision; subdivision is applied during
export. New geometry is UV mapped. The export embeds textures and attribution.

## Measured output

| Property | Final exported GLB |
| --- | --- |
| Bytes | 10,688,868 (10.19 MiB) |
| Triangles | 207,106 |
| Meshes / materials | 55 / 16 |
| Skins / bones | 1 / 53 |
| Clips | idle, walking, seated |
| Posed idle height | 1.6531 m |
| Lowest idle vertex | approximately 0 m |

The animation builder solves seated wrists against the Lab desk, orients the
palms from the authored anatomy and grounds the deformed shoes for every sampled
frame. A source rig alone was not treated as proof of animation readiness.

## Verification

Local evidence is under ignored `reports/zuri-anime-adaptation/`. Work was done
on `codex/office-experience-gap`, starting at `4523bf0`, with unrelated dirty work
preserved. This is working-tree evidence, not a committed release or hosted CI.

- Export reopened into an empty Blender scene: geometry QA passed with **zero
  errors and 76 warnings**. `roundtrip.json`, `raw-qa.json`, `review-10.log`.
- Focused suite: **18 passed, zero skipped**, including candidate provenance,
  Lab controls and Worker asset behavior. `tests-final.log`.
- Motion regression loads the actual GLB in Three.js and samples deformed shoe,
  pelvis and hand surfaces. Tests cover ground contact, seated height, desk reach
  and no tabletop penetration. No renderer pixels are claimed by this Node test.
- Independent re-review against the final SHA closed all three earlier findings:
  root-bone frame/grounding, unsupported-action fallback and failing geometry QA.
  It sampled 36 positions per clip: walking minimum -0.36 mm, seated pelvis
  0.439 m, lowest over-desk hand 0.789 m. Eight focused tests passed independently.
- `npm run build` passed; Worker embeds 446 assets. `app-build.log`.
- Default `git diff --check` and JavaScript syntax checks passed. Git reported
  existing line-ending normalization notices, not whitespace errors.
- Hash comparison before/after build confirmed Zuri, Wangjai, Staff A/B, original
  Anime Girl and Rain GLBs unchanged. No Agent identity, role, count or floor
  manifest changes belong to this adaptation.

Early failed geometry/motion iterations remain in the report directory. The
suite initially caught a 36.8 cm seated grounding error, interpolated foot
penetration and hand/table penetration; those were repaired and rerun.

## QA warning treatment and remaining work

Warnings are accepted for **Lab comparison only**, not production readiness:

- GLB UV/material splits produce coincident vertices; no loose vertices remain.
- Original symmetric/stacked UVs remain on hands, brows, lashes and sleeves.
  They are suitable for the retained color atlas, not a claim of a unique bake atlas.
- Close surfaces occur in the thin cardigan shell, layered bangs/scalp, eyes,
  teeth and clothing seams. Review renders found no visible flicker; culling and
  simplification remain an optimization task.

This is a high-detail comparison model. It still needs an art decision on face,
hair silhouette and clothing, then performance/LOD work and scene-specific motion
integration before floor use. Hair is simplified into smooth clumps. There are
no new facial-expression blendshapes, wave or point clips; unsupported controls
stay disabled and switching from an unsupported prior action falls back to idle.
Lab furniture fit is approximate and does not qualify every floor chair/desk.

## Review in the app

Open `character-lab.html?model=zuri-anime`. Compare front, three-quarter and side
face views against the unchanged approved sheet, then test the three available
actions and the reference desk/chair. Original Anime Girl and Rain remain separate
choices.

Final browser smoke (26 October): source app `:4184` and built Worker `:4185`
loaded the new candidate successfully. The seated pose was inspected with the
reference desk/chair. On Worker, walking, wireframe and the original unmodified
Anime candidate were also exercised. Switching from old Zuri's wave on Worker,
or point on source, correctly selected idle on the three-clip adaptation.
Browser warning/error logs were empty. The final Worker reload opened
`?model=zuri-anime` with the expected candidate and idle action.

`runtime-verification.json` confirms both servers return the exact derivative
hash above, the candidate HTML and updated attribution file. Both synthetic
fixture logs report zero live upstream calls and no fixture violations.
`worker-zuri-face.png`, `worker-zuri-seated.png`, `worker-zuri-walking.png` and
`worker-zuri-wireframe.png` record app appearance; `browser-console.json` records
the console check. The Worker-only rebuild after the attribution update also
passed. The source server was preserved; only the known synthetic Worker was
restarted. These checks do not qualify production or floor rendering.
