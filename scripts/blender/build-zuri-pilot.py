"""Reproducible MPFB head study fitted to the preserved Zuri wardrobe/rig.

Run with Blender 5.2.3 and MPFB 2.0.18 enabled. This writes only the separate
pilot outputs; no previous GLB, roster, floor or provider asset is changed.
"""
import bpy, bmesh, json, math, hashlib, sys
from pathlib import Path
from mathutils import Vector
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
import bl_ext.user_default.mpfb as mpfb

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'web/assets/models/characters/reviews'
SOURCE=ROOT/'assets-source/characters'
REPORT=ROOT/'reports/blender-character-pilot'
for p in [OUT,SOURCE,REPORT]: p.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
scene.blendermcp_auto_start_server=False
scene.render.fps=30

def collection(name):
    c=bpy.data.collections.new(name); scene.collection.children.link(c); return c
author=collection('MPFB_Editable_Anatomy_Source')
review=collection('Zuri_Pilot_Export')
studio=collection('Review_Studio')
def move(o,c):
    for prev in list(o.users_collection): prev.objects.unlink(o)
    c.objects.link(o)
def mat(name,color,rough=.5,metal=0):
    m=bpy.data.materials.new(name)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    return m

macro=TargetService.get_default_macro_info_dict()
macro.update(gender=0,age=.3,muscle=.35,weight=.4,proportions=.55)
base=HumanService.create_human(mask_helpers=False,macro_detail_dict=macro)
base.name='Zuri_MPFB_Editable_Base'; move(base,author)
target_root=Path(mpfb.__file__).parent/'data/targets'
targets={'head/head-round':.35,'chin/chin-width-decr':.45,
         'chin/chin-height-decr':.3,'nose/nose-scale-depth-decr':.3,
         'nose/nose-scale-horiz-decr':.25,'nose/nose-scale-vert-decr':.15,
         'mouth/mouth-scale-horiz-decr':.65,'mouth/mouth-angles-up':.4,
         'mouth/mouth-lowerlip-volume-decr':.45,'mouth/mouth-upperlip-volume-decr':.35}
for side in ['l','r']:
    targets[f'eyes/{side}-eye-scale-incr']=.45
    targets[f'eyes/{side}-eye-height2-incr']=.28
for name,value in targets.items():
    TargetService.load_target(base,str(target_root/(name+'.target.gz')),weight=value)
bpy.context.view_layer.update()
dep=bpy.context.evaluated_depsgraph_get()
evaluated=base.evaluated_get(dep)
mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=dep)
def group_points(name):
    index=base.vertex_groups[name].index
    return [mesh.vertices[v.index].co.copy() for v in base.data.vertices if any(g.group==index for g in v.groups)]
def center(name):
    points=group_points(name); return sum(points,Vector())/len(points)
eye_l=center('joint-l-eye'); eye_r=center('joint-r-eye')
eye=(eye_l+eye_r)/2
body_index=base.vertex_groups['body'].index
body_ids={v.index for v in base.data.vertices if any(g.group==body_index for g in v.groups)}
body_points=[mesh.vertices[i].co for i in body_ids]
top=max(v.z for v in body_points)
sx=1.18
sz=(1.652-1.519)/(top-eye.z)
sy=1.04
def fit(v):
    # Fit skull width to the approved bob; enlarge eye spacing locally so the
    # entire jaw/skull does not grow with the stylized eye spacing.
    eye_band=math.exp(-((v.z-eye.z)/.035)**2-((v.y-eye.y)/.05)**2)
    x=v.x*sx+(.012 if v.x>0 else -.012)*eye_band*min(1,abs(v.x)/.015)
    z=(v.z-eye.z)*sz
    if z<0:z*=.76
    return Vector((x,(v.y-eye.y)*sy-.052,z+1.519))
