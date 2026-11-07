# Projects grid placement

Owner request: Sims-like click/drag furniture movement by floor cells; occupied
cells must not be walking paths. Retain painted skins, solid models, fixed camera,
brand, Agent identities and explicit per-floor persistence. Synthetic only.

Use the metric blueprint with 0.5 m cells, not a screen-pixel grid. Existing items
are not silently snapped. Moving a movable prop snaps its local origin to the
nearest grid intersection. Green preview is valid; red preview cannot commit.
Validate the entire measured footprint against room bounds, other furniture,
wall spans, closed doors, authored forbidden areas and actor positions. Opening
doorways must retain furniture-free access. Escape/cancel restores a drag.

The same grid computes occupancy from raw actual mesh footprints. Navigation
rejects occupied whole cells as well as its existing padded mesh/wall checks.
Chair/sofa seat access retains only the existing explicit seat-owner exception;
never ignore desks or walls to make a route succeed. Rebuild navigation after
commit, not on every transient preview. Custom seat/approach anchors attached to
a moved item move by the same delta; routes remain authored and revalidated.

Projects gets a local **จัดห้อง** mode with select→click-cell or drag, pause,
Save/Cancel and Undo. It is available only when local presentation storage is
authorized (including explicit synthetic art preview), never on connected live
authority baselines. Studio reuses the same grid toggle, snapping and validation.
Drafts must survive rejected placement/save conflicts; no automatic writes.

Persist optional `placementGrid: {cellSize: 0.5}` in the existing room/floor
format. Old files without it retain continuous navigation. Reject malformed or
out-of-scope imports. View state and preview cells are never saved.

Acceptance: true metric snap; no overlap/outside/wall placement; occupied cells
block path and old cells clear after moving; valid seat access and doors still
work; preview cancellation restores both skin/mesh; one history entry per move;
floor-scoped revision checks, Save/reload, original Agent IDs/count unchanged.
