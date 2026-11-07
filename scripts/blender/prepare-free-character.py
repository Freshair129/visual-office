"""Official source -> isolated, material-preserving Lab derivative. No autoexec.

Usage: blender -b --factory-startup --disable-autoexec -P this.py -- anime|rain
The source archives remain in Downloads; only the derivative is admitted to web.
"""
import bpy, json, sys, math, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
kind=sys.argv[sys.argv.index('--')+1]
assert kind in ('anime','rain')
SOURCE=Path.home()/'Downloads/visual-office-character-candidates'
OUT=ROOT/'web/assets/models/characters/candidates';OUT.mkdir(parents=True,exist_ok=True)
REPORT=ROOT/'reports/free-character-candidates'/kind;REPORT.mkdir(parents=True,exist_ok=True)
EXPORT=ROOT/'assets-source/characters/candidates';EXPORT.mkdir(parents=True,exist_ok=True)

if kind=='anime':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE/'anime-girl/source-gltf'))
    widgets={b.custom_shape for o in bpy.context.scene.objects if o.type=='ARMATURE' for b in o.pose.bones if b.custom_shape}
    obs=[o for o in bpy.context.scene.objects if o.type in ('MESH','ARMATURE','EMPTY') and o not in widgets]
    # The official web derivative already contains PBR materials and a skin.
    # Re-export without Draco/WebP so the existing offline Lab needs no decoder.
    for i in bpy.data.images:
        if i.size[0]>2048:i.scale(2048,2048)
    source_path=SOURCE/'anime-girl/source-gltf'
