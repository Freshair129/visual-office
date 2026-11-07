"""CC0 Anime Girl -> separate Zuri Lab adaptation. Never writes original/floors.

Run Blender with --factory-startup --disable-autoexec --python-exit-code 1.
The author's continuous face, hands, clothing topology and UVs are retained.
"""
import bpy, bmesh, math, json, hashlib, struct, re
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

R=Path(__file__).resolve().parents[2]
OUT=R/'web/assets/models/characters/candidates'
REPORT=R/'reports/zuri-anime-refinement3';REPORT.mkdir(parents=True,exist_ok=True)
SOURCE=R/'assets-source/characters/candidates/anime-lab.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),use_scripts=False)
bpy.context.view_layer.update()
oldrig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rest={b.name:(oldrig.matrix_world@b.head_local,oldrig.matrix_world@b.tail_local)for b in oldrig.data.bones}
widgets={b.custom_shape for b in oldrig.pose.bones if b.custom_shape}
obs=[o for o in bpy.context.scene.objects if o.type=='MESH'and o not in widgets]

# Bake only object coordinates, retaining source mesh/UV/vertex-group topology.
for o in obs:
    world=o.matrix_world.copy();o.parent=None;o.matrix_world=Matrix.Identity(4)
    o.data.transform(world)
    for m in list(o.modifiers):o.modifiers.remove(m)
    for p in o.data.polygons:p.use_smooth=True
for o in list(bpy.data.objects):
    if o not in obs:bpy.data.objects.remove(o,do_unlink=True)

def remove(name):
    o=bpy.data.objects.get(name)
    if o:
        if o in obs:obs.remove(o)
        bpy.data.objects.remove(o,do_unlink=True)

