# Continuous office character correction

Owner correction, 25 October 2026: the segmented capsule body and visible round
joint pieces are rejected. Earlier actor/navigation test passes do not constitute
visual acceptance. Generic office adults need continuous clothing/skin that bends
with the pose, with a considered adult silhouette rather than a robot/mannequin.

## Bounded design

Replace body construction in `office-characters.js` with modest indexed garment
surfaces and skin-weighted deformation. Shirt torso and sleeves share stitched
vertices at the shoulders; each trouser leg is a continuous surface through the
knee. Wrists terminate in natural clothing cuffs; no elbow/knee/shoulder ball
meshes or capsule limb segments remain. Tailored waist, chest, hips, calf taper,
collar and low-profile shoes define the silhouette. Hands have a joined palm and
finger form; the existing 12 palettes and six hair silhouettes remain.
The scalp front hairline must expose forehead, eyes, nose and mouth. Replace the
oversized cylindrical collar pieces with a small tailored collar. Audit elbow
bend sign and relaxed arm separation from the torso in every close-up pose.

Use actual Three.js bones and SkinnedMesh. Preserve public create/update/dispose
functions, named rig pivots, root placement ownership, measured leg lengths,
seat-height solver, ground-contact soles and current status/navigation rules.
The figure remains a stylized adult about 1.7 m tall. Geometry stays below the
existing 18,000-triangle budget. No paid provider, external model license or
platform contract is introduced.

Existing GLB generation remains the sole artifact writer. Actor clip collection
must include bones so the exported actor deforms rather than retaining static
garments. Palette/hair variants and generated asset identity are unchanged.
Loaded skinned instances must use skeleton-aware cloning so every actor owns its
pose bones; ordinary Object3D cloning is insufficient. Dispose each owned skeleton
once, including its GPU bone texture, when characters, instances or source caches
are released. Geometry/material sharing retains its existing ownership boundary.

## Acceptance

Tests check connected garment topology and shared seam edges, valid normalized
skin weights, stable vertex counts across poses, finite deformed vertices and
normals, bounded elbow/knee deformation, retained foot and seat alignment, and
animation-bearing exported skin. Review close-up front, side and isometric idle,
walk and seated poses. Code/tests prove mechanics; the browser contact sheet and
owner review decide whether the new silhouette and surfaces are acceptable.
This remains a modest low-poly stylized office person, not a photorealistic human
or an acceptance claim for realistic skin, fingers or cloth simulation.
Furniture skins, camera, rooms, roster, status, roles and saved scenes are outside
this change.
