"""Original Zuri head surfaces, separate from the rejected MPFB fitting pilot.

This builds an editable head study, not a production facial rig. Metres, front -Y.
Run in a disposable background Blender process; prior GLBs/blends are never saved.
"""
import bpy, bmesh, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi, exp, sqrt

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'web/assets/models/characters/reviews'
REPORT=ROOT/'reports/zuri-head-correction'
SOURCE=ROOT/'assets-source/characters'
for p in [OUT,REPORT,SOURCE]:p.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
if hasattr(scene,'blendermcp_auto_start_server'):scene.blendermcp_auto_start_server=False
def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
head_parts=collection('Zuri_Head_Revision');body_parts=collection('Unchanged_Wardrobe_Reference');studio=collection('Review_Studio')
def move(o,c):
    for prev in list(o.users_collection):prev.objects.unlink(o)
    c.objects.link(o);return o
def srgb(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h):return tuple(srgb(int(h[i:i+2],16)/255) for i in (0,2,4))
def material(name,color,rough=.5,metal=0,colors=False):
    m=bpy.data.materials.new(name);p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*rgb(color),1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if colors:
        n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Color';m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
    return m
skin=material('Warm_peach_skin','F6CCB0',.62,colors=True)
plain_skin=material('Warm_peach_neck','F6CCB0',.62)
lid_skin=material('Soft_lid_rose','DAA38A',.65)
lash=material('Warm_lash','39251F',.7)
lip=material('Muted_lip','CA8174',.64)
mouth_line=material('Small_smile','8C5149',.7)
eye_mat=material('Layered_brown_eyes','FFFFFF',.52,colors=True)
hair_mat=material('Chestnut_locks','674332',.62,colors=True)
hair_shadow=material('Chestnut_under_bob','38241F',.64)
bronze=material('Fine_bronze_frames','867469',.32,.72)
amber=material('Zuri_amber_clip','E8820C',.34,.05)
white=material('Eye_catchlight','FFF8ED',.22)
for m,strength in [(eye_mat,.08),(hair_mat,.22),(hair_shadow,.18),(plain_skin,.24),(skin,.24)]:
    next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Specular IOR Level'].default_value=strength
hair_image=bpy.data.images.load(str(SOURCE/'zuri-hair-strands-albedo.png'));hair_image.pack()
iris_image=bpy.data.images.load(str(ROOT/'docs/game-design/characters/2026-10-25-brand-study/local-rebuild/zuri-face-albedo-v1.png'));iris_image.pack()
ep=next(n for n in eye_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');et=eye_mat.node_tree.nodes.new('ShaderNodeTexImage');et.image=iris_image;eye_mat.node_tree.links.new(et.outputs['Color'],ep.inputs['Base Color'])
for m in [hair_mat,hair_shadow]:
    nodes=m.node_tree.nodes;p=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    tex=nodes.new('ShaderNodeTexImage');tex.image=hair_image;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])

def mesh(name,verts,faces,mat,uvs=None,colors=None,c=head_parts):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);c.objects.link(o);me.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    for p in me.polygons:p.use_smooth=True
    if uvs:
        uv=me.uv_layers.new(name='UVMap')
        for p in me.polygons:
            for li in p.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
    if colors:
        attr=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        for a,col in zip(attr.data,colors):a.color=(*col,1)
    return o

def surface(name,fn,nu,nv,mat,colorfn=None):
    vs=[];uv=[];cs=[];fs=[]
    for j in range(nv+1):
        for i in range(nu+1):
            u=i/nu;v=j/nv;p=fn(u,v);vs.append(p);uv.append((u,v))
            if colorfn:cs.append(colorfn(u,v,p))
    for j in range(nv):
        for i in range(nu):
            a=j*(nu+1)+i;fs.append((a,a+1,a+nu+2,a+nu+1))
    return mesh(name,vs,fs,mat,uv,cs or None)

