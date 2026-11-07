"""Read MPFB anatomy and prior Lab bounds before fitting a new pilot head."""
import bpy, json
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/blender-character-pilot'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
macro = TargetService.get_default_macro_info_dict()
macro.update(gender=0, age=.28, muscle=.35, weight=.4, proportions=.55)
body = HumanService.create_human(macro_detail_dict=macro)
body.name='MPFB_Editable_Base'
bpy.context.view_layer.update()
groups={g.name:g.index for g in body.vertex_groups}
report={'base_dimensions':list(body.dimensions),'groups':list(groups)}
for name in ['head','neck','body','joint-head','helper-eyeball-l','helper-eyeball-r']:
    if name not in groups: continue
    coords=[v.co for v in body.data.vertices if any(g.group==groups[name] for g in v.groups)]
    if coords: report[name]={'count':len(coords),'min':[min(v[i] for v in coords) for i in range(3)],'max':[max(v[i] for v in coords) for i in range(3)]}
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mpfb-base.blend'))
bpy.ops.import_scene.gltf(filepath=str(ROOT/'web/assets/models/characters/zuri.glb'))
bpy.context.view_layer.update()
report['previous']=[{'name':o.name,'type':o.type,'location':list(o.matrix_world.translation),'bounds':[[min((o.matrix_world@Vector(p))[i] for p in o.bound_box) for i in range(3)],[max((o.matrix_world@Vector(p))[i] for p in o.bound_box) for i in range(3)]]} for o in bpy.context.selected_objects]
(OUT/'probe.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('PROBE', str(OUT/'probe.json'))
