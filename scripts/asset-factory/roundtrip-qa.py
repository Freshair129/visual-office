import bpy,sys,json
from pathlib import Path
if not bpy.app.background or '--factory-startup' not in sys.argv: raise RuntimeError('isolated mode required')
args=sys.argv[sys.argv.index('--')+1:];source,out=map(Path,args)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
sys.path.insert(0,r'C:\Users\suanr\.codex\skills\blender-asset-qa\scripts')
import qa_check
names=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and not any(c.name=='glTF_not_exported' for c in o.users_collection)]
result=qa_check.run(objects=names,profile='game')
out.write_text(json.dumps({'source':str(source),'objects':len(names),'qa':result},indent=2),encoding='utf-8')
print('ROUNDTRIP',len(names),result['pass'],len(result['errors']),len(result['warnings']))
