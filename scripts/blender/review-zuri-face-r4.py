"""Matched render and geometry review of actual exported baseline/revision4 GLBs."""
import bpy,json,sys,os,hashlib
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];OUT=R/'reports/zuri-face-r4';OUT.mkdir(parents=True,exist_ok=True)

def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
for version,file in [('before','zuri-anime.glb'),('after','zuri-face-r4.glb')]:
 if version=='before'and (os.environ.get('FACE_R4_ONLY_AFTER')=='1'or os.environ.get('FACE_R4_QA_ONLY')=='1'):continue
 bpy.ops.wm.read_factory_settings(use_empty=True)
 asset=R/'web/assets/models/characters/candidates'/file;digest=hashlib.sha256(asset.read_bytes()).hexdigest()
 bpy.ops.import_scene.gltf(filepath=str(asset))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 for track in rig.animation_data.nla_tracks:track.mute=True
 rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='idle' or a.name.endswith('|idle'))
 scene=bpy.context.scene;scene.frame_set(1);scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
 prefs=bpy.context.preferences.addons['cycles'].preferences
 try:
  prefs.compute_device_type='CUDA';prefs.get_devices()
  for device in prefs.devices:device.use=device.type=='CUDA'
  scene.cycles.device='GPU'
 except Exception:pass
 scene.render.resolution_x=640;scene.render.resolution_y=720;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('FaceReviewWorld');scene.world.use_nodes=True
 next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.32,.32,.32,1)
 for name,power,loc,size in [('Key',350,(-3,-4,5),4),('Fill',160,(3,-2,3),3),('Rim',250,(1,3,4),3)]:
  data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;aim(o,(0,0,1))
 data=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',data);scene.collection.objects.link(cam);scene.camera=cam;data.lens=50
 target=Vector((0,0,1.497))
 for view,direction in [('front',(0,-1,.01)),('quarter',(.6,-1,.015)),('profile',(1,0,.01))]:
  if os.environ.get('FACE_R4_QA_ONLY')=='1':break
  cam.location=target+Vector(direction).normalized()*.78;aim(cam,target);scene.render.filepath=str(OUT/(version+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
 if version=='after':
  # glTF import creates an Icosphere custom bone display object that is not a
  # mesh in the asset. Its empty material/-1m bound must not become asset findings.
  widgets={bone.custom_shape for bone in rig.pose.bones if bone.custom_shape}
  objects=[o for o in scene.objects if o.type=='MESH'and o not in widgets]
  sys.path.insert(0,str(Path.home()/'.codex/skills/blender-asset-qa/scripts'));import qa_check
  qa=qa_check.run(objects=[o.name for o in objects],profile='game')
  (OUT/'raw-qa.json').write_text(json.dumps(qa,indent=2))
  ob=bpy.data.objects['Retopo-Girl'];ev=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();pts=[ev.matrix_world@v.co for v in me.vertices];ev.to_mesh_clear()
  landmarks={name:min(p.y for p in pts if abs(p.x)<.008 and abs(p.z-z)<.003)for name,z in [('chin',1.405),('lips',1.435),('noseTip',1.465),('bridge',1.485)]}
  profile_ok=landmarks['noseTip']<landmarks['bridge']-.008 and landmarks['lips']<landmarks['chin']-.005 and landmarks['noseTip']<landmarks['lips']-.006
  assert hashlib.sha256(asset.read_bytes()).hexdigest()==digest,'Asset changed during review'
  summary={'assetSha256':digest,'meshObjects':len(objects),'excludedImporterHelpers':[o.name for o in widgets if o],'pass':qa['pass']and profile_ok,'geometryPass':qa['pass'],'profilePass':profile_ok,'profileLandmarks':landmarks,'errors':qa['errors'],'warnings':len(qa['warnings']),'bones':len(rig.data.bones),'actions':[a.name for a in bpy.data.actions]}
  (OUT/'roundtrip.json').write_text(json.dumps(summary,indent=2));print('R4_QA',json.dumps(summary),flush=True)
  if os.environ.get('FACE_R4_QA_ONLY')!='1':
   for o in objects:
    wire=o.modifiers.new('ReviewWire','WIREFRAME');wire.thickness=.00035;wire.use_replace=True
   cam.location=target+Vector((.6,-1,.015)).normalized()*.78;aim(cam,target);scene.render.filepath=str(OUT/'after-wire.png');bpy.ops.render.render(write_still=True)
  if not summary['pass']:raise RuntimeError('Geometry/profile QA failed; inspect raw-qa.json and roundtrip.json')
