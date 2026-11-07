# Blender character pipeline — Zuri pilot

Status: approved for tool installation and a local Zuri pilot by the owner on 25 October 2026. Art acceptance and floor adoption remain separate.

## Scope and sources

Use the approved [Zuri sheet](../../game-design/characters/2026-10-25-brand-study/zuri-sheet-v1.png) and the recorded Tripo preview pixels. Keep Zuri, Wangjai and staff identities separate. The existing GLBs, agent records, floor scenes, logo and business integration are unchanged. No provider generation, cache extraction or credit use is part of this work.

The owner approved an editable Blender workflow: MPFB human base → character shape/material work → topology/UV → rig/animation → game validation → GLB in Character Lab. MPFB is a base, not an approved branded face. Wangjai needs its own mascot pipeline.

## Delivery sequence

1. Install a pinned portable Blender and the official MPFB extension; verify archive hashes, addon registration and creation of a human mesh. Install the relevant Blender Agent Skills through the Codex skill installer. Keep third-party tool source outside the product tree.
2. Set up the optional local MCP connection with telemetry disabled, without changing unrelated clients or enabling paid providers. Test the local bridge separately from the headless asset build.
3. Create a reproducible Blender authoring script and a `.blend` source with named collections, metre scale, references, editable base and review mesh. Start with a Zuri face/body-base pilot; preserve previous clothing/rig elements explicitly when reused. Do not imply that an automated base is a finished sculpt.
4. Export a separate `zuri-blender-pilot.glb` and metadata. Add a labelled Lab version choice with unchanged previous versions. Show front/side/back/face and reference comparison. A static anatomy study must not offer nonexistent animation clips.
5. Inspect exported bytes and mesh/material dimensions, reopen the `.blend` and GLB, render review views, run applicable Lab tests/build and browser checks. Record unresolved art work honestly.

## Asset and acceptance contract

- Zuri body reference height: 1.60 m; forward direction +Z in glTF, +Z up in Blender. Apply export coordinate conversion once.
- Brown bob, amber hair clip, round glasses, warm skin, cream cardigan, charcoal inner shirt/trousers, cream/amber shoes from the approved sheet.
- No disconnected joint balls. Continuous facial topology and real eye/lid/nose/lip surfaces; avoid painted geometry claims.
- Pilot budget: under 150k rendered triangles and 15 MiB GLB. These are Lab review ceilings, not final crowd-render budgets.
- Local `.blend` is the editable source. GLB is a portable review output. Tool versions, licenses and SHA-256 go into provenance; software GPL does not automatically describe generated model licensing.
- Stage gates: tool smoke PASS does not mean model quality PASS; static geometry does not prove animation; Lab review does not authorize floor adoption.

## Verification and evidence

Tool installation and the static face-fitting pilot are implemented. See
[the execution record](../../game-design/characters/2026-10-25-brand-study/blender-pilot/README.md)
and ignored `reports/blender-character-pilot/`. Blender/MPFB creation, MCP scene
read, source reopen, GLB reimport, new face QA, repository tests and application
build passed. The candidate remains a static art study: full rig/motion and
visual acceptance are subsequent gates, not completed claims.