# Ponytail and curtain fringe are replaced by a short bob and soft segmented bangs.
for name in ['h.tail.1','h.tail.2','Hair Tie','h.front.1','h.front.2','h.front.3']+[o.name for o in obs if re.match(r'^h\d+$',o.name)]:remove(name)
remove('Lower Teeth')
def smoothstep(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def gauss(x,c,w):return math.exp(-((x-c)/w)**2)
def mat(name,hexcolor,rough=.5,metal=0):
    rgb=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    m.diffuse_color=(*rgb,1);return m
def assign(o,m):o.data.materials.clear();o.data.materials.append(m)
hair=mat('Zuri_Chestnut_Hair','54372A',.49)
hair2=mat('Zuri_Chestnut_Lights','51382A',.45)
for m in [hair,hair2]:
    next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Specular IOR Level'].default_value=.24
dark=mat('Zuri_Charcoal_Cotton','303136',.84)
cream=mat('Zuri_Ivory_Knit','EEDDC3',.87)
orange=mat('Zuri_Amber_Citrus','E8820C',.31)
frame=mat('Zuri_Brushed_Champagne_Frame','887D6A',.29,.72)
shoecream=mat('Zuri_Sneaker_Ivory','EFE4D2',.7)

# Retain the painted skin's variation, remove the source's saturated pink cast.
src=bpy.data.images.get('Character Material_BaseColor_sRGB')
sz=1024;src.scale(sz,sz);a=np.empty(sz*sz*4,dtype=np.float32);src.pixels.foreach_get(a);a=a.reshape(sz,sz,4)
lum=a[:,:,:3]@np.array([.40,.44,.16],dtype=np.float32)
colored=np.stack([np.clip(lum*1.12+.08,0,1),np.clip(lum*.91+.055,0,1),np.clip(lum*.79+.045,0,1)],axis=-1)
a[:,:,:3]=colored
im=bpy.data.images.new('Zuri_Warm_Skin_Albedo',width=sz,height=sz);im.pixels.foreach_set(a.ravel());im.pack()
skin=mat('Zuri_Warm_Skin','F3CDB3',.51);nt=skin.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
t=nt.nodes.new('ShaderNodeTexImage');t.image=im;nt.links.new(t.outputs['Color'],p.inputs['Base Color']);p.inputs['Subsurface Weight'].default_value=.04

body=bpy.data.objects['Retopo-Girl']
lip=mat('Zuri_Natural_Rose_Lips','B97869',.58)
color=body.data.color_attributes.new(name='ZuriFaceTint',type='FLOAT_COLOR',domain='POINT')
for v in body.data.vertices:
    x,y,z=v.co;w=gauss(x,0,.026)*gauss(z,1.431,.008)*(1-smoothstep(-.095,-.075,y))
    blush=gauss(abs(x),.061,.023)*gauss(z,1.464,.022)*(1-smoothstep(-.055,.005,y))
    color.data[v.index].color=(1,1-.42*w-.075*blush,1-.38*w-.065*blush,1)
nt=skin.node_tree;vc=nt.nodes.new('ShaderNodeVertexColor');vc.layer_name='ZuriFaceTint'
mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
nt.links.new(t.outputs['Color'],mix.inputs[1]);nt.links.new(vc.outputs['Color'],mix.inputs[2]);nt.links.new(mix.outputs[0],p.inputs['Base Color'])
for i,m in enumerate(body.data.materials):
    if m.name.startswith('Character'):body.data.materials[i]=skin
    elif m.name.startswith('Hair'):body.data.materials[i]=hair
assign(bpy.data.objects['Hands'],skin)
# Small proportional edits on the existing facial surface, not replacement spheres.
for o in [body,bpy.data.objects['Eye Brows'],bpy.data.objects['Eye Lashes']]:
    for v in o.data.vertices:
        x,y,z=v.co
        if z<1.37:continue
        front=1-smoothstep(-.07,.01,y)
        mouth=gauss(z,1.430,.025)*gauss(x,0,.055)*front
        nose=gauss(z,1.466,.023)*gauss(x,0,.024)*front
        v.co.x*=1-.53*mouth-.17*nose
        v.co.y+=.008*nose+.0025*mouth
        if o==body:v.co.z+=(1.431-z)*.73*gauss(z,1.431,.019)*gauss(x,0,.034)*front
        if o==body:v.co.z-=.003*gauss(abs(x),.025,.013)*gauss(z,1.432,.017)*front
        if o==body:
            v.co.y-=.004*gauss(abs(x),.054,.024)*gauss(z,1.449,.023)*front
            v.co.z+=.003*gauss(x,0,.023)*gauss(z,1.458,.020)*front
        # Lift the chin slightly and soften the long lower face.
        v.co.z+=.018*gauss(z,1.397,.033)*front
        v.co.x*=1+.065*gauss(z,1.455,.035)*front
        v.co.x*=1+.075*gauss(z,1.407,.020)*front
        # A soft almond opening rather than a round startled eye. The same
        # smooth deformation is applied to lids, globe and lash surfaces.
        eye=gauss(abs(x),.045,.035)*gauss(z,1.498,.030)*front
        v.co.z+=(1.498-z)*.035*eye
        if o.name=='Eye Brows':v.co.z=1.529+(v.co.z-1.529)*.48;v.co.y-=.001
        if o.name=='Eye Lashes':
            lid=1.512-.23*abs(abs(x)-.045)
            if z>lid:v.co.z-=min(.004,(z-lid)*.38)

# Bake the skin + soft lip tint to a portable image; glTF's vertex-color
# interpretation must not silently drop the material's multiplication network.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=4
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='CUDA';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='CUDA'
    scene.cycles.device='GPU'
except Exception:pass
baked=bpy.data.images.new('Zuri_Face_Baked_Albedo',width=1024,height=1024)
saved=[]
for m in body.data.materials:
    nt=m.node_tree;bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');out=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
    old=out.inputs['Surface'].links[0].from_socket;e=nt.nodes.new('ShaderNodeEmission');colorinput=bs.inputs['Base Color']
    if colorinput.is_linked:nt.links.new(colorinput.links[0].from_socket,e.inputs['Color'])
    else:e.inputs['Color'].default_value=colorinput.default_value
    nt.links.new(e.outputs[0],out.inputs['Surface']);n=nt.nodes.new('ShaderNodeTexImage');n.image=baked;nt.nodes.active=n;saved.append((nt,out,old,e,n))
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
scene.render.bake.margin=10;bpy.ops.object.bake(type='EMIT');baked.pack()
for nt,out,old,e,n in saved:nt.links.new(old,out.inputs['Surface']);nt.nodes.remove(e);nt.nodes.remove(n)
face=mat('Zuri_Face_PBR','FFFFFF',.52);nt=face.node_tree;bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');n=nt.nodes.new('ShaderNodeTexImage');n.image=baked;nt.links.new(n.outputs['Color'],bs.inputs['Base Color'])
assign(body,face)
for p in body.data.polygons:p.material_index=0
for attr in list(body.data.color_attributes):body.data.color_attributes.remove(attr)
for o in [bpy.data.objects['Eye.L'],bpy.data.objects['Eye.R']]:
    # The source contains a duplicate near-coplanar corneal shell; glossy iris
    # and sclera materials provide the sheen without overlapping surfaces.
    bm=bmesh.new();bm.from_mesh(o.data)
    drop=[f for f in bm.faces if o.data.materials[f.material_index].name.startswith('Eye Glass')]
    bmesh.ops.delete(bm,geom=drop,context='FACES');bm.to_mesh(o.data);bm.free()
    pupilverts={i for p in o.data.polygons if o.data.materials[p.material_index].name.startswith('Pupil')for i in p.vertices}
    for i in pupilverts:o.data.vertices[i].co.y-=.0018
    for m in o.data.materials:
        if m.name.startswith('Eye Color'):
            p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            p.inputs['Base Color'].default_value=(.24,.095,.025,1);p.inputs['Roughness'].default_value=.26
        if m.name.startswith('Eye White'):
            p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(.8,.76,.68,1);p.inputs['Roughness'].default_value=.25
# Match eyebrows to chestnut rather than thick black strokes.
assign(bpy.data.objects['Eye Brows'],hair)
# Use the clean right-eye surface for the symmetrical left eye too; the source
# left iris contains two almost coplanar triangles absent from the right eye.
eyeL=bpy.data.objects['Eye.L'];eyeL.data=bpy.data.objects['Eye.R'].data.copy()
for v in eyeL.data.vertices:v.co.x=.0009215-v.co.x
bm=bmesh.new();bm.from_mesh(eyeL.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(eyeL.data);bm.free()

# Iris texture carries a darker limbal edge and fine radial variation. Both the
# iris and pupil use the same projection so the highlight crosses their seam.
size=512;iy,ix=np.mgrid[0:size,0:size];u=(ix+.5)/size*2-1;v=(iy+.5)/size*2-1
radius=np.sqrt(u*u+v*v);angle=np.arctan2(v,u)
fiber=(np.sin(angle*73+radius*17)+.5*np.sin(angle*121-radius*9))*.035
lower=np.clip((1-v)/2,0,1)
iris_color=np.stack([.30+.26*lower+fiber,.15+.19*lower+fiber*.55,.065+.09*lower+fiber*.2],axis=-1)
edge=np.clip((1-radius)/.14,0,1);pupil=np.clip((radius-.39)/.075,0,1)
iris_color=iris_color*(.22+.78*edge[:,:,None])*(.07+.93*pupil[:,:,None])
shine=np.exp(-(((u+.30)/.17)**2+((v-.39)/.22)**2)*2)
shine+=.75*np.exp(-(((u-.34)/.075)**2+((v+.28)/.10)**2)*2)
iris_color=iris_color*(1-np.clip(shine,0,.93)[:,:,None])+np.clip(shine,0,.93)[:,:,None]*np.array([1.,.97,.86])
pixels=np.ones((size,size,4),np.float32);pixels[:,:,:3]=np.clip(iris_color,0,1)
iris_img=bpy.data.images.new('Zuri_Amber_Iris_Detail',width=size,height=size);iris_img.pixels.foreach_set(pixels.ravel());iris_img.pack()
iris_mat=mat('Zuri_Amber_Iris_PBR','FFFFFF',.22);nt=iris_mat.node_tree
p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Coat Weight'].default_value=.15
n=nt.nodes.new('ShaderNodeTexImage');n.image=iris_img;nt.links.new(n.outputs['Color'],p.inputs['Base Color'])
for o in [bpy.data.objects['Eye.L'],bpy.data.objects['Eye.R']]:
    ids={i for poly in o.data.polygons if o.data.materials[poly.material_index].name.startswith(('Eye Color','Pupil'))for i in poly.vertices}
    cx=(min(o.data.vertices[i].co.x for i in ids)+max(o.data.vertices[i].co.x for i in ids))/2
    cz=(min(o.data.vertices[i].co.z for i in ids)+max(o.data.vertices[i].co.z for i in ids))/2
    rx=max(abs(o.data.vertices[i].co.x-cx)for i in ids);rz=max(abs(o.data.vertices[i].co.z-cz)for i in ids)
    uv=o.data.uv_layers.active
    slot=len(o.data.materials);o.data.materials.append(iris_mat)
    for poly in o.data.polygons:
        if o.data.materials[poly.material_index].name.startswith(('Eye Color','Pupil')):
            poly.material_index=slot
            for li in poly.loop_indices:
                co=o.data.vertices[o.data.loops[li].vertex_index].co
                uv.data[li].uv=((co.x-cx)/rx*.5+.5,(co.z-cz)/rz*.5+.5)
    for vertex in o.data.vertices:
        x,y,z=vertex.co;front=1-smoothstep(-.07,.01,y)
        eye=gauss(abs(x),.045,.035)*gauss(z,1.498,.030)*front
        vertex.co.z+=(1.498-z)*.035*eye
remove('Upper Teeth')

# Expand the author's nape locks into a cheek-length bob; bind it to the head.
for o in obs:
    if not re.match(r'^h\d+$',o.name):continue
    assign(o,hair)
    for v in o.data.vertices:
        x,y,z=v.co;t=1-smoothstep(1.40,1.59,z)
        v.co.x=x*(1+.18*t)
        v.co.y=y+.022*t*(.5+max(0,y)*4)
        v.co.z=z-.055*t

def tube(name,points,radius,material,cyclic=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=radius;c.bevel_resolution=3;c.use_fill_caps=True
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for b,p in zip(s.bezier_points,points):b.co=p;b.handle_left_type=b.handle_right_type='AUTO'
    s.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');obs.append(o);return o

def lock(name,centers,widths,depths,material,sideaxis=(1,0,0)):
    # Closed elliptical sweep, with broad soft surfaces rather than tube strands.
    verts=[];faces=[];n=12
    for j,c in enumerate(centers):
        c=Vector(c);tangent=Vector(centers[min(j+1,len(centers)-1)])-Vector(centers[max(j-1,0)])
        side=Vector(sideaxis);side=(side-tangent.normalized()*side.dot(tangent.normalized())).normalized();normal=tangent.normalized().cross(side)
        for k in range(n):
            a=2*math.pi*k/n;verts.append(tuple(c+side*(widths[j]*math.cos(a))+normal*(depths[j]*math.sin(a))))
    for j in range(len(centers)-1):
        for k in range(n):a=j*n+k;b=j*n+(k+1)%n;faces.append((a,b,b+n,a+n))
    faces.append(tuple(reversed(range(n))));faces.append(tuple((len(centers)-1)*n+k for k in range(n)))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);assign(o,material)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    uv=me.uv_layers.new(name='HairFlow')
    for polygon in me.polygons:
        for li in polygon.loop_indices:
            idx=me.loops[li].vertex_index;uv.data[li].uv=((idx%n)/n,(idx//n)/(len(centers)-1))
    for p in me.polygons:p.use_smooth=True
    sub=o.modifiers.new('Soft lock curvature','SUBSURF');sub.levels=2;sub.render_levels=2
    obs.append(o);return o

# Hair color uses longitudinal strand variation, shared by the continuous shell
# and its shallow ribbons. Geometry supplies silhouette; color supplies fibers.
size=1024;yy,xx=np.mgrid[0:size,0:size];u=xx/size;v=yy/size
strand=.95+.035*np.sin(u*math.pi*2*139+.35*np.sin(v*8))+.016*np.sin(u*math.pi*2*367+v*2)
band=1+.075*np.sin(v*math.pi*2-.4)+.06*np.sin(u*math.pi*2*17+v*3)
pix=np.ones((size,size,4),np.float32);pix[:,:,:3]=np.array([.32,.195,.137])*strand[:,:,None]*band[:,:,None]
hair_img=bpy.data.images.new('Zuri_Chestnut_Strand_Albedo',width=size,height=size);hair_img.pixels.foreach_set(pix.ravel());hair_img.pack()
for material in [hair,hair2]:
    nt=material.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');n=nt.nodes.new('ShaderNodeTexImage');n.image=hair_img;nt.links.new(n.outputs['Color'],p.inputs['Base Color'])

# The crown and the lock roots share vertices. Lower sections fan into curved,
# tapered tips, making actual gaps and a broken silhouette instead of painting
# vertical lines on a solid helmet. No coincident overlay shells are involved.
verts=[];faces=[];sectors=26;across_steps=6;rows=28
profile=[(1.35,.105,.086),(1.375,.119,.103),(1.41,.127,.114),(1.46,.127,.125),(1.51,.119,.131),(1.56,.110,.124),(1.61,.084,.098),(1.64,.050,.061),(1.656,.001,.001)]
def hair_radius(z,column):
    i=max(0,min(len(profile)-2,int(np.searchsorted([p[0]for p in profile],z))-1))
    a,b=profile[i],profile[i+1];h=b[0]-a[0];t=max(0,min(1,(z-a[0])/h))
    left=profile[max(0,i-1)];right=profile[min(len(profile)-1,i+2)]
    m0=(b[column]-left[column])/(b[0]-left[0]);m1=(right[column]-a[column])/(right[0]-a[0])
    return max(.001,(2*t**3-3*t**2+1)*a[column]+(t**3-2*t**2+t)*h*m0+(-2*t**3+3*t**2)*b[column]+(t**3-t**2)*h*m1)
pole=0;verts.append((.025,.008,1.656))
for sector in range(sectors):
    start=-math.pi+2*math.pi*sector/sectors;span=2*math.pi/sectors
    center=start+span*.5;first=len(verts)
    for j in range(1,rows+1):
        t=j/rows
        for k in range(across_steps+1):
            s=k/across_steps*2-1;theta=start+span*(s+1)*.5
            front=smoothstep(2.13,2.55,abs(theta))
            end=1.362+.166*front+.004*math.sin(theta*9)
            # Edges finish earlier than the center, producing unequal tapered
            # ends. Upper rows remain exactly welded across lock boundaries.
            taper=smoothstep(.74,1,t)
            z=1.656+(end-1.656)*t+(.010-.006*front)*s*s*taper
            theta=center+(theta-center)*(1-(.66-.23*front)*taper)
            flow=theta+.16*math.sin(t*math.pi)+.045*math.sin(t*math.pi*2)*math.sin(theta*3)
            rx=hair_radius(z,1);ry=hair_radius(z,2)
            ridge=.0028*(1-s*s)*math.sin(math.pi*t)**.7
            wave=.009*math.sin(12*(t-.35)+theta*2)*smoothstep(.30,.65,t)*(1-front)
            curl=-.010*smoothstep(.83,1,t)*(1-front)
            root_shift=.025*smoothstep(1.56,1.656,z)
            verts.append((root_shift+(rx+ridge+wave+curl)*math.sin(flow),.008+(ry+ridge+wave+curl)*math.cos(flow),z))
    stride=across_steps+1
    for j in range(rows-1):
        for k in range(across_steps):
            a=first+j*stride+k;faces.append((a,a+1,a+stride+1,a+stride))
    for k in range(across_steps):faces.append((pole,first+k+1,first+k))
me=bpy.data.meshes.new('Zuri_Bob_Unified');me.from_pydata(verts,[],faces);me.update()
hair_volume=bpy.data.objects.new('Zuri_Bob_Unified',me);bpy.context.collection.objects.link(hair_volume);assign(hair_volume,hair)
bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000008);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
uv=me.uv_layers.new(name='HairFlow')
for poly in me.polygons:
    poly.use_smooth=True
    for li in poly.loop_indices:
        co=me.vertices[me.loops[li].vertex_index].co
        uv.data[li].uv=((math.atan2(co.x,co.y-.008)+math.pi)/(2*math.pi),(co.z-1.35)/.31)
sub=hair_volume.modifiers.new('Hair surface continuity','SUBSURF');sub.levels=1;sub.render_levels=1
# Solidify's averaged normals fold the narrow concave tips back onto the outer
# surface. Build the inner shell along the head's radial field instead; this
# keeps the silhouette and gives every tip a stable, non-inverted thickness.
bpy.ops.object.select_all(action='DESELECT');hair_volume.select_set(True);bpy.context.view_layer.objects.active=hair_volume
bpy.ops.object.modifier_apply(modifier=sub.name)
me=hair_volume.data;outer=[v.co.copy()for v in me.vertices];count=len(outer)
inner=[]
for co in outer:
    direction=Vector((co.x/.12**2,(co.y-.008)/.13**2,max(0,co.z-1.50)/.15**2)).normalized()
    inner.append(co-direction*.0025)
shell_faces=[tuple(p.vertices)for p in me.polygons]
shell_faces += [tuple(count+i for i in reversed(p.vertices))for p in me.polygons]
bm=bmesh.new();bm.from_mesh(me)
for e in bm.edges:
    if e.is_boundary:
        a,b=(v.index for v in e.verts);shell_faces.append((a,b,b+count,a+count))
bm.free()
shell=bpy.data.meshes.new('Zuri_Bob_Closed_Locks');shell.from_pydata(outer+inner,[],shell_faces);shell.update()
hair_volume.data=shell;shell.uv_layers.new(name='HairFlow');assign(hair_volume,hair)
bm=bmesh.new();bm.from_mesh(shell);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(shell);bm.free()
for polygon in shell.polygons:polygon.use_smooth=True
obs.append(hair_volume)

# Real frame geometry at the existing eye surface; no opaque lens disks.
for s in (-1,1):
    cx=s*.045
    pts=[(cx+.0375*math.cos(a),-.103+.008*abs(math.cos(a)),1.496+.0335*math.sin(a))for a in np.linspace(0,2*math.pi,16,endpoint=False)]
    tube('Zuri_Glasses_Rim_'+str(s),pts,.00085,frame,True)
    tube('Zuri_Glasses_Temple_'+str(s),[(s*.082,-.099,1.506),(s*.080,-.088,1.509),(s*.085,-.064,1.51),(s*.090,-.020,1.505),(s*.090,.005,1.49)],.0011,frame)
tube('Zuri_Glasses_Bridge',[(-.007,-.102,1.501),(0,-.110,1.508),(.007,-.102,1.501)],.0011,frame)
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();ev=hair_volume.evaluated_get(dg);surface=ev.to_mesh()
hair_bvh=BVHTree.FromPolygons([v.co for v in surface.vertices],[p.vertices[:]for p in surface.polygons])
clip_points=[];clip_anchors=[]
for point in [(-.109,-.089,1.572),(-.092,-.111,1.569),(-.069,-.119,1.566)]:
    nearest=hair_bvh.find_nearest(Vector(point));clip_anchors.append((nearest[0],nearest[1]));clip_points.append(nearest[0]+nearest[1]*.0055)
ev.to_mesh_clear();tube('Zuri_Orange_Clip',clip_points,.0034,orange)
for i in (0,2):
    p,n=clip_anchors[i]
    tube('Zuri_Orange_Pin_'+str(i),[p-n*.001,p+n*.004],.001,orange)

# Reuse the source's stitched topology, with new subtle knit albedo.
sz=1024;yy,xx=np.mgrid[0:sz,0:sz];pix=np.ones((sz,sz,4),np.float32)
knit=.985+.012*np.sin(xx*math.pi/2)*np.cos(yy*math.pi/3)
lines=((xx%174)<2)|((yy%174)<2)
rgb=np.array([.94,.875,.765]);pix[:,:,:3]=rgb*knit[:,:,None];pix[lines,:3]*=.91
im=bpy.data.images.new('Zuri_Cardigan_Woven_Check',width=sz,height=sz);im.pixels.foreach_set(pix.ravel());im.pack()
nt=cream.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im;nt.links.new(tex.outputs['Color'],p.inputs['Base Color'])
jacket=bpy.data.objects['Jacket'];assign(jacket,cream)
jacketTree=KDTree(len(jacket.data.vertices));jacketWeights=[]
for v in jacket.data.vertices:
    jacketTree.insert(v.co,v.index);jacketWeights.append([(jacket.vertex_groups[g.group].name,g.weight)for g in v.groups])
jacketTree.balance()
bm=bmesh.new();bm.from_mesh(jacket.data)
# Keep the authored sleeves and their deformation. Replace the jacket body and
# tall collar with an actual open cardigan torso, rather than cutting a neckline
# through triangulated collar panels and leaving ragged edges.
for side in (-1,1):
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(side*.161,0,0),plane_no=(1,0,0))
bmesh.ops.delete(bm,geom=[f for f in bm.faces if abs(f.calc_center_median().x)<.161],context='FACES')
bm.to_mesh(jacket.data);bm.free()
for v in jacket.data.vertices:
    x,y,z=v.co
    # Fold down the source's standing collar instead of keeping a jacket neck.
    if z>1.30 and abs(x)<.12:v.co.z=1.30+(z-1.30)*.12;v.co.y-=.005
    if z>1.30 and abs(x)<.23:v.co.z=1.30+(z-1.30)*.2
    # Puff the lower sleeves slightly, keeping original wrist/shoulder weights.
    if abs(x)>.24:
        centerz=1.31-(abs(x)-.16)*.16
        v.co.z=centerz+(z-centerz)*1.15;v.co.y*=1.07
verts=[];faces=[];steps=48
rings=[(.965,.138,.103),(.98,.141,.106),(1.025,.143,.112),(1.12,.149,.125),(1.21,.168,.122),(1.275,.183,.102),(1.300,.165,.083),(1.326,.062,.043)]
for z,rx,ry in rings:
    for k in range(steps+1):
        theta=-2.79+5.58*k/steps;verts.append(((rx+.002)*math.sin(theta),-.01+(ry+.002)*math.cos(theta),z))
for j in range(len(rings)-1):
    for k in range(steps):
        a=j*(steps+1)+k;b=a+1
        faces.append((a,b,b+steps+1,a+steps+1))
me=bpy.data.meshes.new('Zuri_Cardigan_Torso');me.from_pydata(verts,[],faces);me.update();card=bpy.data.objects.new('Zuri_Cardigan_Torso',me);bpy.context.collection.objects.link(card);assign(card,cream)
vgs={}
for i,v in enumerate(verts):
    weights={};near=jacketTree.find_n(Vector(v),4);total=sum(1/(d+.005)**2 for _,_,d in near)
    for _,idx,d in near:
        factor=(1/(d+.005)**2)/total
        for n,w in jacketWeights[idx]:weights[n]=weights.get(n,0)+factor*w
    for n,w in weights.items():
        if n not in vgs:vgs[n]=card.vertex_groups.new(name=n)
        vgs[n].add([i],w,'REPLACE')
for p in me.polygons:p.use_smooth=True
solid=card.modifiers.new('Knit thickness','SOLIDIFY');solid.thickness=.002
sub=card.modifiers.new('Soft knit silhouette','SUBSURF');sub.levels=2;sub.render_levels=2;obs.append(card)
# Stitch the clean sleeve-cut boundary to the evaluated cardigan shoulder. Only
# boundary vertices move; authored elbow/wrist topology and weights stay intact.
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
ev=card.evaluated_get(dg);surface=ev.to_mesh();bvh=BVHTree.FromPolygons([v.co for v in surface.vertices],[p.vertices[:]for p in surface.polygons])
for v in jacket.data.vertices:
    if abs(abs(v.co.x)-.161)<.0001:
        nearest=bvh.find_nearest(v.co)
        if nearest and nearest[0] is not None and nearest[3]<.065:v.co=nearest[0]-nearest[1]*.003
ev.to_mesh_clear()
# The original shoulder skin is completely covered by the new knit and shirt.
# Remove only hidden torso faces; keep the authored head and neck surface.
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z<1.318],context='FACES');bm.to_mesh(body.data);bm.free()
remove('Top')
# Close the tank-top neckline into the dark crew-neck insert from Zuri's sheet.
verts=[];faces=[]
shirt_rings=[(.93,.106,.070),(1.00,.108,.071),(1.10,.110,.078),(1.18,.120,.095),(1.24,.124,.088),(1.29,.086,.060),(1.325,.039,.034)]
for z,rx,ry in shirt_rings:
    if z<1.31:rx*=.90;ry*=.92
    for k in range(40):
        a=k*2*math.pi/40;verts.append((rx*math.cos(a),-.013+ry*math.sin(a),z))