def curve(name,points,radius,mat,radii=None):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=2;cu.bevel_depth=radius;cu.bevel_resolution=2;cu.use_fill_caps=True
    sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for i,(bp,p) in enumerate(zip(sp.bezier_points,points)):
        bp.co=p;bp.handle_left_type=bp.handle_right_type='AUTO';bp.radius=radii[i] if radii else 1
    o=bpy.data.objects.new(name,cu);head_parts.objects.link(o);cu.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def sphere(name,pos,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=pos)
    o=move(bpy.context.object,head_parts);o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def mix(a,b,t):return a*(1-t)+b*t
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def gauss(x,z,cx,cz,sx,sz):return exp(-((x-cx)/sx)**2-((z-cz)/sz)**2)
# Deliberate profile sections. Width, frontal depth and back depth are independent.
sections=[(1.377,.002,-.013,.016),(1.386,.026,-.046,.039),(1.403,.050,-.064,.055),
 (1.428,.070,-.076,.072),(1.457,.085,-.082,.085),(1.488,.090,-.079,.092),
 (1.519,.092,-.074,.096),(1.548,.088,-.070,.093),(1.578,.078,-.060,.084),
 (1.605,.058,-.036,.063),(1.626,.026,-.008,.030),(1.632,.001,.010,.012)]
def section(z):
    for k in range(len(sections)-1):
        a,b=sections[k:k+2]
        if z<=b[0]:
            t=max(0,min(1,(z-a[0])/(b[0]-a[0])))
            # Hermite interpolation keeps profile tangents continuous.
            out=[]
            for q in (1,2,3):
                prev=sections[max(0,k-1)];nxt=sections[min(len(sections)-1,k+2)]
                m0=(b[q]-prev[q])/(b[0]-prev[0]);m1=(nxt[q]-a[q])/(nxt[0]-a[0]);d=b[0]-a[0]
                out.append((2*t**3-3*t*t+1)*a[q]+(t**3-2*t*t+t)*m0*d+(-2*t**3+3*t*t)*b[q]+(t**3-t*t)*m1*d)
            return out
    return sections[-1][1:]
def relief(x,z):
    return (.004*gauss(x,z,0,1.484,.010,.029)+.007*gauss(x,z,0,1.465,.010,.011)
      +.001*gauss(x,z,0,1.458,.017,.007)+.004*gauss(abs(x),z,.053,1.456,.026,.020)
      -.003*gauss(abs(x),z,.044,1.502,.027,.019)+.0015*gauss(x,z,0,1.428,.023,.008))
def face_y(x,z):
    w,f,b=section(z);return (f+b)/2-(b-f)/2*sqrt(max(0,1-(x/max(.001,w))**2))-relief(x,z)
def headpoint(u,v):
    z=mix(sections[0][0],sections[-1][0],v);w,f,b=section(z);a=u*2*pi;x=sin(a)*w
    return (x,(f+b)/2-cos(a)*(b-f)/2-max(0,cos(a))**6*relief(x,z),z)
def skincolor(u,v,p):
    x,y,z=p;blush=.35*gauss(abs(x),z,.060,1.466,.024,.015)*smooth((-y-.02)/.03)
    return tuple(mix(a,b,blush) for a,b in zip(rgb('F7D2B9'),rgb('E89087')))
