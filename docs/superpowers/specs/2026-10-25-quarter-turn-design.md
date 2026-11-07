# Quarter-turn furniture placement

Owner-approved extension: rotate desks, chairs and movable decor in 90 degree
steps in the existing grid build mode; skin follows physical geometry; show
occupied cells before confirming; retain local per-floor Save and Agent identity.

Optional object `rotation` is one of 0/90/180/270 degrees relative to its original
sheet orientation. Omitted means 0. Preserve legacy flip and non-sheet files.
Validate the rotated actual geometry footprint, not a screen rectangle or old
width. Rotation is a transient preview until **วางชิ้นนี้** or click/drop; invalid
placements remain red and cannot commit. Further rotations can recover a valid
orientation. Escape/cancel restores the source, one confirmed action is one Undo.

Use the same four geometry-reference orientations to produce four registered
illustrated atlases. Runtime projection, solid model, wireframe and measured
bounds use the same angle. Loading/failure falls back explicitly to solid colour;
never stretch the single front illustration around a different side. Retain
reference hashes, prompts, existing palette, brand and actors.

Custom seat/approach anchors rotate around the item's ground pivot and translate
with it. A chair-owned custom desk seat follows that chair. Strictly validate
anchor bounds before committing. Recompute grid occupancy and navigation after
confirmation; no motion through old/stale bounds. Default interaction approaches
and sofa heading follow the quarter turn. Agent inventory and roles never change.

Projects gets rotate/confirm/cancel-preview controls in its existing build bar;
Studio reuses the grid preview controller. Save/cancel/stale protection remains
unchanged. Synthetic only, fixed isometric camera; no live platform writes.