for j in range(len(shirt_rings)-1):
    for k in range(40):a=j*40+k;b=j*40+(k+1)%40;faces.append((a,b,b+40,a+40))
me=bpy.data.meshes.new('Zuri_Crew_Neck');me.from_pydata(verts,[],faces);me.update();shirt=bpy.data.objects.new('Zuri_Crew_Neck',me);bpy.context.collection.objects.link(shirt);assign(shirt,dark)
vgs={n:shirt.vertex_groups.new(name=n)for n in ['DEF-spine.001','DEF-spine.002','DEF-spine.003']}
for i,v in enumerate(verts):
    z=v[2];name='DEF-spine.001'if z<1.04 else 'DEF-spine.002'if z<1.16 else 'DEF-spine.003';vgs[name].add([i],1,'REPLACE')
for p in me.polygons:p.use_smooth=True
solid=shirt.modifiers.new('Fabric thickness','SOLIDIFY');solid.thickness=.0015
sub=shirt.modifiers.new('Neck curve','SUBSURF');sub.levels=1;sub.render_levels=1;obs.append(shirt)
pants=bpy.data.objects['Pant.002'];assign(pants,dark)
bands={}
for v in pants.data.vertices:
    x,y,z=v.co
    if z<.80:
        k=round(z/.025);b=bands.setdefault(k,[.001,.001]);b[0]=max(b[0],abs(abs(x)-.078));b[1]=max(b[1],abs(y+.008))