head=surface('Zuri_Refined_Head',headpoint,80,64,skin,skincolor)
# Weld the periodic seam and cap the two small poles before cutting eye apertures.
bm=bmesh.new();bm.from_mesh(head.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(head.data);bm.free()

EX=.043;EZ=1.501;EW=.027
def eye_outline(a,side,scale=1):
    t=cos(a);h=(.020 if sin(a)>=0 else .0145)*sin(a)
    return side*EX+t*EW*scale,EZ+h*scale+side*t*.0025
def eye_depth(x,z,side):
    # Eye surfaces are inset at the edge and only 1 mm proud at the centre.
    r=((x-side*EX)/EW)**2+((z-EZ)/.017)**2
    return face_y(x,z)-.001+max(0,r)*.001
for side in [-1,1]:
    vs=[];fs=[];n=72
    for y in [-.30,.02]:
        for i in range(n):
            x,z=eye_outline(i*2*pi/n,side);vs.append((x,y,z))
    for i in range(n):fs.append((i,(i+1)%n,(i+1)%n+n,i+n))
    fs += [tuple(reversed(range(n))),tuple(range(n,n*2))]
    cutter=mesh('Eye_aperture_cutter',vs,fs,plain_skin)
    mod=head.modifiers.new('Almond_eye_aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.context.view_layer.objects.active=head;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    def ep(u,v):
        a=u*2*pi;x,z=eye_outline(a,side);x=mix(side*EX,x,v);z=mix(EZ,z,v)
        return (x,eye_depth(x,z,side)+.0002,z)
    def ec(u,v,p):
        x,y,z=p;dx=x-side*EX;dz=z-(EZ+.0003);r=sqrt((dx/.0129)**2+(dz/.0165)**2);a=math.atan2(dz,dx)
        if r>1:return rgb('FFF2E7')
        if r<.40:return rgb('1B0F0B')
        ring=smooth((r-.43)/.25)*(1-.90*smooth((r-.83)/.17))
        rays=.88+.12*sin(a*47+sin(a*11)*2+r*18)
        shade=mix(.65,1.05,smooth((EZ+.010-z)/.023))
        return tuple(mix(c,d,ring)*rays*shade for c,d in zip(rgb('352016'),rgb('A76A34')))
    eye=surface(f'Eye_inset_{side}',ep,64,24,eye_mat)
    for loop in eye.data.loops:
        p=eye.data.vertices[loop.vertex_index].co
        eye.data.uv_layers.active.data[loop.index].uv=((.291 if side<0 else .711)+(p.x-side*EX)/.054*.25,1-(.455-(p.z-EZ)/.035*.15))
    # Weld polar ring and periodic seam; cap back for robust exported geometry.
    bm=bmesh.new();bm.from_mesh(eye.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0000001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00000001)
    bm.to_mesh(eye.data);bm.free()
    solid=eye.modifiers.new('Eye_back','SOLIDIFY');solid.thickness=.001;solid.offset=-1
    # Fine lid rim follows the aperture and encloses the eye surface.
    for upper in [True,False]:
        pts=[];rads=[]
        for i in range(25):
            a=(0 if upper else pi)+i*pi/24;x,z=eye_outline(a,side)
            pts.append((x,face_y(x,z)-.0007,z));rads.append(.15+.85*sin(i*pi/24)**.45)
        curve(f'{"Upper_lash" if upper else "Lower_lid"}_{side}',pts,.0018 if upper else .00065,lash if upper else lid_skin,rads)
    # Short taper at the outer corner, not spikes around the complete opening.
    x=side*(EX+EW*.90);z=EZ+.007
    curve(f'Outer_lash_{side}',[(x,face_y(x,z)-.001,z),(x+side*.005,face_y(x,z)-.001,z+.003)],.0012,lash,[1,.05])
    pts=[]
    for i in range(9):
        t=i/8;x=side*(.021+t*.047);z=1.533+.005*sin(t*pi)-t*.003;pts.append((x,face_y(x,z)-.001,z))
    curve(f'Brow_{side}',pts,.0015,lash,[.15,.7,1,1,1,.9,.7,.4,.08])
    # The iris albedo carries stylized catchlights; no duplicate highlight balls.

# Tiny lip surfaces follow the face; no full inflated human lip ring.
for upper in [True,False]:
    def lp(u,v):
        x=(u-.5)*.036;shape=max(0,1-(x/.018)**2);line=1.427+.002*(abs(x)/.018)**2
        z=line+v*(.0019 if upper else -.0032)*shape
        return (x,face_y(x,z)-.00035-.0009*sin(v*pi)*shape,z)
    surface('Upper_lip' if upper else 'Lower_lip',lp,40,6,lip)
pts=[]
for i in range(15):
    x=(i/14-.5)*.036;z=1.427+.002*(abs(x)/.018)**2;pts.append((x,face_y(x,z)-.001,z))
curve('Gentle_smile',pts,.00045,mouth_line,[.2]+[.7]*13+[.2])
for side in [-1,1]:
    x=side*.006;z=1.457
    curve(f'Nostril_{side}',[(x-side*.0015,face_y(x,z)-.0003,z),(x,face_y(x,z)-.0005,z+.0005),(x+side*.0015,face_y(x,z)-.0003,z+.0002)],.0004,lip,[.1,.7,.1])
    sphere(f'Ear_{side}',(side*.087,.002,1.474),(.014,.012,.024),plain_skin)
    sphere(f'Ear_inner_{side}',(side*.092,-.009,1.475),(.007,.002,.014),lid_skin)
# Short tapered neck sinks into the existing collar and behind the jaw.
neck=surface('Short_neck',lambda u,v:(sin(u*2*pi)*mix(.040,.030,v),.014-cos(u*2*pi)*mix(.032,.028,v),mix(1.315,1.424,v)),64,12,plain_skin)

def bezier(points,t):
    p=[Vector(x) for x in points]
    while len(p)>1:p=[a.lerp(b,t) for a,b in zip(p,p[1:])]
    return p[0]
def lock(name,points,width,depth,color_index=0):
    def fn(u,v):
        p=bezier(points,v);t=(bezier(points,min(1,v+.001))-bezier(points,max(0,v-.001))).normalized()
        radial=Vector((p.x,p.y-.01,0)).normalized()
        across=t.cross(radial).normalized()
        if across.length<.1:across=Vector((1,0,0))
        out=across.cross(t).normalized()
        if out.dot(radial)<0:out=-out
        a=u*2*pi
        taper=(.03+.97*sin(pi*v)**.55)*(1-.85*smooth((v-.85)/.15))
        groove=.00012*sin(a*18+v*2.7)*sin(v*pi)
        return tuple(p+across*(cos(a)*width*taper)+out*(sin(a)*(depth+groove)*taper))
    palette=['4D2D20','553326','45291F','60402E']
    def hc(u,v,p):
        streak=.82+.13*sin(u*2*pi*9+v*2)+.05*sin(u*2*pi*23+v*3)
        shine=1+.12*sin(pi*v)**2
        return tuple(c*streak*shine for c in rgb(palette[color_index%len(palette)]))
    o=surface(name,fn,16,28,hair_mat)
    for loop in o.data.uv_layers.active.data:loop.uv.x=.12*loop.uv.x+.17*(color_index%4)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0000001)
    bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    return o

# The under-bob is hidden beneath individually curved volumes, not the fringe.
def bob(u,v):
    a=1.12+u*(2*pi-2.24);s=sin(a);c=-cos(a)
    p=bezier([(.018,.006,1.649),(.020+s*.068,.008+c*.070,1.642),(s*.137,.010+c*.135,1.460),(s*.103,.007+c*.093,1.395+.005*cos(a*5))],v)
    p.x*=.97;p.y=.01+(p.y-.01)*.97
    return tuple(p)
under=surface('Under_bob',bob,56,28,hair_shadow)
solid=under.modifiers.new('Bob_thickness','SOLIDIFY');solid.thickness=.003
for i in range(21):
    a=1.16+i*(2*pi-2.32)/20;s=sin(a);c=-cos(a);end=1.374+.010*sin(i*2.7)
    drift=.0015*sin(i*1.73)
    points=[(.018+s*.004,.006+c*.004,1.648+.0006*sin(i)),(.020+s*.071,.008+c*.074+drift,1.640),(s*.150,.010+c*.148+drift,1.470),(s*.130,.010+c*.122,1.365),(s*.102,.007+c*.093,end+.014)]
    lock(f'Bob_lock_{i:02}',points,.0155+.001*sin(i*2),.0032,i)
# The bangs share a curved surface with the skull. Thin overlapping ribbons
# follow that same surface instead of free-standing sausage-shaped tubes.
def fringe_point(u,v):
    tipx=mix(-.103,.103,u);x=.018*(1-v)**2+tipx*sin(v*pi/2)
    tipz=1.536+.013*(abs(tipx)/.103)**2+.004*sin(u*pi*7+.5)+.001*cos(u*pi*18)
    z=mix(1.650-.004*(u-.5)**2,tipz,1-cos(v*pi/2))
    y=.008-.106*sqrt(max(.012,1-((z-1.509)/.143)**2-(x/.129)**2))
    return (x,y,z)
bangs=surface('Fringe_foundation',lambda u,v:fringe_point(u,.10+.90*v),56,28,hair_mat)
# Explicit closed shell avoids Solidify folding its near-crown rim over itself.
front=[tuple(v.co) for v in bangs.data.vertices];count=len(front)
faces=[tuple(p.vertices) for p in bangs.data.polygons]
uvcoords=[(0,0)]*count
for p in bangs.data.polygons:
    for li in p.loop_indices:uvcoords[bangs.data.loops[li].vertex_index]=tuple(bangs.data.uv_layers.active.data[li].uv)
from collections import Counter
edges=Counter(tuple(sorted((f[i],f[(i+1)%len(f)]))) for f in faces for i in range(len(f)))
shellfaces=faces+[tuple(i+count for i in reversed(f)) for f in faces]
shellfaces += [(a,b,b+count,a+count) for (a,b),n in edges.items() if n==1]
bpy.data.objects.remove(bangs,do_unlink=True)
bangs=mesh('Fringe_foundation',front+[(x,y+.002,z) for x,y,z in front],shellfaces,hair_mat,uvcoords+uvcoords)
# Thin round frames conform to the face, including side arms and bridge.
for side in [-1,1]:
    pts=[]
    for i in range(65):
        a=i*2*pi/64;x=side*.043+cos(a)*.0335;z=1.498+sin(a)*.031
        pts.append((x,face_y(x,z)-.011,z))
    curve(f'Round_frame_{side}',pts,.00085,bronze)
    outer=side*.0765
    curve(f'Glasses_arm_{side}',[(outer,face_y(outer,1.498)-.011,1.498),(side*.092,-.025,1.497),(side*.095,.006,1.49)],.001,bronze)
curve('Glasses_bridge',[(-.0095,face_y(-.0095,1.498)-.011,1.498),(0,face_y(0,1.504)-.012,1.504),(.0095,face_y(.0095,1.498)-.011,1.498)],.0008,bronze)
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update();hair_tree=BVHTree.FromObject(bangs,bpy.context.evaluated_depsgraph_get())
clip_points=[]
for x,z in [(-.085,1.560),(-.075,1.557),(-.065,1.554)]:
    hit=hair_tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))[0]
    assert hit is not None,'Hair clip must be attached to the fringe surface'
    clip_points.append((x,hit.y-.001,z))
