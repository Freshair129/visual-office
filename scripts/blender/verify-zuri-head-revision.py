"""Reopen source, check new geometry and round-trip the static review asset."""
import bpy,sys,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'reports/zuri-head-correction'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-source/characters/zuri-head-revision.blend'))
sys.path.insert(0,str(Path.home()/'.codex/skills/blender-asset-qa/scripts'))
import qa_check
names=[o.name for o in bpy.data.collections['Zuri_Head_Revision'].objects if o.type=='MESH']
# Full new-head assembly. The unchanged wardrobe is not newly motion-qualified.
# Hair sections are sub-millimetre. A 10 micrometre overlap probe is below
# their authored thickness; the default 1 mm probe crosses entire thin locks.
qa=qa_check.run(objects=names,profile='game',eps=.00001,tol=.003,uv=True)
(OUT/'head-qa.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')
print('QA',json.dumps({'pass':qa['pass'],'errors':qa['errors'],'warnings':qa['warnings']}))
# Check a wire/material review against the same camera, not a substituted scene.
scene=bpy.context.scene;cam=scene.camera;cam.location=(0,-2,1.46);cam.data.ortho_scale=.40
cam.rotation_euler=(Vector((0,0,1.46))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(OUT/'reopened-front.png');bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'web/assets/models/characters/reviews/zuri-head-revision.glb'))
bpy.context.view_layer.update();objects=[o for o in bpy.context.selected_objects if o.type=='MESH']
coords=[o.matrix_world@Vector(p) for o in objects for p in o.bound_box]
lo=[min(p[i] for p in coords) for i in range(3)];hi=[max(p[i] for p in coords) for i in range(3)]
assert 1.55<hi[2]-lo[2]<1.7
assert any(o.name=='Zuri_Refined_Head' for o in objects)
assert not any('MPFB' in o.name or o.name.startswith(('sculpted-face','hair-volume','swept-fringe')) for o in objects)
result={'blendReopened':True,'glbReimported':True,'boundsMin':lo,'boundsMax':hi,'meshes':len(objects),'headQaPass':qa['pass'],'artApproved':False,'floorAdoption':False,'scope':'Static head only; no motion acceptance'}
(OUT/'roundtrip.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print('ROUNDTRIP',json.dumps(result))
