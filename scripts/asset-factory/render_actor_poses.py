"""Render named actor actions in a separate background Blender process."""
import sys
from pathlib import Path
import bpy
from mathutils import Vector

if not bpy.app.background or '--factory-startup' not in sys.argv:
    raise RuntimeError('requires background factory startup')
args=sys.argv[sys.argv.index('--')+1:]
if len(args)!=1: raise ValueError('expected output directory')
out=Path(args[0]).resolve(); out.mkdir(parents=True,exist_ok=True)
rig=bpy.data.objects.get('OfficeRig')
if rig is None: raise ValueError('OfficeRig missing')
camera_data=bpy.data.cameras.new('PreviewCamera')
camera=bpy.data.objects.new('PreviewCamera',camera_data)
bpy.context.scene.collection.objects.link(camera)
camera.location=(4,-4,4.29)  # azimuth 45 degrees, elevation approximately 31.3 degrees
target=Vector((0,0,.85))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO';camera_data.ortho_scale=2.35
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True
scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
views=[(name,frame,name) for name,frame in [('idle',1),('walk',8),('sitting',16),('typing',8),('waving',8)]]
views += [('walk',frame,f'walk-{frame:02d}') for frame in (0,3,7,10,14,17,21,24,27)]
for name,frame,label in views:
    action=bpy.data.actions.get(name)
    if action is None: raise ValueError('missing action: '+name)
    rig.animation_data.action=action;scene.frame_set(frame)
    scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
