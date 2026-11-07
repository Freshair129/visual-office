"""Reopen actual derivative, collect raw QA and neutral material/wire renders."""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];kind=sys.argv[sys.argv.index('--')+1]
assert kind in ('anime','rain')
OUT=ROOT/'reports/free-character-candidates'/kind
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'web/assets/models/characters/candidates'/(kind+'.glb')))
widgets={b.custom_shape for o in bpy.context.scene.objects if o.type=='ARMATURE' for b in o.pose.bones if b.custom_shape}
obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in widgets];bpy.context.view_layer.update()
sys.path.insert(0,str(Path.home()/'.codex/skills/blender-asset-qa/scripts'))
import qa_check
qa=qa_check.run(objects=[o.name for o in obs],profile='render')
(OUT/'raw-qa.json').write_text(json.dumps(qa,indent=2))
points=[o.matrix_world@Vector(p) for o in obs for p in o.bound_box]
result={'glbReopened':True,'boundsMin':[min(p[i] for p in points) for i in range(3)],'boundsMax':[max(p[i] for p in points) for i in range(3)],'meshes':len(obs),'materials':len({m.name for o in obs for m in o.data.materials if m}),'rawQaPass':qa['pass'],'rawQaErrors':qa['errors'],'rawQaWarningCount':len(qa['warnings']),'artApproved':False,'floorAdoption':False}
(OUT/'roundtrip.json').write_text(json.dumps(result,indent=2))
print('VERIFIED',json.dumps(result),flush=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='CUDA';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='CUDA'
    scene.cycles.device='GPU'
except Exception:scene.cycles.device='CPU'
scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('ReviewWorld');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.35,.35,.35,1)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,power,loc,size in [('Key',350,(-3,-4,5),4),('Fill',180,(3,-2,3),3),('Rim',250,(1,3,4),3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;aim(o,(0,0,1))
d=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',d);scene.collection.objects.link(cam);scene.camera=cam;d.lens=50
meta=json.loads((ROOT/'web/assets/models/characters/candidates'/(kind+'.json')).read_text())
fp=meta['facePoint'];target=Vector((fp[0],-fp[2],fp[1]));dist=meta['faceDistance']*1.35
for name,offset in [('front',(0,-1,.02)),('quarter',(.6,-1,.04)),('profile',(1,0,.04))]:
    cam.location=target+Vector(offset).normalized()*dist;aim(cam,target);scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
# Topology review rendered from the same exported geometry.
for o in obs:
    w=o.modifiers.new('Review wire','WIREFRAME');w.thickness=.00045;w.use_replace=True
cam.location=target+Vector((.6,-1,.04)).normalized()*dist;aim(cam,target);scene.render.filepath=str(OUT/'wire.png');bpy.ops.render.render(write_still=True)
