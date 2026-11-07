"""Read normalized candidate geometry/rig for a separate Zuri derivative."""
import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(R/'assets-source/characters/candidates/anime-lab.blend'),use_scripts=False)
bpy.context.view_layer.update()
out=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    pts=[o.matrix_world@v.co for v in o.data.vertices]
    out.append({'name':o.name,'vertices':len(pts),'lo':[min(p[i]for p in pts)for i in range(3)],'hi':[max(p[i]for p in pts)for i in range(3)],'materials':[m.name for m in o.data.materials], 'groups':len(o.vertex_groups)})
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
bones=[{'name':b.name,'head':list(rig.matrix_world@b.head_local),'tail':list(rig.matrix_world@b.tail_local),'parent':b.parent.name if b.parent else None} for b in rig.data.bones]
mats=[]
for m in bpy.data.materials:
    if not m.node_tree:continue
    mats.append({'name':m.name,'nodes':[{'name':n.name,'type':n.type,'image':n.image.name if n.type=='TEX_IMAGE'and n.image else None}for n in m.node_tree.nodes]})
O=R/'reports/zuri-anime-adaptation';O.mkdir(parents=True,exist_ok=True)
(O/'source-inspection.json').write_text(json.dumps({'meshes':out,'bones':bones,'materials':mats},indent=2))
print(json.dumps(out,indent=2))
print('MAIN_BONES',json.dumps([b for b in bones if b['name'].startswith('DEF-')and not any(s in b['name'] for s in ['finger','lip','brow','lid','tongue','ear','cheek','nose','palm','thumb','f_'])]))
for i in bpy.data.images:
    if i.size[0]>100:
        i.save_render(str(O/(i.name.replace('/','_')+'.png')))