curve('Amber_hair_clip',clip_points,.0025,amber)

# Compact the lower face without stretching the forehead; seat the whole head
# closer to the collar. Every new feature receives the same landmark transform.
for o in head_parts.objects:
    if o.type!='MESH':continue
    for v in o.data.vertices:
        p=o.matrix_world@v.co
        if o.name=='Short_neck':p.z=1.315+(p.z-1.315)*.65
        else:
            if p.z<EZ:p.z=EZ+(p.z-EZ)*.80
            p.z-=.052
        v.co=o.matrix_world.inverted()@p

# Clean periodic seams/closed tips and create usable UVs for flat-colour pieces.
# Hair strip UVs retain the artist texture's longitudinal direction.
for o in head_parts.objects:
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o
    for modifier_name in [m.name for m in o.modifiers]:bpy.ops.object.modifier_apply(modifier=modifier_name)
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    uv=bm.loops.layers.uv.verify()
    for f in bm.faces:
        coords=[l[uv].uv.copy() for l in f.loops]
        area=sum(coords[i].x*coords[(i+1)%len(coords)].y-coords[(i+1)%len(coords)].x*coords[i].y for i in range(len(coords)))
        if abs(area)>1e-12:continue
        axes=sorted(range(3),key=lambda i:abs(f.normal[i]))[:2]
        for l in f.loops:l[uv].uv=(.1+l.vert.co[axes[0]]*.2,.1+(l.vert.co[axes[1]]%1)*.2)
    bm.to_mesh(o.data);bm.free()

