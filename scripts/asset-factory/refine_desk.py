"""Repair the pinned prototype desk GLB in a separate Blender process."""
import hashlib
import json
import sys
from pathlib import Path
import bmesh
import bpy

if not bpy.app.background or '--factory-startup' not in sys.argv:
    raise RuntimeError('requires a separate background Blender process with --factory-startup')
args=sys.argv[sys.argv.index('--')+1:]
if len(args)!=2: raise ValueError('expected source GLB and output directory')
source,out=Path(args[0]).resolve(),Path(args[1]).resolve()
sha=hashlib.sha256(source.read_bytes()).hexdigest()
if sha!='de6c816da6a192ac5226f7b4aad9339c72241321bc122a02151beec202b128fb':
    raise ValueError('desk source revision changed; review contact-face cleanup')
if any((out/name).exists() for name in ('desk-refined.blend','desk-refined.glb','desk-refined.json')):
    raise FileExistsError('candidate output exists; choose a new output directory')
out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
bpy.context.view_layer.update()
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
if {o.name for o in meshes} != {f'Mesh_{i}' for i in range(13)}:
    raise ValueError('unexpected source desk mesh names')
for obj in meshes:
    transform=obj.matrix_world.copy();obj.data=obj.data.copy();obj.data.transform(transform)
    obj.parent=None;obj.matrix_world.identity()
    bm=bmesh.new();bm.from_mesh(obj.data);bm.normal_update()
    if obj.name in ('Mesh_3','Mesh_4','Mesh_9','Mesh_10','Mesh_11','Mesh_12'):
        # Contact faces under the stacked books, keyboard, stripes, mug and coffee.
        hidden=[face for face in bm.faces if face.normal.z < -.99]
        bmesh.ops.delete(bm,geom=hidden,context='FACES')
    elif obj.name=='Mesh_5':
        # This material also owns the monitor: remove only its tabletop contacts.
        hidden=[face for face in bm.faces if face.normal.z < -.99 and abs(face.calc_center_median().z-.725)<.002]
        bmesh.ops.delete(bm,geom=hidden,context='FACES')
    elif obj.name=='Mesh_2':
        # Drawer pulls contact the cabinet behind their +Y faces.
        hidden=[face for face in bm.faces if face.normal.y > .99]
        bmesh.ops.delete(bm,geom=hidden,context='FACES')
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-6)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    if bpy.ops.uv.smart_project(island_margin=.025) != {'FINISHED'}: raise RuntimeError('UV unwrap failed: '+obj.name)
    bpy.ops.object.mode_set(mode='OBJECT')
for obj in list(bpy.context.scene.objects):
    if obj.type=='EMPTY':bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'desk-refined.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'desk-refined.glb'),export_format='GLB')
(out/'desk-refined.json').write_text(json.dumps({'source_sha256':sha,'blender':bpy.app.version_string,'mesh_objects':len(meshes),'status':'candidate pending QA'},indent=2)+'\n',encoding='utf-8')
