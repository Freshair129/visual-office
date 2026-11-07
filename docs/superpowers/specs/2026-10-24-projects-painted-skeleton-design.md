# Projects: original art with a 3D skeleton

Owner direction, 24 October 2026: continue from the restored original design.
Use Projects first. Keep the logo, palette and scene style. Use 3D to support
depth, collision and walking rather than replacing the illustrated environment.

## Approach

Keep the existing Painted office PNG as the backdrop. Render the existing
furniture images as camera-facing, alpha-tested planes inside the same Three.js
depth buffer as the existing articulated people. Use depth-only wall meshes
from the calibrated legacy room architecture: walls write depth but no colour,
so an occluded person reveals the original painted wall underneath. This preserves
the original artwork without generating replacement art. A fully visible GLB room
would change the art; DOM-only z-index sorting cannot provide partial wall occlusion.

Projects' non-blueprint Office room selects this presentation in the shared
HybridScene, including Studio previews. Explicit custom blueprints retain their
existing geometry renderer because arbitrary walls cannot match a fixed PNG.
No saved room is migrated, removed or silently assigned a different blueprint.

## Coordinates and motion

Reuse officeSceneCamera/groundToWorld, calibrated to the artwork. Existing room
objects, wall spans, furniture footprints and navigation stations remain the source
for movement. Test every route segment; walls and furniture remain obstacles.
Seat entry may ignore only its own chair/sofa footprint, never desks or walls.
Character activity is local simulation; counts, roles and platform authority stay
outside presentation. Disable free ambient sprite movement if WebGL is unavailable.

## Acceptance

- Campus and Lobby images, brand SVGs and source image bytes stay unchanged.
- Projects shows the original painted room and catalog furniture artwork.
- Wall masks write depth with colour writes disabled; furniture alpha holes do
  not occlude. Masked pieces cannot be picked through foreground walls.
- Desk-to-water/lounge routes stay within the permitted floor and avoid obstacles.
- Pause, reduced motion, hidden document, context loss and disposal are safe.
- Existing saved rooms, other floors and dynamic synthetic qualification remain intact.
- Full tests/build and browser Projects checks use synthetic only.

This slice does not calibrate arbitrary user-painted rooms, migrate custom plans,
or claim live Zuri agent telemetry or connected command acceptance.

## Owner follow-up: fullscreen floor UI

Internal floors use the same immersive pattern as Lobby: no permanent sidebar,
page header, room card frame or margins around the scene. Keep the brand HUD and
dock over the room. Move roster/business details into a modal opened by a Team
button. Elevator, edit-floor and centre-view buttons remain directly accessible.
Projects is the painted skeleton example; other existing floor editions keep their
renderer under the same shell.

At Full HD the scene covers the viewport without changing the 3:2 art/camera
ratio; excess ground is pannable rather than stretched. On narrow screens retain
a minimum 1,728 CSS-pixel scene width and allow native two-axis scrolling,
mouse dragging on empty ground and keyboard arrows. Mobile must not shrink the
entire floor to phone width. HUD and object popups stay anchored to the viewport,
with bounded modal sizes. Navigating away closes the team dialog and detaches
gesture handlers; a new floor starts at its room centre.

Retained `native3d` snapshots get the fullscreen shell and large scrollable map,
but keep their own canvas mesh picking/orbit controls. Viewport mouse-drag skips
that canvas to avoid stealing furniture clicks; use native scrolling or viewport
arrow keys there. Native empty-ground drag/fixed-camera parity is not delivered
by this Projects painted slice. This does not migrate or overwrite native layouts.

## Panning room refinement

Owner requested more travel after the initial fullscreen delivery. Scale the cover-sized
map uniformly by 1.2, keeping 3:2 art projection: Full HD becomes 2304 × 1536
CSS px (384 px horizontal and 456 px vertical travel); portrait minimum is
1728 × 1152 px. Keep centre start, fixed HUD, object picking and scene state intact.
Implementation: adjust the shared size helper and CSS fallback; verify the size
regression, existing gesture tests, build and built Worker viewport.