# Old body stays only as a scale/collar reference. Remove its complete head tree.
bpy.ops.import_scene.gltf(filepath=str(ROOT/'web/assets/models/characters/zuri.glb'))
imported=list(bpy.context.selected_objects);rig=next(o for o in imported if o.type=='ARMATURE')
for o in imported:
    remove=(o.parent_type=='BONE' and o.parent_bone in ['head']) or o.name.startswith(('neck-surface','sculpted-face','ear-','ear-fold','blink-cover','upper-lash','eyelid-rig','hair-','bob-','swept-fringe','face-framing','round-glasses','glasses-','anatomical-right'))
    # Imported empty parents are removed only after their descendant meshes.
    if remove:o['remove_head_reference']=True
for o in imported:
    p=o.parent
    while p:
        if p.get('remove_head_reference'):o['remove_head_reference']=True;break
        p=p.parent
for o in imported:
    if o.get('remove_head_reference'):bpy.data.objects.remove(o,do_unlink=True)
    else:move(o,body_parts)
rig.animation_data_clear()
for b in rig.pose.bones:b.location=(0,0,0);b.rotation_quaternion=(1,0,0,0);b.scale=(1,1,1)
for c in [head_parts,body_parts]:
    for o in c.objects:
        if o.animation_data:o.animation_data_clear()
        if o.type=='MESH' and c==head_parts:o['castShadow']=True;o['receiveShadow']=True