lip_ids={v.index for v in base.data.vertices if any(g.group==base.vertex_groups['lips'].index for g in v.groups)}
skin=mat('MPFB_warm_skin',(.89,.59,.43),.5)
lip=mat('MPFB_soft_lips',(.61,.245,.20),.48)
mesh.materials.clear();mesh.materials.append(skin);mesh.materials.append(lip)
for poly in mesh.polygons: poly.material_index=1 if sum(i in lip_ids for i in poly.vertices)>len(poly.vertices)/2 else 0
for v in mesh.vertices: v.co=fit(v.co)
head=bpy.data.objects.new('Zuri_MPFB_Face',mesh);review.objects.link(head)
bm=bmesh.new();bm.from_mesh(mesh);bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in body_ids],context='VERTS')
# A planar neck boundary extends into the shirt. Vertex deletion alone leaves
# a saw-toothed neckline. The editable source anatomy remains untouched.
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,
                      plane_co=(0,0,1.414),plane_no=(0,0,1),clear_inner=True)
neck_edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-1.414)<.0001 for v in e.verts)]
extruded=bmesh.ops.extrude_edge_only(bm,edges=neck_edges)['geom']
for v in extruded:
    if isinstance(v,bmesh.types.BMVert):v.co.z=1.329;v.co.x*=.88
uv=bm.loops.layers.uv.active
new_faces={f for f in extruded if isinstance(f,bmesh.types.BMFace)}
for face in bm.faces:
    if face not in new_faces:
        for loop in face.loops:loop[uv].uv.x*=.70
for face in extruded:
    if not isinstance(face,bmesh.types.BMFace):continue
    angles=[math.atan2(loop.vert.co.y,loop.vert.co.x)/(2*math.pi)+.5 for loop in face.loops]
    if max(angles)-min(angles)>.5:angles=[a+1 if a<.5 else a for a in angles]
    for loop,a in zip(face.loops,angles):loop[uv].uv=(.78+.18*a,.02+.96*(loop.vert.co.z-1.329)/.085)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(mesh);bm.free();mesh.update()
for p in mesh.polygons:p.use_smooth=True
sub=head.modifiers.new('Editable_face_subdivision','SUBSURF');sub.levels=1;sub.render_levels=1
author.hide_render=True;author.hide_viewport=True

# Reuse only the authored wardrobe, hair, glasses and body rig during the head
# pilot. They stay in this export, with explicit provenance; none is MPFB art.
bpy.ops.import_scene.gltf(filepath=str(ROOT/'web/assets/models/characters/zuri.glb'))
imported=list(bpy.context.selected_objects)
rig=next(o for o in imported if o.type=='ARMATURE')
remove_prefix=('sculpted-face','ear-','ear-fold-','blink-cover','upper-lash','eyelid-rig')
neck_nodes={o.name for o in imported if o.name=='neck-surface' or (o.parent and o.parent.name=='neck-surface')}
for o in imported:
    if o.name.startswith(remove_prefix) or o.name in neck_nodes:bpy.data.objects.remove(o,do_unlink=True)
    else:move(o,review)
rig.animation_data_clear()
for b in rig.pose.bones:
    b.location=(0,0,0);b.rotation_quaternion=(1,0,0,0);b.scale=(1,1,1)
bpy.context.view_layer.update()
for o in review.objects:
    if 'glasses' in o.name:
        world=o.matrix_world.copy();world.translation.y-=.024;o.matrix_world=world
    if o.type=='MESH' and any(t in o.name for t in ['hair','bob','fringe','lock']):
        for m in o.data.materials:
            for n in m.node_tree.nodes:
                if n.type=='BSDF_PRINCIPLED':
                    n.inputs['Roughness'].default_value=.64
                    n.inputs['Coat Weight'].default_value=0
head.parent=rig;head.parent_type='BONE';head.parent_bone='head'
head.matrix_parent_inverse=(rig.matrix_world@rig.pose.bones['head'].matrix).inverted()
# Blender bone parenting includes its tail translation. Keep the authored
# world coordinates explicitly, then export the evaluated transform once.
bpy.context.view_layer.update();head.matrix_world.identity()

