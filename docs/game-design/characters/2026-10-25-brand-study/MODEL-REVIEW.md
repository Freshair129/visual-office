# Character GLB first-pass review — 25 October 2026

Status: **model-review candidates; visual acceptance pending**. This is local
production evidence for the approved [concept sheets](README.md), not a change
to the canonical Character Kit v0.9.4. Audience: owner, character artist and
Visual Office implementer.

## Delivered scope

Four independently loadable GLBs in `web/assets/models/characters/`, with source
geometry/rigs in `web/characters/` and deterministic export in
`scripts/build-brand-characters.mjs`. Each contains idle, walking, seated, wave
and point clips. Zuri's original procedural knit/check texture is embedded;
the other materials are self-contained PBR colors. No paid generation provider,
third-party mesh, or new dependency was used.

| ID | Bytes | Triangles | Meshes | Scale |
| --- | ---: | ---: | ---: | --- |
| zuri | 4,619,300 | 118,276 | 144 | 1.60 m body plus hair/shoes |
| wangjai | 1,930,704 | 61,646 | 39 | 0.90 m local preview proposal |
| staff-a | 3,471,552 | 92,012 | 92 | Generic adult art; no role |
| staff-b | 3,505,152 | 92,460 | 95 | Generic adult art; no role |

The manifest records exact SHA-256 values and approved-sheet hashes. Geometry
uses metres, +Z front and ground at y=0. Local game-dev/Blender executables were
unavailable, so the existing Three.js authoring/export pipeline was used. These
are direct GLB assets, not a game-dev canonical package or Blender sculpt.

## Trying the models

Open `character-lab.html`, or Design Studio → **Character Lab · Zuri / วางใจ**.
Studio opens a modal iframe and keeps its current draft mounted. Closing the
dialog releases the frame; no floor save occurs. The standalone page also has
a Studio return link. The embedded page omits that link to avoid nested Studio.

The viewer loads exported bytes through GLTFLoader. Controls select all four
identities, view front/side/back/Office/face, orbit and zoom, select five clips,
pause, spin, show wireframe, show scaled reference furniture, or download a GLB.
Model switching releases geometry, materials, textures, skeletons and mixer
bindings. Late loads cannot replace a newer choice. Pending/failed loads remove
the previous download target from both pointer and keyboard navigation.

## Evidence and review

Tested working tree is based on `4523bf0392c027a98aee297bddd7ac3633b35060` on
`codex/office-experience-gap`; it includes uncommitted changes. No new commit,
hosted CI, PR publication, merge or deployment is claimed.

- Final `npm run build`: PASS, 424 embedded Worker assets. Exporter's normal
  normalization warning is present; parsed GLB vertex normals pass unit-length
  checks. Log: `reports/brand-characters-build.log`.
- Final `npm test`, run after asset generation completed: **746 passed, 0 failed,
  0 skipped**. Log: `reports/brand-characters-tests.log`.
- Character tests cover finite weighted deformation, independent instances,
  fixed scene roots, dimensions, actual supporting sole contact throughout the
  walk, raised-palm greeting, non-mirrored brand marker, budgets and normals.
  GLB tests reload every asset, check embedded resources and hashes, positive
  clip durations, moving skins/nodes and matching loop endpoints.
- Dialog regressions cover open/close/cancel/reopen/disposal and retained draft
  elements. Worker response tests permit only the exact local
  `/character-lab.html` document beside existing blob previews, retaining
  object/base restrictions. Synthetic containment now coexists with the Worker
  CSP instead of replacing it.
- Independent review identified stale keyboard download targets and Worker
  iframe CSP incompatibility. Both were repaired with red/green regressions.
  A later visual check corrected the human greeting from a forward arm gesture
  to a raised palm. Wangjai static clips now have positive duration as well.
- One intermediate suite was invalidated by running tests while asset generation
  rewrote the same GLBs (an empty GLB header read). Build and final verification
  were rerun sequentially; the intermediate failure is not counted as a pass.

Browser checks used source app `127.0.0.1:4184` and built Worker
`127.0.0.1:4185`, both synthetic-only. All four GLBs loaded, model switching and
controls were exercised, Zuri front/back/greeting, Staff A seated, Staff B
standing/walking, and Wangjai Office/wireframe were visually inspected. The
Worker Studio dialog rendered the actual model and returned to the original
floor/edition. Final Worker tab had no console errors/warnings at inspection.
This is desktop IAB evidence, not a mobile-device performance or hosted test.

Local screenshots in ignored `reports/brand-characters/` include
`zuri-worker-final.png`, `wangjai-worker-final.png`, `staff-a-worker-final.png`,
`staff-b-worker-final.png`, `studio-lab-worker.png`, `zuri-back-final.png`,
`staff-b-walk-final.png` and `wangjai-wireframe-final.png`. They are actual WebGL
renders, distinct from generated concept art.

## Remaining art and adoption gates

Human face likeness, hair grouping/strand treatment and tailored cloth folds
remain simpler than the approved sheets. Mechanical checks do **not** close that
visual gap. These candidates are smooth deforming models for review; they are
not final sculpted production characters. Review closeups and Office scale,
refine anatomy/materials and all bend silhouettes before final art approval.

No floor actor replacement, Agent count/role assignment, floor migration,
business status simulation, logo/background change or live Zuri connection was
introduced by this character package. Existing rejected mesh edits elsewhere
in the working tree remain unapproved and must not be published as accepted art.
Scene collision/navigation and real task states remain owned by the existing
floor systems. Floor adoption, LOD/atlas optimization, mobile frame-time evidence,
and in-scene interactions are follow-up work after character visual review.