def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy,size in [('Key',(-1.6,-2.5,3),170,2.4),('Fill',(2,-2,2),100,2.6),('Rim',(1,1.5,2.8),170,2)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=loc;aim(o,(0,0,1.48))
camdata=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camdata);studio.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.ortho_scale=.40;cam.location=(0,-2,1.49);aim(cam,(0,0,1.49))
scene.world.use_nodes=True;bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.72,.69,.63,1);bg.inputs['Strength'].default_value=.35
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'zuri-head-revision.blend'))
# Export is separate and includes the complete head geometry/materials.
bpy.ops.object.select_all(action='DESELECT')
for c in [head_parts,body_parts]:
    for o in c.objects:o.select_set(True)
bpy.context.view_layer.objects.active=head
bpy.ops.export_scene.gltf(filepath=str(OUT/'zuri-head-revision.glb'),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=True)
data=(OUT/'zuri-head-revision.glb').read_bytes();g=json.loads(data[20:20+int.from_bytes(data[12:16],'little')]);tris=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
meta={'id':'zuri-head-revision','stage':'static-head-art-review','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'triangles':tris,'meshes':len(g['meshes']),'clips':[],'blender':bpy.app.version_string,'source':'assets-source/characters/zuri-head-revision.blend','artApproved':False,'floorAdoption':False,'reused':'Body and wardrobe; iris paint from existing local face albedo. Head, eyes, lids, hair, glasses and neck geometry newly authored','landmarks':{'eyeHeight':EZ-.052,'eyeHalfWidth':EW,'chinHeight':EZ+(sections[0][0]-EZ)*.8-.052,'neckBottom':1.315,'neckTop':1.315+(1.424-1.315)*.65},'previousRejected':'zuri-blender-pilot.glb','textureSources':['assets-source/characters/zuri-hair-strands-albedo.png','docs/game-design/characters/2026-10-25-brand-study/local-rebuild/zuri-face-albedo-v1.png']}
assert tris<150000 and len(data)<15*1024*1024
(OUT/'zuri-head-revision.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8');print('REVISION',json.dumps(meta))
for name,loc in [('front',(0,-2,1.49)),('three-quarter',(.95,-2,1.51)),('side',(2,-.01,1.49)),('back',(0,2,1.49))]:
    cam.location=loc;aim(cam,(0,0,1.49));scene.render.filepath=str(REPORT/(name+'.png'));bpy.ops.render.render(write_still=True)
