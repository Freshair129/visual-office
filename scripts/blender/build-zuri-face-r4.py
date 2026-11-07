"""Correct the rejected face on a separate revision; retain UVs, rig and baseline.
Run with Blender --background --factory-startup --disable-autoexec --python-exit-code 1.
"""
import bpy,bmesh,math,json,hashlib,struct
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

R=Path(__file__).resolve().parents[2]
REPORT=R/'reports/zuri-face-r4';REPORT.mkdir(parents=True,exist_ok=True)
BASE=R/'assets-source/characters/candidates/anime-lab.blend'
CURRENT=R/'assets-source/characters/candidates/zuri-anime.blend'
OUT=R/'web/assets/models/characters/candidates/zuri-face-r4.glb'
EDIT=R/'assets-source/characters/candidates/zuri-face-r4.blend'
baseline=R/'web/assets/models/characters/candidates/zuri-anime.glb'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={str(p.relative_to(R)):sha(p)for p in [BASE,CURRENT,baseline]}

def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def gauss(x,c,w):return math.exp(-((x-c)/w)**2)

def old_face(p):
 x,y,z=p;q=Vector(p)
 if z<1.37:return q
 front=1-smooth(-.07,.01,y)
 mouth=gauss(z,1.430,.025)*gauss(x,0,.055)*front
 nose=gauss(z,1.466,.023)*gauss(x,0,.024)*front
 q.x*=1-.53*mouth-.17*nose;q.y+=.008*nose+.0025*mouth
 q.z+=(1.431-z)*.73*gauss(z,1.431,.019)*gauss(x,0,.034)*front
 q.z-=.003*gauss(abs(x),.025,.013)*gauss(z,1.432,.017)*front
 q.y-=.004*gauss(abs(x),.054,.024)*gauss(z,1.449,.023)*front
 q.z+=.003*gauss(x,0,.023)*gauss(z,1.458,.020)*front
 q.z+=.018*gauss(z,1.397,.033)*front
 q.x*=1+.065*gauss(z,1.455,.035)*front
 q.x*=1+.075*gauss(z,1.407,.020)*front
 eye=gauss(abs(x),.045,.035)*gauss(z,1.498,.030)*front
 q.z+=(1.498-z)*.035*eye
 return q

def corrected_face(p):
 x,y,z=p;old=old_face(p);q=Vector(p)
 front=1-smooth(-.07,.01,y)
 # Broad, gentle perioral shaping replaces the old 53% horizontal pinch and
 # 73% vertical collapse, which manufactured a duck-like cheek/mouth crease.
 mouth=gauss(z,1.432,.037)*gauss(x,0,.067)*front
 nose=gauss(z,1.466,.023)*gauss(x,0,.020)*front
 q.x*=1-.30*mouth-.055*nose
 q.y+=.004*nose+.002*gauss(z,1.431,.019)*gauss(x,0,.043)*front
 q.z+=(1.431-z)*.18*gauss(z,1.431,.027)*gauss(x,0,.062)*front
 # Round the lower-face silhouette without pushing artificial cheek cushions.
 q.x*=1+.11*gauss(z,1.406,.026)*front
 q.z+=.011*gauss(z,1.390,.025)*front
 # Preserve the existing eye aperture and lid registration exactly.
 blend=1-smooth(1.473,1.493,z)
 return old.lerp(q,blend)

# Recover the original control points by their exact *old* deformation. No
# guessing vertex indices after the prior neck crop/weld operations.
bpy.ops.wm.open_mainfile(filepath=str(BASE),use_scripts=False)
source=bpy.data.objects['Retopo-Girl'];points=[source.matrix_world@v.co for v in source.data.vertices]
kd=KDTree(len(points))
for i,p in enumerate(points):kd.insert(old_face(p),i)
kd.balance()
bpy.ops.wm.open_mainfile(filepath=str(CURRENT),use_scripts=False)
body=bpy.data.objects['Retopo-Girl'];changed=0;distances=[]
for v in body.data.vertices:
 if v.co.z<1.37:continue
 _,i,d=kd.find(v.co);distances.append(d)
 if d>.00004:raise RuntimeError('Control-point correspondence mismatch: '+str(d))
 v.co=corrected_face(points[i]);changed+=1
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()

# Owner correction: a real three-dimensional bridge/philtrum/lip/chin profile,
# not a flattened anime envelope. Measure the evaluated centerline first, then
# move the surrounding tissue with a shared smooth displacement field. Offsets
# preserve inner/outer lip spacing instead of collapsing surfaces onto a plane.
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
prior_pose=rig.data.pose_position;rig.data.pose_position='REST';bpy.context.view_layer.update()
ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
sample=[ev.matrix_world@v.co for v in mesh.vertices];ev.to_mesh_clear()
levels=[1.380+i*.0025 for i in range(55)]
observed=[]
for z in levels:
 candidates=[p.y for p in sample if abs(p.x)<.008 and abs(p.z-z)<.003 and p.y<0]
 if not candidates:raise RuntimeError('Missing measured facial centerline at '+str(z))
 observed.append(min(candidates))
