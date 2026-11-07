# Character Lab comparison models

These are third-party evaluation candidates, not approved Zuri characters.
Attribution is also embedded in each GLB's `asset.copyright` field.

## Rigged Anime Girl

- Author: **3dquads blender**.
- Source: https://www.blendkit.com/asset-gallery-detail/1d63f553-863b-41d4-b3bd-d92222700fee/
- Asset version: `bdaf4063-d8be-4bdb-b8f8-b4cc32a052b1`, version 1.
- License: **CC0-1.0**, confirmed by official asset metadata (`license: cc_zero`).
- License text: https://creativecommons.org/publicdomain/zero/1.0/legalcode
- Changes: decoded the official Draco/WebP GLB, capped textures at 2K and
  normalized display height to 1.65 m. Original skin retained. No authored
  animation clips are supplied in the downloaded source or this derivative.

## Rain

- Credit: **Rain Rig (CC) Blender Foundation | studio.blender.org**.
- Source: https://studio.blender.org/characters/rain/v3/
- Official archive contains `Rain v3.3/rain_v3.2.blend`; preserve this version
  discrepancy instead of silently renaming the source.
- License: **CC-BY-4.0**, confirmed on the source page and embedded `ReadMe.txt`.
- License text: https://creativecommons.org/licenses/by/4.0/legalcode
- Changes: evaluated static geometry with one subdivision level; flattened
  supplied UDIM tiles and baked original Base Color shader networks into textures;
  simplified roughness, omitted auxiliary cornea/dot and duplicate viewport shells,
  normalized display height to 1.65 m. This GLB is a static appearance comparison.
  The full body/facial rig remains in the untouched Blender source archive.

## Zuri adaptation from Rigged Anime Girl

- Files: `zuri-anime.glb`, `zuri-anime.json`; editable derivative:
  `assets-source/characters/candidates/zuri-anime.blend`.
- Base author/source/license: **3dquads blender**, the Rigged Anime Girl asset
  linked above, **CC0-1.0**. The original download and normalized candidate are
  preserved unchanged. Source attribution is embedded in the derivative GLB.
- Local changes: softened face, warm skin/lips and brown eyes, new bob and bangs,
  glasses and orange clip, cream cardigan/dark clothing/cream-orange footwear,
  a 53-bone game skeleton, transferred weights, and three locally authored motion
  studies (`idle`, `walking`, `seated`). These clips are not supplied by the source.
- This source-license statement does not dedicate the Zuri brand, approved
  character sheet or local branded design to the public domain. The derivative
  remains a separate Character Lab candidate awaiting visual acceptance.
- Refinement 2 (26 October): locally authored continuous bob surface and strand
  color, iris detail, proportional face/lash changes and fitted sleeve boundary.
  Revision 1 is retained under `assets-source/characters/candidates/revisions/`.
- Refinement 3 (26 October): locally authored flowing bob topology with tapered
  tips, chestnut strand color, cheek/chin/mouth/eye refinements and fitted glasses.
  Revision 2 is also retained in the revisions folder. Base credit and the
  Lab-only, pending-art-acceptance boundary remain unchanged.

The author rigs do not supply walk/sit clips. Neither candidate is approved for
the live floor roster. Do not remove attribution when distributing Rain files.
