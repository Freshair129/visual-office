# Zuri — Blender authoring pilot

**Owner rejected this candidate after inspecting the comparison.** Bulging eyes,
heavy lips, long neck and helmet-like hair do not match the approved sheet.
The structural/toolchain results below are historical evidence, not art approval.
Continue from [head correction](../../../../superpowers/plans/2026-10-25-zuri-head-correction.md).
The Lab now labels this preserved file **MPFB เดิม · ไม่ผ่านรีวิว**; `?model=blender`
opens the separate corrected head revision instead.

Authority: implementation evidence for the owner's approved installation and
Zuri pilot. This does not replace the approved character sheet or approve art.

## Installed tools

| Tool | Pinned version | Evidence |
| --- | --- | --- |
| Blender | 5.2.3 LTS, build `e13b728c6880` | Official portable Windows archive; SHA-256 checked against official checksum; headless environment report |
| MPFB | 2.0.18 | Official Blender extension archive SHA-256 checked; registered and created a real human mesh |
| Blender Agent Skills | `71d031dab8bc6729504d11a78cbe91945401045f` | 14 relevant skills installed into the user's Codex skills directory with Skill Installer |
| MCP for Blender | 2.2.4, `febcd90ece59c3416d7c55fd3723cea46bcaa59d` | Isolated Python environment, addon installed, real MCP initialization/list/read-scene call through loopback |

Local tool root: `C:/Users/suanr/.local/share/zuri-character-tools/`.
Blender executable: `blender-5.2.3-windows-x64/blender.exe` beneath that root.
The MCP client configuration adds only `mcp_servers.blender` and retains a
timestamped configuration backup. Both telemetry disable variables are set;
addon consent is off. No external generation provider was enabled. Codex loads
new skill availability on the next turn; the new MCP registration may need an
app/session reload. The addon bridge requires Blender's GUI event loop: a
background `-b` process alone cannot serve it. Headless builds work independently.
The temporary GUI bridge used for verification was closed afterwards; open
Blender when using MCP again. The installed addon can start its loopback server.

The `game-dev` CLI was not installed on this host. This evidence comes from
Blender, MPFB, the actual MCP client handshake, repository tests and browser
checks; it is not a `game-dev` package validation receipt.

## What was built

- [Editable Blender source](../../../../../assets-source/characters/zuri-blender-pilot.blend)
  with MPFB target sliders, separate export meshes and a review studio.
- [Separate GLB](../../../../../web/assets/models/characters/reviews/zuri-blender-pilot.glb)
  and [metadata](../../../../../web/assets/models/characters/reviews/zuri-blender-pilot.json).
- Character Lab version choice **Blender / MPFB · โครงหน้าทดลอง**, plus an optional
  `?model=blender` entry. Existing versions remain available. Static pilot
  animation and furniture controls are disabled because it contains no clips.

The new face has MPFB anatomical mesh/UV, local shape adjustments, physical eyes,
brows and materials. Hair, glasses, wardrobe and the body rig are reused from
the previous local Zuri as fitting references. No Tripo geometry is present.
The original `zuri.glb` remains byte-identical at SHA-256
`70978ebebfd79314951243e233a08f0e01ae02ba183d9dbb3d0dd4c529dd7499`.
Wangjai, staff and floor/agent data were not changed.

## Verification scope

- Fresh Blender build, source reopen and exported GLB reimport succeeded.
- Pilot: 126,568 triangles, 102 meshes, 0 animation clips; about 3.35 MiB.
- Reimported bounds: about 0.575 × 0.285 × 1.659 metres. Body reference is 1.60 m;
  hair/shoes account for extra height.
- New face QA: no errors; no zero-area or overlapping UV faces after fixing the
  neck UV island. The remaining ground-height warning is expected when checking
  a head attached at z=1.329 m separately from the whole character.
- Front, three-quarter, side and back renders saved in ignored
  `reports/blender-character-pilot/`; inspect them for art judgment.
- Repository suite: 762 tests passed, zero skipped. Full application build passed.
  Final asset-focused tests and Worker packaging are rerun after final asset edits.
- Browser/Worker evidence is recorded in `provenance.json`. These are local
  synthetic checks, not hosted CI, release approval or Zuri live qualification.

## Remaining production work

This pilot establishes the toolchain and editable anatomical base. It is **not
visually approved or game-ready**. The comparison shows that eyes/lids, lip
shape, neck silhouette, hair grouping and material detail need further art work
to match the approved anime-styled sheet. Full head/body deformation, facial
expressions, new walk/sit animation, crowd LODs and a whole-character production
QA pass remain open. The Lab honestly exposes this pilot as static.

Continue from silhouette and face review before polishing materials or baking.
Do not infer that installation, source export or passing tests solves the art gap.

## Sources and licensing

Blender is obtained from the [official release archive](https://download.blender.org/release/Blender5.2/).
MPFB is obtained from the [official extension](https://extensions.blender.org/add-ons/mpfb/).
MPFB code is GPL-3.0-or-later, while its bundled core mesh/targets are CC0 under
the [MPFB asset license](https://github.com/makehumancommunity/mpfb2/blob/v2.0.18/LICENSE.md).
The local Zuri branding, reused artwork and local additions retain their existing
ownership; the whole branded character is not labelled CC0.
The [agent skills](https://github.com/EL4CTEO/blender-skills) and
[MCP adapter](https://github.com/ahujasid/mcp-for-blender) are MIT-licensed tools.

## Character continuation references

- [HEAD-CORRECTION.md](HEAD-CORRECTION.md)
- [head-correction-provenance.json](head-correction-provenance.json)
- [provenance.json](provenance.json)
