"""Reopen the actual Zuri adaptation and render deformation review evidence."""
import bpy,json,sys,os
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];O=R/os.environ.get('ZURI_ANIME_REVIEW_DIR','reports/zuri-anime-adaptation');O.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(R/'web/assets/models/characters/candidates/zuri-anime.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
widgets={b.custom_shape for b in rig.pose.bones if b.custom_shape}
obs=[o for o in bpy.context.scene.objects if o.type=='MESH'and o not in widgets]
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='CUDA';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='CUDA'
    scene.cycles.device='GPU'
except Exception:pass
scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('ZuriReview');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.32,.32,.32,1)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,power,loc,size in [('Key',350,(-3,-4,5),4),('Fill',160,(3,-2,3),3),('Rim',250,(1,3,4),3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;aim(o,(0,0,1))
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);scene.collection.objects.link(cam);scene.camera=cam;d.lens=50
def action(name,frame=1):
    for t in rig.animation_data.nla_tracks:t.mute=True
    rig.animation_data.action=next(a for a in bpy.data.actions if a.name==name or a.name.endswith('_'+name)or a.name.endswith('|'+name))
    scene.frame_set(frame);bpy.context.view_layer.update()
def render(name,target,offset,distance):
    cam.location=Vector(target)+Vector(offset).normalized()*distance;aim(cam,target);scene.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True)
action('idle')
render('front',(0,0,1.497),(0,-1,.01),.78)
render('quarter',(0,0,1.497),(.6,-1,.015),.78)
render('profile',(0,0,1.497),(1,0,.01),.78)
render('full',(0,0,.84),(.25,-1,.08),2.65)
action('seated');render('seated',(0,-.08,.65),(1,-1,.25),2.3)
action('walking',10);render('walking',(0,0,.84),(.6,-1,.06),2.65)
action('idle')
sys.path.insert(0,str(Path.home()/'.codex/skills/blender-asset-qa/scripts'))
import qa_check
qa=qa_check.run(objects=[o.name for o in obs],profile='game')
(O/'raw-qa.json').write_text(json.dumps(qa,indent=2))
dg=bpy.context.evaluated_depsgraph_get();points=[]
for o in obs:
    ev=o.evaluated_get(dg);me=ev.to_mesh();points.extend([ev.matrix_world@v.co for v in me.vertices]);ev.to_mesh_clear()
result={'reopened':True,'boundsMin':[min(p[i]for p in points)for i in range(3)],'boundsMax':[max(p[i]for p in points)for i in range(3)],'bones':len(rig.data.bones),'actions':[a.name for a in bpy.data.actions],'rawQaPass':qa['pass'],'rawQaErrors':qa['errors'],'warningCount':len(qa['warnings'])}
(O/'roundtrip.json').write_text(json.dumps(result,indent=2));print('ROUNDTRIP',json.dumps(result))
for o in obs:w=o.modifiers.new('ReviewWire','WIREFRAME');w.thickness=.00035;w.use_replace=True
render('wire',(0,0,1.497),(.6,-1,.015),.78)
if not qa['pass']:
    raise RuntimeError('Exported character failed geometry QA; inspect raw-qa.json')
