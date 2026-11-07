"""Compare pinned originals and LODs in a separate headless Blender process.

Writes only local reports/character-lod evidence, never assets or .blend files.
Pass --qa-script with the installed blender-asset-qa/scripts/qa_check.py path.
Four cameras per file: front/side silhouette and front/side face close-up.
"""
import argparse
import hashlib
import importlib.util
import json
import shutil
import sys
from pathlib import Path

sys.dont_write_bytecode = True

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/character-lod'


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def render_asset(path, prefix, qa, framing=None):
    original = path.read_bytes()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.use_auto_save_temporary_files = False
    bpy.context.preferences.filepaths.temporary_directory = str(OUT / 'temp')
    if bpy.ops.import_scene.gltf(filepath=str(path)) != {'FINISHED'}:
        raise RuntimeError('GLB import failed')
    scene = bpy.context.scene
    # A shared static rest/default pose; this is not animated/device acceptance.
    for obj in scene.objects:
        obj.animation_data_clear()
        if obj.type == 'ARMATURE':
            obj.data.pose_position = 'REST'
    scene.frame_set(1)
    bpy.context.view_layer.update()
    objects = [o for o in scene.objects if o.type == 'MESH']
    # Some imported skinned objects expose sentinel (-1,1) object bounds. Use
    # the evaluated vertices so the common camera really frames the character.
    points = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            points.extend(obj.matrix_world @ vertex.co for vertex in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    report = {'file': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(original).hexdigest(),
              'bounds': [list(low), list(high)], 'pose': 'imported rest/default; animation disabled'}
    if framing is None:
        framing = (low, high)
    lo, hi = framing
    center, height = (lo + hi) / 2, hi.z - lo.z
    if qa:
        # Full topology, UV, weighting, contact and overlap diagnostics on both
        # variants. Source defects are reported, not silently repaired as art.
        report['qa'] = qa.run(objects=[o.name for o in objects], profile='game')
        print('@@QA@@' + json.dumps({'asset': prefix, 'pass': report['qa']['pass'],
                                    'errors': len(report['qa']['errors']),
                                    'warnings': len(report['qa']['warnings'])}), flush=True)
    with (OUT / (prefix + '-review.json')).open('x', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.render.resolution_x = 384
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('LOD_Review_World')
    world.use_nodes = True
    world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.32, .32, .32, 1)
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .6
    scene.world = world
    for name, offset, energy, size in [
        ('Key', (-1.5, -2.0, 2.4), 160, 2),
        ('Fill', (1.5, -1.0, 1.2), 80, 2),
        ('Rim', (0, 1.8, 2), 100, 1.5),
    ]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy, light.shape, light.size = energy * height ** 2, 'DISK', size * height
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = center + Vector(offset) * height
        aim(obj, center)
    data = bpy.data.cameras.new('LOD_Review_Camera')
    camera = bpy.data.objects.new('LOD_Review_Camera', data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    data.type, data.clip_start, data.clip_end = 'ORTHO', .001, 100
    for close in (False, True):
        target = center.copy()
        if close:
            target.z = lo.z + height * .86
        data.ortho_scale = height * .36 if close else max(height * 1.12, (hi.x - lo.x) * 1.12 / .75)
        for view, offset in [('front', (0, -3, 0)), ('side', (3, 0, 0))]:
            camera.location = target + Vector(offset) * height
            aim(camera, target)
            filename = prefix + '-' + ('face-' if close else '') + view + '.png'
            destination = OUT / filename
            if destination.exists():
                raise FileExistsError(destination)
            scene.render.filepath = str(destination)
            bpy.ops.render.render(write_still=True)
            print('@@RENDER@@' + filename, flush=True)
    if path.read_bytes() != original:
        raise RuntimeError('source bytes changed')
    return framing


def run(qa_script=None, label=None, only=None):
    global OUT
    if not bpy.app.background or '--factory-startup' not in sys.argv:
        raise RuntimeError('requires separate background Blender with factory startup')
    if shutil.disk_usage(ROOT).free - 1024 ** 3 < 50 * 1024 ** 3:
        raise RuntimeError('projected free space below 50 GiB floor')
    if label:
        if not label.replace('-', '').isalnum():
            raise ValueError('label must be a simple alphanumeric run name')
        OUT = OUT / label
    OUT.mkdir(parents=True, exist_ok=True)
    qa = None
    if qa_script:
        spec = importlib.util.spec_from_file_location('character_lod_qa', qa_script)
        qa = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(qa)
    manifest = json.loads((ROOT / 'web/assets/models/characters/lod/manifest.json').read_text())
    if only and only not in [a['id'] for a in manifest['assets']]:
        raise ValueError('unknown character')
    for asset in manifest['assets']:
        if only and asset['id'] != only:
            continue
        framing = render_asset(ROOT / asset['source'], asset['id'] + '-original', qa)
        render_asset(ROOT / 'web/assets/models/characters/lod' / asset['file'], asset['id'] + '-lod1', qa, framing)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--qa-script')
    parser.add_argument('--label', help='fresh report subdirectory, e.g. final')
    parser.add_argument('--only', help='review only a changed character')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    run(**vars(args))