white=mat('Eye_ivory',(.95,.93,.87),.25)
iris=mat('Eye_warm_brown',(.12,.044,.014),.28)
pupil=mat('Eye_pupil',(.008,.005,.003),.2)
def sphere(name,pos,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=pos)
    o=bpy.context.object;o.name=name;move(o,review);o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    o.data.materials.append(material)
    world=o.matrix_world.copy();o.parent=rig;o.parent_type='BONE';o.parent_bone='head';o.matrix_world=world
    return o
for side in [-1,1]:
    # Eye centres are fitted from the MPFB eye joint helpers, not guessed in
    # screen pixels. Their front surfaces sit inside the anatomical eyelids.
    pos=fit(eye_l if eye_l.x*side>0 else eye_r)
    sphere(f'Eye_{side}',pos,(.022,.022,.021),white)
    sphere(f'Iris_{side}',pos+Vector((0,-.021,0)),(.012,.0025,.012),iris)
    sphere(f'Pupil_{side}',pos+Vector((0,-.0232,0)),(.005,.0007,.0055),pupil)

# Sculpt-aligned brow curves, separate editable strands rather than face paint.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
face_tree=BVHTree.FromObject(head,bpy.context.evaluated_depsgraph_get())
brow_mat=mat('Brow_chestnut',(.10,.042,.018),.7)
for side in [-1,1]:
    curve=bpy.data.curves.new(f'Brow_{side}','CURVE');curve.dimensions='3D';curve.resolution_u=12
    curve.bevel_depth=.0016;curve.bevel_resolution=3
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(8)
    for i,bp in enumerate(spline.bezier_points):
        t=i/8;x=side*(.021+t*.044);z=1.548+.007*math.sin(t*math.pi)
        hit=face_tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))[0]
        bp.co=(x,(hit.y if hit else -.08)-.002,z);bp.radius=.25+.75*math.sin(math.pi*t)**.4
        bp.handle_left_type=bp.handle_right_type='AUTO'
    o=bpy.data.objects.new(f'Brow_{side}',curve);review.objects.link(o);curve.materials.append(brow_mat)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object
    for p in o.data.polygons:p.use_smooth=True
    o.parent=rig;o.parent_type='BONE';o.parent_bone='head';bpy.context.view_layer.update();o.matrix_world.identity()

# A neutral studio, excluded from GLB selection.
def point_at(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy,size in [('Key',(-2,-3,4),230,3),('Fill',(3,-2,2),130,3),('Rim',(0,2,3),180,2)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=loc;point_at(o,(0,0,1.35))
camera_data=bpy.data.cameras.new('ReviewCamera');camera=bpy.data.objects.new('ReviewCamera',camera_data);studio.objects.link(camera)
scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=.56;camera.location=(0,-2,1.52);point_at(camera,(0,0,1.52))
scene.world.color=(.3,.3,.3)
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'

# Static head-fitting review: do not advertise inherited unverified animations.
# Retained armature is editable in .blend; the current pilot exports no clips.
for o in review.objects:
    if o.animation_data:o.animation_data_clear()
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'zuri-blender-pilot.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in review.objects:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'zuri-blender-pilot.glb'),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=True)
payload=(OUT/'zuri-blender-pilot.glb').read_bytes()
j=json.loads(payload[20:20+int.from_bytes(payload[12:16],'little')])
triangles=sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives'])
meta={'id':'zuri-blender-pilot','stage':'static-head-fitting-review','bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'triangles':triangles,'meshes':len(j['meshes']),'clips':[],
      'blender':bpy.app.version_string,'mpfb':'.'.join(map(str,mpfb.VERSION)),'source':'assets-source/characters/zuri-blender-pilot.blend','targets':targets,
      'reused':'Existing Zuri local hair, glasses, wardrobe and body rig; previous face removed; no provider geometry',
      'landmarks':{'sourceEye':list(eye),'sourceTop':top,'scale':[sx,sy,sz]},'artApproved':False,'floorAdoption':False}
(OUT/'zuri-blender-pilot.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8')
assert triangles<150000 and len(payload)<15*1024*1024
scene.render.filepath=str(REPORT/'face-front.png');bpy.ops.render.render(write_still=True)
print('PILOT',json.dumps(meta))