for v in pants.data.vertices:
    x,y,z=v.co;s=1 if x>0 else -1;c=s*.078
    if z<.79:
        rx,ry=bands[round(z/.025)];blend=1-smoothstep(.68,.79,z)
        sx=1+blend*((.061+.006*z/.79)/rx-1);sy=1+blend*(.063/ry-1)
        v.co.x=c+(x-c)*sx;v.co.y=-.008+(y+.008)*sy
    if z<.3:v.co.z=.042+(z-.10)*1.27
shoes=bpy.data.objects['Shoes'];assign(shoes,shoecream);shoes.data.materials.append(orange)
# Remove the source boot shafts/straps; keep the authored low shoe and sole.
bm=bmesh.new();bm.from_mesh(shoes.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000008)
geom=list(bm.verts)+list(bm.edges)+list(bm.faces)
bmesh.ops.bisect_plane(bm,geom=geom,dist=.000001,plane_co=(0,0,.115),plane_no=(0,0,1),clear_outer=True,clear_inner=False)
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-.115)<.00001 for v in e.verts)],sides=0)
bm.to_mesh(shoes.data);bm.free()
for v in shoes.data.vertices:
    if v.co.z>.09:v.co.z=.09+(v.co.z-.09)*.35
for p in shoes.data.polygons:
    c=sum((shoes.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
    if c.z<.027 or (abs(c.x)>.125 and -.08<c.y<.015):p.material_index=1
for v in bpy.data.objects['Eye Lashes'].data.vertices:v.co.y-=.0045

# A small game skeleton replaces 1,174 source control/helper bones. It keeps the
# original skin weights by explicit semantic remapping and top-four normalizing.
arm=bpy.data.armatures.new('Zuri_Anime_Game_Skeleton');rig=bpy.data.objects.new('Zuri_Anime_Rig',arm);bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
spec=[]
def bone(name,source,parent=None,end=None):
    h,t=rest[source];t=rest[end][1]if end else t
    b=arm.edit_bones.new(name);b.head=h;b.tail=t
    if parent:b.parent=arm.edit_bones[parent]
    b.use_connect=False;spec.append(name)
b=arm.edit_bones.new('Root');b.head=(0,0,0);b.tail=(0,0,.12)
bone('Hips','DEF-spine','Root');bone('Spine','DEF-spine.001','Hips');bone('Chest','DEF-spine.002','Spine');bone('UpperChest','DEF-spine.003','Chest')
bone('Neck','DEF-Spine.004','UpperChest',end='DEF-Neck');bone('Head','DEF-Head','Neck')
for s in ('L','R'):
    bone('Shoulder.'+s,'DEF-shoulder.'+s,'UpperChest')
    bone('UpperArm.'+s,'DEF-upper_arm.'+s,'Shoulder.'+s,end='DEF-upper_arm.'+s+'.001')
    bone('Forearm.'+s,'DEF-forearm.'+s,'UpperArm.'+s,end='DEF-forearm.'+s+'.001')
    bone('Hand.'+s,'DEF-hand.'+s,'Forearm.'+s)
    bone('Thigh.'+s,'DEF-thigh.'+s,'Hips',end='DEF-thigh.'+s+'.001')
    bone('Shin.'+s,'DEF-shin.'+s,'Thigh.'+s,end='DEF-shin.'+s+'.001')
    bone('Foot.'+s,'DEF-foot.'+s,'Shin.'+s);bone('Toe.'+s,'DEF-toe.'+s,'Foot.'+s)
    for f in ('thumb','f_index','f_middle','f_ring','f_pinky'):
        for i in range(1,4):
            src='DEF-%s.%02d.%s'%(f,i,s)
            if src not in rest:continue
            name='%s.%02d.%s'%(f,i,s);parent='Hand.'+s if i==1 else '%s.%02d.%s'%(f,i-1,s)
            bone(name,src,parent)
bpy.ops.object.mode_set(mode='OBJECT')
def mapgroup(name):
    if name.startswith('DEF-f_')or name.startswith('DEF-thumb'):return name[4:]
    if 'upper_arm.' in name:return 'UpperArm.'+('L'if '.L'in name else 'R')
    for old,new in [('forearm','Forearm'),('shoulder','Shoulder'),('hand','Hand'),('palm','Hand'),('thigh','Thigh'),('shin','Shin'),('foot','Foot'),('toe','Toe')]:
        if ('-'+old+'.')in name:return new+'.'+('L'if '.L'in name else 'R')
    return {'DEF-spine':'Hips','DEF-spine.001':'Spine','DEF-spine.002':'Chest','DEF-spine.003':'UpperChest','DEF-Spine.004':'Neck','DEF-Neck':'Neck'}.get(name,'Hips'if 'pelvis'in name else 'Head')
for o in obs:
    groups={g.index:mapgroup(g.name)for g in o.vertex_groups}
    rigid=o.name.startswith(('h','Zuri_Bang','Zuri_Bob','Zuri_Glasses','Zuri_Orange'))
    weights=[]
    for v in o.data.vertices:
        d={}
        if rigid:d={'Head':1}
        else:
            for g in v.groups:
                n=groups[g.group];d[n]=d.get(n,0)+g.weight
        if not d:d={'Head':1}
        pairs=sorted(d.items(),key=lambda x:-x[1])[:4];total=sum(w for _,w in pairs);weights.append([(n,w/total)for n,w in pairs if w>1e-5])
    o.vertex_groups.clear();vg={n:o.vertex_groups.new(name=n)for n in sorted({n for w in weights for n,_ in w})}
    for i,pairs in enumerate(weights):
        for n,w in pairs:vg[n].add([i],w,'REPLACE')
    # glTF splits vertices at UV seams. Weld spatial duplicates before adding
    # subdivision, otherwise each disconnected seam shrinks into a sharp flap.
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000008)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    mod=o.modifiers.new('Skin','ARMATURE');mod.object=rig;o.parent=rig
    # Catmull-Clark on source low-density skin/clothing keeps faces smooth.
    if o.name in ['Retopo-Girl','Eye Brows','Eye Lashes','Jacket','Pant.002','Top','Hands']:
        sub=o.modifiers.new('Surface continuity','SUBSURF');sub.levels=1;sub.render_levels=1
    if o.name.startswith('Zuri_')or o.name in ['Shoes','Upper Teeth']:
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        for name in [m.name for m in o.modifiers if m.type!='ARMATURE']:bpy.ops.object.modifier_apply(modifier=name)
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001);bm.to_mesh(o.data);bm.free()
        if o.name=='Zuri_Bob_Unified':
            # Reproject evaluated thickness/pole faces too. A solidified rim
            # otherwise inherits coincident UVs from its outer edge.
            # Project final triangles: a non-zero quad area can still hide a
            # collinear UV triangle after the exporter splits that quad.
            bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
            uv=o.data.uv_layers.active
            for polygon in o.data.polygons:
                values=[]
                for li in polygon.loop_indices:
                    co=o.data.vertices[o.data.loops[li].vertex_index].co
                    values.append([li,(math.atan2(co.x,co.y-.008)+math.pi)/(2*math.pi),(co.z-1.35)/.31,co])
                if max(v[1]for v in values)-min(v[1]for v in values)>.5:
                    for v in values:
                        if v[1]<.5:v[1]+=1
                area=abs(sum(values[i][1]*values[(i+1)%len(values)][2]-values[(i+1)%len(values)][1]*values[i][2] for i in range(len(values))))*.5
                if area<1e-9:
                    drop=max(range(3),key=lambda axis:abs(polygon.normal[axis]));axes=[a for a in range(3)if a!=drop]
                    for v in values:v[1]=v[3][axes[0]]/.31+.5;v[2]=v[3][axes[1]]/.31+.5
                for li,u,v,co in values:uv.data[li].uv=(u,v)
        if not o.data.uv_layers or not o.name.startswith(('Zuri_Bob_','Zuri_Bang_')):
            bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')

