"""Build a skinned, rigid-part prototype rig from the existing Tycoon actor GLB.

Run only in a separate background process with factory startup. This is an
editable candidate, not a visual/deformation approval or a Zuri Agent record.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

if not bpy.app.background or '--factory-startup' not in sys.argv:
    raise RuntimeError('requires a separate background Blender process with --factory-startup')
args = sys.argv[sys.argv.index('--') + 1:]
if len(args) != 2:
    raise ValueError('expected existing actor GLB and separate output directory')
source, output = Path(args[0]).resolve(), Path(args[1]).resolve()
if not source.is_file() or source.suffix.lower() != '.glb':
    raise ValueError('input must be an existing actor GLB')
source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
if source_sha != 'f1d0f905e250d7f8423b4ec9259f7e7c354f965e85c9e30726b3a3c88a3e36da':
    raise ValueError('actor source revision changed; review the source-specific rig and mouth offset')
if any((output/name).exists() for name in ('office-actor-rig.blend','office-actor-rig.glb','office-actor-rig.json')):
    raise FileExistsError('candidate output exists; choose a new output directory')
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
scene = bpy.context.scene
scene.render.fps = 30
# Stop the imported node-animation prototype before taking the bind pose.
for obj in list(scene.objects):
    if obj.animation_data:
        obj.animation_data_clear()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
scene.frame_set(1)
bpy.context.view_layer.update()

names = ['office-body', 'office-torso-pivot', 'office-head-pivot']
for side in ('left', 'right'):
    names += [f'office-{side}-{part}' for part in ('shoulder', 'elbow', 'hand', 'hip', 'knee', 'ankle')]
if any(bpy.data.objects.get(name) is None for name in names):
    raise ValueError('actor is missing expected prototype joints')
points = {name: bpy.data.objects[name].matrix_world.translation.copy() for name in names}
for part in ('shoulder','elbow','hand','hip','knee','ankle'):
    left,right=points[f'office-left-{part}'],points[f'office-right-{part}']
    x=(abs(left.x)+abs(right.x))/2
    y=(left.y+right.y)/2
    z=(left.z+right.z)/2
    points[f'office-left-{part}']=Vector((-x,y,z))
    points[f'office-right-{part}']=Vector((x,y,z))
points['root'] = Vector((0, 0, 0))
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
if not meshes or any(not obj.parent or obj.parent.name not in points for obj in meshes):
    raise ValueError('actor has unrecognized mesh parenting')

arm = bpy.data.armatures.new('OfficeRig')
rig = bpy.data.objects.new('OfficeRig', arm)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bone_specs = [
    ('root', None, 'office-body'),
    ('office-body', 'root', 'office-torso-pivot'),
    ('office-torso-pivot', 'office-body', 'office-head-pivot'),
    ('office-head-pivot', 'office-torso-pivot', None),
]
for side in ('left', 'right'):
    pre = f'office-{side}-'
    bone_specs += [(pre+'shoulder','office-torso-pivot',pre+'elbow'),
                   (pre+'elbow',pre+'shoulder',pre+'hand'), (pre+'hand',pre+'elbow',None),
                   (pre+'hip','office-body',pre+'knee'), (pre+'knee',pre+'hip',pre+'ankle'),
                   (pre+'ankle',pre+'knee',None)]
for name, parent, target in bone_specs:
    bone = arm.edit_bones.new(name)
    if name == 'root': bone.use_deform = False
    bone.head = points[name]
    bone.tail = points[target] if target else points[name] + Vector((0, 0, .12))
    if (bone.tail - bone.head).length < .001:
        bone.tail = bone.head + Vector((0, 0, .12))
    if parent:
        bone.parent = arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

for obj in meshes:
    bone_name = obj.parent.name
    transform = obj.matrix_world.copy()
    obj.data = obj.data.copy()
    obj.data.transform(transform)
    if obj.name == 'office-smile':
        # Seat the mouth overlay against the face; preserve its separate material.
        for vertex in obj.data.vertices: vertex.co.y += .012
    obj.parent = rig
    obj.matrix_world.identity()
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    modifier = obj.modifiers.new('OfficeSkin', 'ARMATURE')
    modifier.object = rig
# Parts on the same rigid bone with the same material can share one draw object.
# No geometry across bones is joined, so pivots and independent deformation remain.
batches = {}
for obj in meshes:
    if len(obj.data.materials) == 1:
        batches.setdefault((obj.vertex_groups[0].name, obj.data.materials[0].name), []).append(obj)
for group in batches.values():
    if len(group) < 2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group: obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if bpy.ops.object.join() != {'FINISHED'}:
        raise RuntimeError('failed to merge rigid parts')
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
for obj in meshes:
    mesh=bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.dissolve_degenerate(mesh, edges=list(mesh.edges), dist=1e-6)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-6)
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()
    # Materials are flat colours. Rebuild non-stacked UVs for future texture work.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    if bpy.ops.uv.smart_project(island_margin=.025) != {'FINISHED'}:
        raise RuntimeError('UV unwrap failed: '+obj.name)
    bpy.ops.object.mode_set(mode='OBJECT')
for obj in list(scene.objects):
    if obj.type == 'EMPTY':
        bpy.data.objects.remove(obj, do_unlink=True)

# In-place motion: the existing navigation controller owns world translation.
clips = ['idle','walk','sit_down','seated_work','stand_up','talk','gesture_point',
         'sitting','typing','waving','thinking','working','waiting','celebrating','blocked','error']
durations = {'idle':3, 'walk':.9, 'sit_down':.8, 'seated_work':2.4,
             'stand_up':.8, 'talk':2.5, 'gesture_point':1.2}
rig.animation_data_create()
def pose(clip, t):
    phase = 2 * math.pi * t
    result = {name: [0.0, 0.0, 0.0] for name, _, _ in bone_specs}
    body_z = 0.0
    if clip == 'walk':
        # In-place stance travels opposite the controller's .85 m/s world motion.
        # A planar two-link solve keeps the planted ankle at its rest height.
        body_z=-.04
        for side, offset, sign in (('left',0,1),('right',.5,-1)):
            u=(t+offset)%1
            if u<.5:
                y=-.19125+.3825*(u/.5); lift=0
            else:
                q=(u-.5)/.5;y=.19125-.3825*q;lift=.09*math.sqrt(max(0,math.sin(math.pi*q)))
            hip=points[f'office-{side}-hip'];knee=points[f'office-{side}-knee'];ankle=points[f'office-{side}-ankle']
            l1=(hip-knee).length;l2=(knee-ankle).length
            dy=y;dz=ankle.z+lift-(hip.z+body_z)
            distance=min(math.hypot(dy,dz),l1+l2-1e-7)
            bend=math.acos(max(-1,min(1,(distance*distance-l1*l1-l2*l2)/(2*l1*l2))))
            angle=math.atan2(dy,-dz)-math.atan2(l2*math.sin(bend),l1+l2*math.cos(bend))
            result[f'office-{side}-hip'][0]=angle
            result[f'office-{side}-knee'][0]=bend
            result[f'office-{side}-ankle'][0]=-(angle+bend)
            result[f'office-{side}-shoulder'][0]=-.28*math.sin(phase)*sign
    sitting = clip in ('sitting','typing','seated_work','working')
    if clip in ('sit_down','stand_up'):
        amount = t if clip == 'sit_down' else 1-t
    else:
        amount = 1.0 if sitting else 0.0
    if amount:
        sit_angle=1.425*amount
        thigh=(points['office-left-hip']-points['office-left-knee']).length
        body_z = -thigh*(1-math.cos(sit_angle))
        for side in ('left','right'):
            result[f'office-{side}-hip'][0] = -sit_angle
            result[f'office-{side}-knee'][0] = sit_angle
            result[f'office-{side}-shoulder'][0] = -.8 * amount
            result[f'office-{side}-elbow'][0] = -.7 * amount
            if clip in ('typing','seated_work','working'):
                result[f'office-{side}-elbow'][0] += .10 * math.sin(phase + (0 if side=='left' else math.pi))
    if clip in ('waving','celebrating'):
        result['office-right-shoulder'][2] = -1.5 + .15*math.sin(phase)
        result['office-right-elbow'][2] = -1.1 + .2*math.sin(phase)
        if clip == 'celebrating': result['office-left-shoulder'][2] = 1.4
    if clip in ('thinking','gesture_point'):
        result['office-right-shoulder'][0] = -.8
        result['office-right-elbow'][0] = -1.1
        result['office-head-pivot'][2] = .10 * math.sin(phase)
    if clip in ('waiting','blocked','error'):
        result['office-head-pivot'][0] = .12 if clip == 'waiting' else .20
    if clip == 'talk': result['office-head-pivot'][2] = .10 * math.sin(phase)
    if clip == 'idle': result['office-torso-pivot'][0] = .025 * math.sin(phase)
    return result, body_z

for clip in clips:
    action = bpy.data.actions.new(clip)
    action.use_fake_user = True
    rig.animation_data.action = action
    end_frame = round(durations.get(clip, 1) * scene.render.fps)
    frames=range(end_frame+1) if clip in ('walk','sit_down','stand_up') else sorted({0, round(end_frame*.25), round(end_frame*.5), round(end_frame*.75), end_frame})
    for frame in frames:
        scene.frame_set(frame)
        values, body_z = pose(clip, frame/end_frame)
        for name, _, _ in bone_specs:
            bone = rig.pose.bones[name]
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = values[name]
            bone.location = (0, body_z if name == 'office-body' else 0, 0)
            bone.keyframe_insert(data_path='rotation_euler', frame=frame, group=name)
            bone.keyframe_insert(data_path='location', frame=frame, group=name)
rig.animation_data.action = None
scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'office-actor-rig.blend'))
bpy.ops.export_scene.gltf(filepath=str(output / 'office-actor-rig.glb'), export_format='GLB',
                          export_animation_mode='ACTIONS', export_force_sampling=True)
report = {'source_sha256': source_sha, 'blender': bpy.app.version_string,
          'rig_type':'rigid parts with one deform bone influence each', 'bones':len(arm.bones),
          'meshes':len(meshes), 'clips':clips, 'quality':'prototype pending deformation and visual review'}
(output / 'office-actor-rig.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('@@RIG_REPORT@@'+json.dumps(report))
