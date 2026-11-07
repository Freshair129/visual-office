"""Sample deformed shoes in the Blender source, including walk in-place drift.

Usage: blender -b --factory-startup actor.blend --python-exit-code 1 -P
  scripts/asset-factory/check_motion.py -- OUTPUT.json
This reports measurements, not visual or production acceptance.
"""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

if not bpy.app.background or '--factory-startup' not in sys.argv:
    raise RuntimeError('requires a separate background Blender process with --factory-startup')
args=sys.argv[sys.argv.index('--')+1:]
if len(args)!=1: raise ValueError('expected output JSON path')
rig=bpy.data.objects.get('OfficeRig')
shoes={side:bpy.data.objects.get('office-'+side+'-shoe') for side in ('left','right')}
if rig is None or any(o is None for o in shoes.values()): raise ValueError('rig/shoes missing')
scene=bpy.context.scene
results={}
for clip in ('idle','walk','sit_down','sitting','typing','waving','stand_up'):
    action=bpy.data.actions.get(clip)
    if action is None: raise ValueError('missing '+clip)
    rig.animation_data.action=action
    first,last=map(round,action.frame_range)
    frames=[];pelvis_bottom=[]
    for frame in range(first,last+1):
        scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();entry={'frame':frame}
        for side,obj in shoes.items():
            evaluated=obj.evaluated_get(dg);mesh=evaluated.to_mesh()
            try:
                pts=[evaluated.matrix_world @ v.co for v in mesh.vertices]
                bottom=min(v.z for v in pts)
                # Approximate shoe sole position from vertices close to the lowest point.
                sole=[v for v in pts if v.z<=bottom+.01]
                center=sum(sole,Vector())/len(sole)
                entry[side]={'bottom':bottom,'x':center.x,'y':center.y}
            finally:evaluated.to_mesh_clear()
        if clip in ('sitting','typing'):
            pelvis=bpy.data.objects.get('office-pelvis')
            if pelvis is None: raise ValueError('pelvis mesh missing')
            evaluated=pelvis.evaluated_get(dg);mesh=evaluated.to_mesh()
            try:pelvis_bottom.append(min((evaluated.matrix_world @ v.co).z for v in mesh.vertices))
            finally:evaluated.to_mesh_clear()
        frames.append(entry)
    minimum=min(v[side]['bottom'] for v in frames for side in shoes)
    maximum_gap=max(min(v['left']['bottom'],v['right']['bottom']) for v in frames)
    # World-space motion if navigation advances in the actor's forward direction at .85 m/s.
    drift=[]
    if clip=='walk':
        for side in shoes:
            for a,b in zip(frames,frames[1:]):
                if a[side]['bottom']<=.02 and b[side]['bottom']<=.02:
                    dx=b[side]['x']-a[side]['x']
                    dy=(b[side]['y']-a[side]['y'])-.85/scene.render.fps
                    drift.append({'side':side,'from':a['frame'],'to':b['frame'],'distance_m':math.hypot(dx,dy)})
    results[clip]={'frames':len(frames),'min_shoe_z_m':minimum,
                   'max_both_feet_gap_m':maximum_gap,
                   'walk_contact_step_max_m':max((d['distance_m'] for d in drift),default=None),
                   'walk_worst_contact':max(drift,key=lambda d:d['distance_m'],default=None),
                   'walk_contact_samples':len(drift),
                   'pelvis_min_z_m':min(pelvis_bottom,default=None),
                   'default_seat_z_m':.551132 if pelvis_bottom else None,
                   'per_foot':{side:{'min_z_m':min(v[side]['bottom'] for v in frames),
                                     'max_z_m':max(v[side]['bottom'] for v in frames),
                                     'grounded_frames':sum(v[side]['bottom']<=.02 for v in frames),
                                     'walk_grounded_pairs':sum(d['side']==side for d in drift)} for side in shoes}}
out=Path(args[0]).resolve();out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps({'fps':scene.render.fps,'navigation_m_per_s':.85,'clips':results},indent=2)+'\n',encoding='utf-8')
print(json.dumps(results))
