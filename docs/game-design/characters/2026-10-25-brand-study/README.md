# Brand-grounded character study

Current face review: [revision4](FACE-R4-REVIEW.md) follows the owner's natural
3D nose/lip/chin correction. The flattened profile experiment is rejected.
The owner accepted it for temporary floor use on 27 October. Revision3 remains
the historical before choice; final art polish is deferred.

Historical production direction: the owner chose [Tripo generation from these
approved sheets](tripo/README.md). Single-character input art is prepared there;
provider generation remains pending account login and credit authorization.

Status: concept direction approved on 25 October 2026; model production and
testing authorized by the owner's message, "approve เริ่มปั้นตัวละครและทดสอบได้".
See [production plan](../../../superpowers/plans/2026-10-25-brand-characters.md).
The first GLBs and browser lab are recorded in [model review](MODEL-REVIEW.md).
Their mechanical verification does not grant final visual acceptance.
The owner rejected the procedural Office figures
on 25 October 2026, including the continuous-mesh revision, as aesthetically
below the Zuri brand. Mechanical tests do not approve their appearance. Stop
using the old figures as the new art target. The approved sheets below now guide
separate model production; generated geometry still needs visual acceptance.

## Review sheets

Generated with built-in ImageGen; original prompts are saved here. All sheets
are 1536 by 1024 pixels. They are not runtime assets.

| Sheet | Source / prompt | Review focus |
| --- | --- | --- |
| [Zuri](zuri-sheet-v1.png) | Official Zuri Solo v0.9.4; [prompt](zuri.prompt.md) | Face, anatomical-right clip, glasses, cream plaid cardigan, wide trousers; proposed 3D materials |
| [Wangjai](wangjai-sheet-v1.png) | Official Wangjai Solo v0.9.4 plus Zuri sheet for rendering quality only; [prompt](wangjai.prompt.md) | Egg silhouette, ear pods, simple visor eyes, no antenna, friendly focus |
| [Office staff](office-staff-sheet-v1.png) | Zuri sheet for finish only; [prompt](office-staff.prompt.md) | Independent adult staff A/B, natural anatomy, layered fabric, seated work pose |

Visual inspection: all four turnarounds and requested detail/pose panels are
present; identities remain separate and no business role is encoded. Zuri's
three-quarter view carries an optional tablet and several stances vary, so the
sheet is not a strict identical-pose orthographic modeling master. Back views,
fabric construction, staff identities and 3D interpretation remain proposals.
The next approved asset needs a clean neutral modeling turnaround, topology,
UV/material authoring and a real rig; these PNGs prove none of those stages.

## Authority and identity

Read `F:/zuri-product/design/ZURI-BRAND-CURRENT.md` and Character Kit v0.9.4,
especially `boards/01-ZURI-SOLO.png`, `boards/02-WANGJAI-SOLO.png`, `SPEC.md`,
`DIMENSION-PERSONA.md` and `WANGJAI-PERSONA.md`.
The kit's editorial-anime images are the identity sources. These new sheets are
proposed polished 3D adaptations for Office under the owner's current request;
they do not replace the kit or change its review status.

- **Zuri**: adult woman, brown bob/straight fringe, round clear glasses, one
  orange clip on anatomical right, cream check cardigan, dark top and wide-leg
  trousers, cream/orange sneakers. Calm capable colleague. Source body height
  160 cm; hair/shoe height is separate. Do not infer body measurements from
  the source's 49 kg metadata. Tablet is a separate optional prop.
- **Wangjai**: separate friendly orange egg-shaped robot, circular ear pods,
  dark visor, simple white eyes, small orange mouth, dark hands/feet and short
  limbs. No antenna, wheels or extra screen. Friendly focused eyes, never angry.
  Physical height is not confirmed; pair scale remains a review proposal.
- **Office staff**: a third, independent generic adult design language. No Zuri
  hairstyle/glasses/cardigan uniform or Wangjai imitation. Visual variation
  never sets Agent count, business role or capability.

## Deliverables and workflow

1. Separate Zuri and Wangjai sheets: front, three-quarter, side, back on a shared
   baseline; face/gesture examples and material/color guidance.
2. Generic Office adult sheet that follows the same finish and lighting while
   retaining its own identity. It is an art proposal, not a roster assignment.
3. Review identity, silhouette, face readability, cloth/material quality and
   office-camera readability before making any 3D asset.
4. After selection: sculpt one approved model, review turntable and seated pose,
   then retopology/UV/materials/rig/animation, GLB inspection and in-scene test.

Target: polished contemporary stylized 3D anime, smooth anatomical silhouettes,
tailored layered clothing, controlled warm materials and readable faces. Avoid
PS1/low-poly faceting, capsule anatomy, visible human joint balls, featureless
toy mannequins, chibi proportions and photorealistic skin. Wangjai's intentional
robot construction remains distinct from human anatomy.

Generated sheets are raster concept art, not editable meshes, exact orthographic
construction, measured rig masters or completed GLBs. Keep prompts and source
references alongside each output. No runtime replacement, live Zuri access,
role/count edit or new PR publication is part of this study.

## Character continuation references

- [FACE-CORRECTION-REVIEW.md](FACE-CORRECTION-REVIEW.md)
- [FREE-MODEL-TRIAL.md](FREE-MODEL-TRIAL.md)
- [HUMAN-REFINEMENT-REVIEW.md](HUMAN-REFINEMENT-REVIEW.md)
- [ZURI-ANIME-ADAPTATION.md](ZURI-ANIME-ADAPTATION.md)
- [README.md](blender-pilot/README.md)
- [README.md](local-rebuild/README.md)
- [README.md](local-refinement/README.md)
- [provenance.json](provenance.json)
