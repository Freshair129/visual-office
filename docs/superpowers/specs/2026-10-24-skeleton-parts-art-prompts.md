# Perspective pack v5: imagegen production record

Built-in image_gen was used, not CLI. Original files were preserved. Selected outputs were copied into the repository before use. This is an art-production record, not a guarantee of exact raster-to-geometry reconstruction. The camera is fixed; individual calibration handles residual silhouette differences.

## Background

Output: web/assets/office-world/hybrid/backgrounds/office-isometric-v5.png
References: original office-isometric-v4.png (style) and reports/dynamic-context/floor-zoom-structure.png (actual Three.js geometry/camera, ignore all HUD).

Prompt: Generate one 1536x1024 landscape 3:2 clean office background for the existing 2.5D simulation. Preserve warm ivory plaster, honey oak trims, amber sunlight, muted sage/taupe floor, softly painted 3D game finish and city greenery from the original. Match the actual model with orthographic azimuth45/elevation31.33, no vanishing-point convergence, vertical lines vertical. Roofless cutaway, rear/right work room, front/left lounge, centre-left walk-through partition doorway, low foreground walls, large rear windows. Room ground origin 50% x/65% y. Parallel floor/wall axes and constant wall thickness. Architecture and fixed finishes only; no movable furniture, desks, chairs, sofa, whiteboard, water dispenser, arrows, elevator, printer, people, characters, UI, text, logos or watermark. No new room, palette change, voxel or pixel style.

## Desk generation and cleanup

Output: web/assets/office-world/hybrid/props/work-desk-isometric-v2.png
References: original work-desk-isometric-v1.png plus the same structure screenshot.

Prompt: Single isolated true-alpha desk. Preserve warm oak top, ivory drawers/legs, two dark monitors, sage mug, paper trays and plant. Correct uneven perspective to orthographic azimuth45/elevation31.33, parallel opposite tabletop edges, symmetric rectangular tabletop, vertical legs. Long edge upper-left to lower-right. No chair/person/room/floor patch/shadow/UI/text/logo. Entire object in frame with modest transparent margins.

Final cleanup prompt: Keep desk, geometry, corrected orthographic angle, colours, plant, monitors and accessories. Remove all background haze, yellow glow, grey gradient, shadows, reflections and dark pixels outside the actual silhouette, including holes between legs. Outside object and antialiased silhouette edge pixels must be zero alpha. Do not replace with black/white/checkerboard; genuine transparency. Do not redesign/rotate. Centre on a square transparent PNG.

## Chair

Output: web/assets/office-world/hybrid/props/task-chair-isometric-v2.png
Reference: original task-chair-isometric-v1.png and the structure screenshot.

Prompt: One square isolated true-alpha ergonomic sage mesh chair, ivory frame, dark five-caster base. Preserve original design and softly painted soft-3D finish. Orthographic azimuth45/elevation31.33, no convergence, vertical post, front three-quarter view facing lower-left. Whole chair, all wheels, symmetric armrests, balanced base. No people/desk/room/floor patch/exterior shadow/glow/reflection/text/UI/logo. Zero alpha outside silhouette, only antialiased edge pixels, modest margins.

## Use

Optional per-floor officeArt=perspective-v5 selects this pack; absence/legacy-v4 uses original files. Calibration never modifies raster anchors, prop inventory, Agent roles or logo assets. Generation does not change scene state until the user selects a pack and saves that floor.