# Asset-specific design targets in metres, not a universal anatomy standard.
targets=[(1.380,-.069),(1.395,-.086),(1.405,-.092),(1.415,-.094),(1.425,-.105),(1.435,-.108),(1.445,-.104),(1.452,-.107),(1.462,-.120),(1.470,-.118),(1.480,-.107),(1.490,-.100),(1.500,-.094),(1.515,-.094)]
def interp(rows,z):
 if z<=rows[0][0]:return rows[0][1]
 if z>=rows[-1][0]:return rows[-1][1]
 i=next(i for i in range(len(rows)-1)if rows[i][0]<=z<=rows[i+1][0]);a,b=rows[i],rows[i+1]
 left=rows[max(0,i-1)];right=rows[min(len(rows)-1,i+2)];h=b[0]-a[0];t=(z-a[0])/h
 m0=(b[1]-left[1])/(b[0]-left[0]);m1=(right[1]-a[1])/(right[0]-a[0])
 return (2*t**3-3*t*t+1)*a[1]+(t**3-2*t*t+t)*h*m0+(-2*t**3+3*t*t)*b[1]+(t**3-t*t)*h*m1
measured=list(zip(levels,observed));widths=[(1.380,.050),(1.415,.045),(1.435,.036),(1.452,.026),(1.465,.017),(1.485,.013),(1.515,.012)]
for v in body.data.vertices:
 x,y,z=v.co
 if not 1.375<z<1.515 or y>-.02:continue
 width=interp(widths,z)
 weight=math.exp(-((x/width)**4))*(1-smooth(-.075,-.02,y))*smooth(1.375,1.395,z)*(1-smooth(1.499,1.515,z))
 v.co.y+=(interp(targets,z)-interp(measured,z))*weight
rig.data.pose_position=prior_pose;body.data.update();bpy.context.view_layer.update()
(REPORT/'profile-design.json').write_text(json.dumps({'before':measured,'targets':targets,'policy':'Natural 3D bridge and philtrum; lips forward of chin and behind nose tip. Shared tissue offsets preserve lip depth.'},indent=2))

# The old crown literally shifted its apex 25 mm sideways. Undo that field on
# the same closed hair shell, then broaden the upper cap toward an oval dome.
profile=[(1.35,.105,.086),(1.375,.119,.103),(1.41,.127,.114),(1.46,.127,.125),(1.51,.119,.131),(1.56,.110,.124),(1.61,.084,.098),(1.64,.050,.061),(1.656,.001,.001)]
def radius(z,col):
 i=max(0,min(len(profile)-2,next((j-1 for j,p in enumerate(profile)if p[0]>=z),len(profile)-2)))
 a,b=profile[i],profile[i+1];h=b[0]-a[0];t=max(0,min(1,(z-a[0])/h));left=profile[max(0,i-1)];right=profile[min(len(profile)-1,i+2)]
 m0=(b[col]-left[col])/(b[0]-left[0]);m1=(right[col]-a[col])/(right[0]-a[0])
 return max(.001,(2*t**3-3*t*t+1)*a[col]+(t**3-2*t*t+t)*h*m0+(-2*t**3+3*t*t)*b[col]+(t**3-t*t)*h*m1)
hair=bpy.data.objects['Zuri_Bob_Unified']
for v in hair.data.vertices:
 x,y,z=v.co
 if z<1.56:continue
 x-=.025*smooth(1.56,1.656,z)
 cap=math.sqrt(max(0,1-((z-1.55)/.106)**2))
 blend=smooth(1.57,1.61,z)
 sx=1+blend*(max(.9,min(1.20,.110*cap/radius(z,1)))-1)
 sy=1+blend*(max(.9,min(1.16,.124*cap/radius(z,2)))-1)
 v.co.x=x*sx;v.co.y=.008+(y-.008)*sy
hair.data.update();body.data.update();bpy.context.view_layer.update()
metrics={'recoveredHeadVertices':changed,'maxCorrespondenceError':max(distances),'baselineHashes':before,'source':str(CURRENT.relative_to(R)),'changes':['Removed asymmetric crown shift and broadened the cap.','Removed the pinched mouth and artificial cheek bulges without flattening facial volume.','Measured natural 3D bridge, nose tip, philtrum, lips and chin relationship; preserved UVs, skeleton and clips.']}
(REPORT/'authoring.json').write_text(json.dumps(metrics,indent=2))
for text in bpy.data.texts:text.use_module=False
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(EDIT))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type in ['MESH','ARMATURE']:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True,export_def_bones=True,export_image_format='AUTO',export_extras=False)
data=OUT.read_bytes();size=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+size]);tail=data[20+size:]
g['asset']['copyright']='Base: Rigged Anime Girl by 3dquads blender (CC0-1.0). Zuri face correction revision 4 for Visual Office.'
g['asset']['extras']={'license':'https://creativecommons.org/publicdomain/zero/1.0/','artApproved':False,'floorAdoption':False,'revision':4}
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
OUT.write_bytes(struct.pack('<III',0x46546c67,2,20+len(j)+len(tail))+struct.pack('<II',len(j),0x4e4f534a)+j+tail)
meta=json.loads((baseline.with_suffix('.json')).read_text());meta.update(id='zuri-face-r4',name='Zuri · Face correction 4',sha256=sha(OUT),bytes=OUT.stat().st_size,revision=4,sourceSha256=sha(CURRENT),baselineSha256=sha(baseline),editableSource=EDIT.relative_to(R).as_posix())
meta['triangles']=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes']for p in m['primitives']);meta['meshes']=len(g['meshes']);meta['materials']=len(g['materials']);meta['animations']=len(g.get('animations',[]));meta['clipNames']=[a['name']for a in g.get('animations',[])]
meta['changes']=metrics['changes'];meta['limitations']=['Separate Lab review candidate; art acceptance pending.','Existing base UV/contact cleanup and mobile optimization remain open.']
OUT.with_suffix('.json').write_text(json.dumps(meta,indent=2))
assert all(sha(R/path)==value for path,value in before.items()),'Baseline was modified'
print('FACE_R4',json.dumps(meta),flush=True)