else:
    source_path=SOURCE/'rain-v3/source/Rain v3.3/rain_v3.2.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source_path),use_scripts=False)
    tex=source_path.parent/'textures'
    for i in bpy.data.images:
        # Resolve source textures explicitly; forward slashes are needed for
        # Cycles' UDIM substitution on this Windows source.
        if not i.packed_files and i.source in ('FILE','TILED') and i.filepath:
            # Blender's // relative prefix is not a Windows UNC share.
            p=tex/i.filepath.replace('\\','/').rsplit('/',1)[-1]
            if p.is_file() or (i.source=='TILED' and list(tex.glob(p.name.replace('<UDIM>','*')))):
                i.filepath=p.as_posix();i.reload()
    # Flatten the supplied three UDIM tiles into a conventional texture atlas.
    # Cycles 5.2 on this host attempts to open the <UDIM> token literally during
    # baking. Sampling the original tiles explicitly prevents silent fallback.
    import numpy as np
    for tiled in list(bpy.data.images):
        if tiled.source!='TILED':continue
        size=2048;numbers=sorted(t.number for t in tiled.tiles)
        assert numbers==[1001,1002,1003]
        pixels=np.zeros((size,size*3,4),dtype=np.float32)
        for col,num in enumerate(numbers):
            path=Path(tiled.filepath.replace('<UDIM>',str(num)))
            assert path.is_file(),path
            tile=bpy.data.images.load(str(path),check_existing=False);tile.scale(size,size)
            buf=np.empty(size*size*4,dtype=np.float32);tile.pixels.foreach_get(buf)
            pixels[:,col*size:(col+1)*size,:]=buf.reshape(size,size,4)
        atlas=bpy.data.images.new(tiled.name+'-atlas',width=size*3,height=size)
        atlas.colorspace_settings.name=tiled.colorspace_settings.name
        atlas.pixels.foreach_set(pixels.ravel());atlas.pack()
        for mat in bpy.data.materials:
            if not mat.node_tree:continue
            nt=mat.node_tree
            for n in list(nt.nodes):
                if n.type!='TEX_IMAGE' or n.image!=tiled:continue
                n.image=atlas;uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map='SourceUV'
                mapping=nt.nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1/3,1,1)
                nt.links.new(uv.outputs['UV'],mapping.inputs[0]);nt.links.new(mapping.outputs[0],n.inputs['Vector'])
    # Keep only rendered character geometry; no rig widgets or duplicate
    # viewport eyes/body. This is an evaluated appearance snapshot, not a rig.
    excluded={'GEO-rain-body_nomask','GEO-rain-eyes_viewport','GEO-rain-eye_dots','GEO-rain-eye_cornea'}
    sources=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('GEO-') and o.name not in excluded]
    for o in sources:
        for m in o.modifiers:
            if m.type=='SUBSURF':
                # The source's quality driver otherwise resets this to zero.
                for prop in ('levels','render_levels','show_viewport'):
                    m.driver_remove(prop)
                m.levels=1 if any(s in o.name for s in ('head','hair')) else 0
                m.render_levels=m.levels;m.show_viewport=True
    bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
    obs=[]
    for o in sources:
        me=bpy.data.meshes.new_from_object(o.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
        n=bpy.data.objects.new(o.name+'-lab',me);bpy.context.collection.objects.link(n);n.matrix_world=o.matrix_world.copy();obs.append(n)
    keep={o.name for o in obs}
    for o in list(bpy.data.objects):
        if o.name not in keep:bpy.data.objects.remove(o,do_unlink=True)
    # Bake original shader Base Color networks, including painted skin and
    # procedural iris, instead of silently losing them in glTF conversion.
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='CUDA';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='CUDA'
        scene.cycles.device='GPU'
    except Exception:scene.cycles.device='CPU'
    scene.render.bake.margin=12
    for o in obs:
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        olduv=o.data.uv_layers.active
        # New bake UV, preserving the original coordinates for source textures.
        if olduv:
            olduv.name='SourceUV'
            for m in o.data.materials:
                if not m or not m.node_tree:continue
                for n in m.node_tree.nodes:
                    if n.type=='TEX_IMAGE' and not n.inputs['Vector'].is_linked:
                        uv=m.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='SourceUV';m.node_tree.links.new(uv.outputs['UV'],n.inputs['Vector'])
        uv=o.data.uv_layers.new(name='LabUV');o.data.uv_layers.active=uv
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
        image=bpy.data.images.new(o.name+'-albedo',width=2048 if 'head' in o.name else 1024,height=2048 if 'head' in o.name else 1024)
        rough=[]
        for slot in o.material_slots:
            if not slot.material:continue
            m=slot.material.copy();slot.material=m;nt=m.node_tree
            p=next((n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'),None)
            output=next((n for n in nt.nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output),None)
            if not output:output=nt.nodes.new('ShaderNodeOutputMaterial')
            e=nt.nodes.new('ShaderNodeEmission')
            if p:
                color=p.inputs['Base Color'];rough.append(p.inputs['Roughness'].default_value)
                if color.is_linked:nt.links.new(color.links[0].from_socket,e.inputs['Color'])
                else:e.inputs['Color'].default_value=color.default_value
            nt.links.new(e.outputs[0],output.inputs['Surface'])
            node=nt.nodes.new('ShaderNodeTexImage');node.image=image;nt.nodes.active=node
        bpy.ops.object.bake(type='EMIT')
        image.pack()
        mat=bpy.data.materials.new(o.name+'-PBR');mat.use_nodes=True;nt=mat.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
        p.inputs['Roughness'].default_value=.3 if 'eyes' in o.name else .55
        imageNode=nt.nodes.new('ShaderNodeTexImage');imageNode.image=image;nt.links.new(imageNode.outputs['Color'],p.inputs['Base Color'])
        o.data.materials.clear();o.data.materials.append(mat)
        for poly in o.data.polygons:poly.material_index=0;poly.use_smooth=True
        o.data.uv_layers.remove(o.data.uv_layers['SourceUV'])
        print('BAKED',o.name,flush=True)

bpy.context.view_layer.update()
meshes=[o for o in obs if o.type=='MESH']
points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
# Single presentation root keeps skin and geometry aligned, unit-normalized.
root=bpy.data.objects.new('LabCandidate',None);bpy.context.collection.objects.link(root)
for o in obs:
    if o.parent is None:o.parent=root
scale=1.65/(hi.z-lo.z);root.scale=(scale,)*3;root.location=(-((lo.x+hi.x)/2)*scale,-((lo.y+hi.y)/2)*scale,-lo.z*scale)
bpy.context.view_layer.update()
head=next((o for o in meshes if o.name.startswith('GEO-rain-head') or o.name.startswith('Retopo-Girl')),None)
headpts=[head.matrix_world@v.co for v in head.data.vertices] if head else []
if kind=='anime':headpts=[v for v in headpts if v.z>1.65*.83]
if headpts:
    hl=Vector(tuple(min(p[i] for p in headpts) for i in range(3)));hh=Vector(tuple(max(p[i] for p in headpts) for i in range(3)));hc=(hl+hh)/2
    facepoint=[hc.x,hc.z,-hc.y];facedistance=max(hh.z-hl.z,hh.x-hl.x)*2.7
else:facepoint=[0,1.50,0];facedistance=.8
for o in meshes:
    for m in o.data.materials:
        if m:m.use_backface_culling=False
# Saving preserves an editable, packed derivative without executing source UI.
for t in bpy.data.texts:t.use_module=False
if kind=='anime':bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(EXPORT/(kind+'-lab.blend')))
bpy.ops.object.select_all(action='DESELECT')
for o in obs+[root]:o.select_set(True)
path=OUT/(kind+'.glb')
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_image_format='AUTO',export_draco_mesh_compression_enable=False,export_extras=False)
data=path.read_bytes();import struct
doc=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
credit='Rigged Anime Girl — 3dquads blender (CC0-1.0)' if kind=='anime' else 'Rain Rig (CC) Blender Foundation | studio.blender.org (CC-BY-4.0)'
doc['asset']['copyright']=credit
doc['asset']['extras']={'license':'https://creativecommons.org/publicdomain/zero/1.0/' if kind=='anime' else 'https://creativecommons.org/licenses/by/4.0/','modifiedFor':'Visual Office Character Lab comparison only','floorAdoption':False}
original_json_size=struct.unpack_from('<I',data,12)[0]
json_bytes=json.dumps(doc,separators=(',',':'),ensure_ascii=True).encode();json_bytes+=b' '*((-len(json_bytes))%4)
tail=data[20+original_json_size:]
data=struct.pack('<III',0x46546c67,2,20+len(json_bytes)+len(tail))+struct.pack('<II',len(json_bytes),0x4e4f534a)+json_bytes+tail
path.write_bytes(data)
tris=sum(doc['accessors'][p['indices']]['count']//3 for m in doc.get('meshes',[]) for p in m['primitives'] if 'indices'in p)
meta={'id':kind,'name':'Rigged Anime Girl' if kind=='anime' else 'Rain','author':'3dquads blender' if kind=='anime' else 'Blender Studio / Blender Foundation','license':'CC0-1.0' if kind=='anime' else 'CC-BY-4.0','source':'https://www.blendkit.com/asset-gallery-detail/1d63f553-863b-41d4-b3bd-d92222700fee/' if kind=='anime' else 'https://studio.blender.org/characters/rain/v3/','attribution':'Rigged Anime Girl — 3dquads blender (CC0)' if kind=='anime' else 'Rain Rig (CC) Blender Foundation | studio.blender.org','sha256':hashlib.sha256(data).hexdigest(),'sourceSha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'bytes':len(data),'triangles':tris,'meshes':len(doc.get('meshes',[])),'materials':len(doc.get('materials',[])),'skins':len(doc.get('skins',[])),'animations':len(doc.get('animations',[])),'height':1.65,'artApproved':False,'floorAdoption':False,'changes':'Decoded official glTF compression; texture resolution capped at 2K; normalized display height. Skin retained; no authored motion clips.' if kind=='anime' else 'Evaluated static geometry with one subdivision level; original Base Color shaders baked into textures; simplified roughness and omitted auxiliary cornea/dot shells; normalized display height. Original rig preserved in downloaded source, not this GLB.','limitations':['No walk or sit clips supplied by these source files.','Lab comparison only; no Zuri brand adaptation or floor adoption.']}
meta.update(facePoint=facepoint,faceDistance=facedistance)
(OUT/(kind+'.json')).write_text(json.dumps(meta,indent=2),encoding='utf8')
print('EXPORTED',json.dumps(meta),flush=True)
