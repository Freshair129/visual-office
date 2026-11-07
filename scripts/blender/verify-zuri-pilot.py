"""Independent reopen, geometry inspection and review views for the pilot."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'reports/blender-character-pilot'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-source/characters/zuri-blender-pilot.blend'))
sys.path.insert(0,str(Path.home()/'.codex/skills/blender-asset-qa/scripts'))
import qa_check
head_report=qa_check.run(objects=['Zuri_MPFB_Face'],profile='game')
(OUT/'face-qa.json').write_text(json.dumps(head_report,indent=2),encoding='utf8')
print('FACE_QA',head_report['pass'],head_report['errors'])
scene=bpy.context.scene;cam=scene.camera
for name,loc,target,size in [('face-three-quarter',(1,-2,1.52),(0,0,1.52),.56),('face-side',(2,0,1.52),(0,0,1.52),.56),('body-front',(0,-3,1),(0,0,.85),1.95),('body-back',(0,3,1),(0,0,.85),1.95)]:
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=size
    scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
# Reimport in a fresh disposable process scene. Source .blend was already saved.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'web/assets/models/characters/reviews/zuri-blender-pilot.glb'))
bpy.context.view_layer.update()
meshes=[o for o in bpy.context.selected_objects if o.type=='MESH']
coords=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
lo=[min(p[i] for p in coords) for i in range(3)];hi=[max(p[i] for p in coords) for i in range(3)]
assert len(meshes)>=90
assert 1.55<hi[2]-lo[2]<1.8
assert any(o.name.startswith('Zuri_MPFB_Face') for o in meshes)
assert not any(o.name.startswith('sculpted-face') for o in meshes)
assert not any(o.name.startswith('Zuri_MPFB_Editable_Base') for o in meshes)
result={'blendReopened':True,'glbReimported':True,'meshes':len(meshes),'boundsMin':lo,'boundsMax':hi,'faceQaPass':head_report['pass'],'scope':'Static head pilot; no motion qualification'}
(OUT/'roundtrip.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('ROUNDTRIP',json.dumps(result))
