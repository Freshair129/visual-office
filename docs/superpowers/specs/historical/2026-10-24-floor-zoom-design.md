# Floor zoom and structure inspection

Owner requests wheel zoom, touch pinch, whole-floor fit, reset and a temporary art/structure toggle. Preserve original brand, scene state, roles and fixed HUD.

Use the existing sized scrolling map rather than a CSS transform (which leaves incorrect scroll extents) or a separate camera zoom (which would separate painted art from meshes). Resize the whole shared image/canvas map uniformly. Zoom anchors to the cursor or pinch midpoint; clamp from whole-floor fit to 3x baseline. Reset returns the expanded baseline and centre; Fit shows all of the 3:2 floor. Resize preserves bounded zoom. Dialogs and HUD retain viewport coordinates. Wheel inside an object dialog keeps its own scrolling.

Two-touch gestures prevent native page zoom and scale the map; one-touch scrolling remains native. Remove all listeners on navigation. View transforms are transient, never scene inventory or business writes.

Dev mode rebuilds only the Hybrid presentation renderer with procedural geometry instead of painted planes and backdrop. Toggle back restores original artwork. It is an inspection aid, not new final art; no saved-floor migration. If WebGL is unavailable it reports that limitation rather than claiming a visible skeleton. Native editions keep their existing renderer.
