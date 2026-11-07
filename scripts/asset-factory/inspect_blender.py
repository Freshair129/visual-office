"""Import one existing GLB into a derived Blender source and render a preview.

Run in an isolated background Blender process with --python-exit-code 1:
  blender -b --factory-startup -P scripts/asset-factory/inspect_blender.py -- INPUT.glb OUTPUT_DIR
Never run against the user's live scene. Existing source files are not modified.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

if not bpy.app.background or '--factory-startup' not in sys.argv:
    raise RuntimeError('requires a separate background Blender process with --factory-startup')

args = sys.argv[sys.argv.index('--') + 1:]
if len(args) != 2:
    raise ValueError('expected INPUT.glb OUTPUT_DIR')
source, output = Path(args[0]).resolve(), Path(args[1]).resolve()
if source.suffix.lower() != '.glb' or not source.is_file():
    raise ValueError('input must be an existing GLB')
output.mkdir(parents=True, exist_ok=True)
stem = source.stem
if not stem.replace('-', '').isalnum():
    raise ValueError('unsafe input name')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
objects = list(bpy.context.scene.objects)
meshes = [obj for obj in objects if obj.type == 'MESH']
if not meshes:
    raise ValueError('GLB contains no mesh objects')
bpy.context.view_layer.update()
corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
maximum = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
center = (minimum + maximum) / 2
size = maximum - minimum
report = {
    'kind': stem, 'source': str(source), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'source_role': 'derived import of existing prototype GLB; not original authoring source',
    'blender': bpy.app.version_string, 'blender_build': bpy.app.build_hash.decode(),
    'mesh_objects': len(meshes), 'triangles': sum(len(obj.data.loop_triangles) for obj in meshes),
    'materials': sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}),
    'dimensions_m': list(size), 'min_m': list(minimum), 'max_m': list(maximum),
    'armatures': sum(obj.type == 'ARMATURE' for obj in objects),
    'imported_actions': sorted(action.name for action in bpy.data.actions),
    'quality': 'prototype; visual and rig review pending',
}
for obj in meshes:
    obj.data.calc_loop_triangles()
report['triangles'] = sum(len(obj.data.loop_triangles) for obj in meshes)

# Create a separate, clearly named inspection camera and retain it in the derived copy.
camera_data = bpy.data.cameras.new('QA_OrthographicCamera')
camera = bpy.data.objects.new('QA_OrthographicCamera', camera_data)
bpy.context.scene.collection.objects.link(camera)
direction = Vector((1, -1, math.tan(math.asin(.52)) * math.sqrt(2))).normalized()
camera.location = center + direction * max(4.0, size.length * 2)
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = max(size.x + size.y, size.z * 1.5, 1) * 1.25
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(output / f'{stem}-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(output / f'{stem}-derived.blend'))
bpy.ops.render.render(write_still=True)
(output / f'{stem}-inspection.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('@@ASSET_REPORT@@' + json.dumps(report))
