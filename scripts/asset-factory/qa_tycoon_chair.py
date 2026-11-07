"""Inspect an exported chair in an isolated Blender process; never edits the input GLB."""
import bpy
import hashlib
import json
import sys
from pathlib import Path

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=False)
# The caller starts a separate --factory-startup process, not the user's live scene.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH'
           and not any(collection.name == 'glTF_not_exported' for collection in obj.users_collection)]
names = [obj.name for obj in objects]
sys.path.insert(0, r'C:\Users\suanr\.codex\skills\blender-asset-qa\scripts')
import qa_check
import review_shots
report = qa_check.run(objects=names, profile='game')
report['source'] = str(source)
report['sourceSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
report['blender'] = bpy.app.version_string
(output / 'qa.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str((output / 'chair-derived.blend').resolve()))
for mode in ['material', 'wire']:
    review_shots.run(objects=names, out=str((output / f'{mode}.png').resolve()), mode=mode, res=512)
print(json.dumps({'pass':report['pass'], 'errors':report['errors'], 'warnings':report['warnings'],
                  'sourceSha256':report['sourceSha256'], 'output':str(output)}))
if not report['pass']:
    raise RuntimeError('Chair geometry QA reports errors; inspect qa.json')