def rotate(name,axis,degrees):
    b=rig.pose.bones[name];basis=b.bone.matrix_local.to_quaternion()
    b.rotation_quaternion=basis.inverted()@Quaternion(Vector(axis),math.radians(degrees))@basis
def arm_direction(side,direction):
    b=rig.pose.bones['UpperArm.'+side];basis=b.bone.matrix_local.to_quaternion()
    delta=(b.bone.tail_local-b.bone.head_local).normalized().rotation_difference(Vector(direction).normalized())
    b.rotation_quaternion=basis.inverted()@delta@basis
def aim_pose(name,direction):
    bpy.context.view_layer.update();b=rig.pose.bones[name]
    q=(b.tail-b.head).normalized().rotation_difference(Vector(direction).normalized())
    b.matrix=Matrix.Translation(b.head)@q.to_matrix().to_4x4()@Matrix.Translation(-b.head)@b.matrix
def flat_hand(side):
    bpy.context.view_layer.update();b=rig.pose.bones['Hand.'+side]
    def basis(forward):
        forward=forward.normalized();up=Vector((0,0,1));up=(up-forward*up.dot(forward)).normalized()
        return Matrix((forward.cross(up),forward,up)).transposed()
    source=basis(b.bone.tail_local-b.bone.head_local);target=basis(Vector((0,-1,-.02)))
    orientation=target@source.inverted()@b.bone.matrix_local.to_3x3()
    b.matrix=Matrix.Translation(b.head)@orientation.to_4x4()
