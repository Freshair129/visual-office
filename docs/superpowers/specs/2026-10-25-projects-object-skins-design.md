# Projects object skins

Owner-approved direction (25 October 2026): retain the measured Projects sheet,
add illustrated 2.5D skins over individual physical objects, and expose skin,
solid model and wireframe visibility without replacing the scene or camera.

The earlier single whole-scene beauty bake is insufficient: it depicts the
models themselves rather than the established illustrated Office art direction.
This refinement supersedes that visual interpretation, not the metric source,
collision, identity, per-floor persistence or original brand.

## Approach

Use camera-projected illustrated textures on the actual object surfaces. Each
skin is produced against a tight reference render of its own geometry using the
fixed Office camera. The projection is object-local, so moving or scaling the
object also moves/scales the illustration. Physical geometry retains depth,
occlusion, ray picking, shadows and collision. Do not introduce a floating DOM
sprite or a second independently laid-out room. Whole-room illustration was
rejected because edits and occlusion would drift; a model beauty bake alone
cannot provide the requested painterly art.

First deliverable: desk, chair, sofa, water cooler, plant and board skins plus
painted wall/floor surface treatment. The wayfinding arrow and floor-name sign
retain their existing semantic graphics. Actors remain 3D and are never counted
as furniture. Generated skins cannot change collision or inventory.

## Controls and lifecycle

Three independent view controls in Projects and Studio: skin, model, wireframe.
Skin takes precedence over model colour where enabled; both use the same depth
surface. Wireframe is an optional diagnostic overlay of that same geometry.
All-off hides static presentation, never removes obstacles or agents. View
controls are transient; scene transforms continue to save per floor normally.
Restore original materials when disabled, on room change and disposal. Texture
loading must not resurrect disposed objects; failures expose solid models and
an explicit asset warning rather than claiming a skin is loaded.

## Acceptance

- Same renderer, camera, object and actor identities across all layer switches.
- Skin projection follows a moved/scaled desk and remains inside its geometry.
- Model and wireframe can be inspected independently in the same scene.
- Actual mesh bounds drive navigation; complete desk/water/sofa routes and reject
  wall/desk-crossing segments, including closed doors.
- Studio Save/reload and runtime use the same floor snapshot; other floors and
  Agent IDs/count/roles remain unchanged. Synthetic only; no live platform calls.
