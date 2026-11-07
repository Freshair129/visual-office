"""Read-only source inspection; run with --disable-autoexec."""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector

out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
def obj(o):
    r={'name':o.name,'type':o.type,'hidden':o.hide_get(),'hide_render':o.hide_render,'parent':o.parent.name if o.parent else None}
    if o.type=='MESH':
        r.update(vertices=len(o.data.vertices),polygons=len(o.data.polygons),materials=[m.name for m in o.data.materials if m],modifiers=[{'type':m.type,'name':m.name,'show_viewport':m.show_viewport,'levels':getattr(m,'levels',None)} for m in o.modifiers],bounds=[list(o.matrix_world@Vector(p)) for p in o.bound_box],shapeKeys=[k.name for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else [])
    if o.type=='ARMATURE':r['bones']=[{'name':b.name,'deform':b.use_deform} for b in o.data.bones]
    return r
report={'source':bpy.data.filepath,'version':bpy.app.version_string,'objects':[obj(o) for o in bpy.data.objects],'actions':[a.name for a in bpy.data.actions],'texts':[t.name for t in bpy.data.texts],'materials':[{'name':m.name,'nodes':[{'type':n.type,'name':n.name,'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None} for n in m.node_tree.nodes] if m.node_tree else []} for m in bpy.data.materials],'images':[{'name':i.name,'path':i.filepath,'size':list(i.size),'source':i.source} for i in bpy.data.images]}
(out/'inspection.json').write_text(json.dumps(report,indent=2))
for t in bpy.data.texts:
    (out/(Path(t.name).name+'.txt')).write_text(t.as_string(),encoding='utf8')
print('INSPECTED',len(report['objects']),'objects',len(report['actions']),'actions',report['texts'])