def reset():
    for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
def pose(name,phase):
    reset();a=math.sin(phase*2*math.pi)
    for s,sign in [('L',1),('R',-1)]:
        arm_direction(s,(sign*.30,-.04,-.96))
        rotate('Forearm.'+s,(0,0,1),-sign*7)
        for f in ('f_index','f_middle','f_ring','f_pinky'):
            for i in (1,2,3):
                n='%s.%02d.%s'%(f,i,s)
                if n in rig.pose.bones:rotate(n,(0,1,0),sign*(8 if i==1 else 13))
    rotate('Head',(0,0,1),a*.7)
    if name=='idle':rotate('UpperChest',(1,0,0),a*.5)
    elif name=='walking':
        for s,sign in [('L',1),('R',-1)]:
            v=a*sign;rotate('Thigh.'+s,(1,0,0),v*19)
            rotate('Shin.'+s,(1,0,0),max(0,-v)*29)
            rotate('Foot.'+s,(1,0,0),-max(0,-v)*13)
            arm_direction(s,(sign*.29,-v*.22-.04,-.96))
        rotate('Hips',(0,0,1),a*2)
    elif name=='seated':
        # Bone local Y points up. Convert world translations explicitly.
        rig.pose.bones['Root'].location=rig.data.bones['Root'].matrix_local.to_3x3().inverted()@Vector((0,-.075,0))
        for s,sign in [('L',1),('R',-1)]:
            rotate('Thigh.'+s,(1,0,0),-87);rotate('Shin.'+s,(1,0,0),87)
            arm_direction(s,(sign*.18,-.62,-.77))
        rotate('Chest',(1,0,0),9);rotate('UpperChest',(1,0,0),3);rotate('Head',(1,0,0),3+a*.4)
        for s,sign in [('L',1),('R',-1)]:
            aim_pose('Forearm.'+s,(sign*.03,-1,-.22))
            # Relaxed palm orientation, instead of palms facing one another.
            b=rig.pose.bones['Hand.'+s];b.rotation_quaternion=Quaternion((0,1,0),math.radians(sign*65))
    # Ground the actual deformed soles, not a hip pivot or an unposed bound box.
    bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();ev=shoes.evaluated_get(dg);me=ev.to_mesh()
    low=min((ev.matrix_world@v.co).z for v in me.vertices);ev.to_mesh_clear()
    rig.pose.bones['Root'].location+=rig.data.bones['Root'].matrix_local.to_3x3().inverted()@Vector((0,0,-low))
    if name=='seated':
        # Solve the two arm segments to a real desk wrist position after the
        # seated body is grounded. This is not a hard-coded elbow angle.
        for s,sign in [('L',1),('R',-1)]:
            bpy.context.view_layer.update();upper=rig.pose.bones['UpperArm.'+s];fore=rig.pose.bones['Forearm.'+s]
            A=upper.head.copy();B=Vector((sign*.21,-.39,.820));D=B-A;distance=D.length;direction=D.normalized()
            l1=upper.bone.length;l2=fore.bone.length
            c=max(-.98,min(.98,(l1*l1+distance*distance-l2*l2)/(2*l1*distance)))
            down=Vector((0,0,-1));bend=(down-direction*down.dot(direction)).normalized()
            elbow=A+direction*(l1*c)+bend*(l1*math.sqrt(1-c*c))
            aim_pose('UpperArm.'+s,elbow-A);bpy.context.view_layer.update();aim_pose('Forearm.'+s,B-fore.head)
            flat_hand(s)
            for f in ('f_index','f_middle','f_ring','f_pinky'):
                for i in (1,2,3):
                    n='%s.%02d.%s'%(f,i,s)
                    if n in rig.pose.bones:rig.pose.bones[n].rotation_quaternion=(1,0,0,0)

scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1
for name,length in [('idle',90),('walking',36),('seated',90)]:
    rig.animation_data_create();rig.animation_data.action=None
    for f in range(1,length+2):
        scene.frame_set(f);pose(name,(f-1)/length)
        for b in rig.pose.bones:
            b.keyframe_insert('rotation_quaternion',frame=f);b.keyframe_insert('location',frame=f)
    act=rig.animation_data.action;act.name=name;act.use_fake_user=True
    track=rig.animation_data.nla_tracks.new();track.name=name;track.mute=True;track.strips.new(name,1,act)
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1);scene.frame_end=91
bpy.context.view_layer.update()
for t in bpy.data.texts:t.use_module=False
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(R/'assets-source/characters/candidates/zuri-anime.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in obs+[rig]:o.select_set(True)
path=OUT/'zuri-anime.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True,export_def_bones=True,export_image_format='AUTO',export_extras=False)
data=path.read_bytes();jsz=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+jsz])
doc['asset']['copyright']='Base: Rigged Anime Girl by 3dquads blender (CC0-1.0). Zuri adaptation for Visual Office Character Lab.'
doc['asset']['extras']={'license':'https://creativecommons.org/publicdomain/zero/1.0/','baseAsset':'anime','floorAdoption':False,'artApproved':False}
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);tail=data[20+jsz:];data=struct.pack('<III',0x46546c67,2,20+len(j)+len(tail))+struct.pack('<II',len(j),0x4e4f534a)+j+tail;path.write_bytes(data)
meta={'id':'zuri-anime','name':'Zuri · Anime base adaptation','author':'Visual Office; base by 3dquads blender','license':'CC0-1.0 (base model)','source':'https://www.blendkit.com/asset-gallery-detail/1d63f553-863b-41d4-b3bd-d92222700fee/','attribution':'Base: Rigged Anime Girl — 3dquads blender (CC0); Zuri adaptation: Visual Office','sha256':hashlib.sha256(data).hexdigest(),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'baseGlbSha256':hashlib.sha256((OUT/'anime.glb').read_bytes()).hexdigest(),'bytes':len(data),'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes']for p in m['primitives']),'meshes':len(doc['meshes']),'materials':len(doc['materials']),'skins':len(doc.get('skins',[])),'animations':len(doc.get('animations',[])),'clipNames':[a['name']for a in doc.get('animations',[])],'height':1.65,'facePoint':[0,1.493,.005],'faceDistance':.69,'artApproved':False,'floorAdoption':False,'changes':['Retained author face/body topology with proportional face refinements.','Warm skin and brown iris, shorter bob and fringe, thin glasses and orange clip.','Cream cardigan, charcoal shirt/trousers, cream/orange footwear.','Explicit semantic skin transfer to a game skeleton; authored Lab motion studies.'],'limitations':['Art and motion require visual review; no floor adoption.','Base contact/topology findings require production cleanup.']}
meta['revision']=3
meta['changes']+=['Refinement 2: softer almond eye opening, detailed amber iris, smaller neutral mouth and shorter lower face.','Continuous bob surface with strand color and attached clip; fitted cardigan sleeve boundary.']
meta['changes']+=['Refinement 3: asymmetric crown flow, curved tapered bob locks and separate fringe tips, warmer chestnut shading, softer cheek/chin, smaller neutral mouth and fuller eye opening.']
(OUT/'zuri-anime.json').write_text(json.dumps(meta,indent=2),encoding='utf8');print('EXPORTED',json.dumps(meta),flush=True)
