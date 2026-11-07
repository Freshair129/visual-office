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
import struct
import sys
import zlib
from pathlib import Path

sys.dont_write_bytecode = True

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/character-lod'


def freeze_default_pose(path):
    """Evaluate glTF default skin/node matrices before Blender's rig retargeting.

    Blender's importer retargets each skin into its chosen armature bind pose.
    Mixing rigid and skinned attachments under a scaled root can therefore
    change a static comparison even when Three evaluates identical vertices.
    This review-only GLB contains the declared default geometry, UVs, colors,
    materials and textures. Actual animated equivalence is checked separately
    by verify_character_batches.mjs using Three's loader.
    """
    from mathutils import Matrix, Quaternion
    spec = importlib.util.spec_from_file_location('lod_geometry', ROOT / 'scripts/asset-factory/build_character_lods.py')
    lod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lod)
    doc, binary, _ = lod.read_glb(path)
    import copy
    out, writer = copy.deepcopy(doc), lod.Repack(doc, binary)
    parents = {child: i for i, n in enumerate(doc['nodes']) for child in n.get('children', [])}
    matrices = {}
    def world(i):
        if i not in matrices:
            n = doc['nodes'][i]
            if 'matrix' in n:
                matrix = Matrix([n['matrix'][j:j + 4] for j in range(0, 16, 4)]).transposed()
            else:
                x, y, z, w = n.get('rotation', (0, 0, 0, 1))
                matrix = Matrix.LocRotScale(Vector(n.get('translation', (0, 0, 0))),
                                            Quaternion((w, x, y, z)), Vector(n.get('scale', (1, 1, 1))))
            matrices[i] = world(parents[i]) @ matrix if i in parents else matrix
        return matrices[i]
    out['nodes'], out['meshes'] = [], []
    for i, node in enumerate(doc['nodes']):
        if 'mesh' not in node:
            continue
        mesh = copy.deepcopy(doc['meshes'][node['mesh']])
        for p in mesh['primitives']:
            attrs = p['attributes']
            if p.get('targets') or 'TANGENT' in attrs:
                raise ValueError('review freeze requires a reviewed morph/tangent recipe')
            positions = lod.accessor_values(doc, binary, attrs['POSITION'])
            normals = lod.accessor_values(doc, binary, attrs['NORMAL'])
            if 'skin' in node:
                skin = doc['skins'][node['skin']]
                binds = lod.accessor_values(doc, binary, skin['inverseBindMatrices'])
                bones = [world(j) @ Matrix([b[k:k + 4] for k in range(0, 16, 4)]).transposed()
                         for j, b in zip(skin['joints'], binds)]
                joints = lod.accessor_values(doc, binary, attrs['JOINTS_0'])
                weights = lod.accessor_values(doc, binary, attrs['WEIGHTS_0'])
                transforms = [sum((bones[j] * w for j, w in zip(js, ws)), Matrix(((0.,) * 4,) * 4))
                              for js, ws in zip(joints, weights)]
                transformed_normals = [(m.to_3x3() @ Vector(n)).normalized() for m, n in zip(transforms, normals)]
            else:
                transforms = [world(i)] * len(positions)
                normal_matrix = world(i).to_3x3().inverted().transposed()
                transformed_normals = [(normal_matrix @ Vector(n)).normalized() for n in normals]
            attrs = {k: writer.old_accessor(a) for k, a in attrs.items()
                     if k not in ('POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0')}
            attrs['POSITION'] = writer.add_accessor([tuple(m @ Vector(v)) for m, v in zip(transforms, positions)], 'VEC3')
            attrs['NORMAL'] = writer.add_accessor([tuple(n) for n in transformed_normals], 'VEC3')
            p['attributes'] = attrs
            if 'indices' in p:
                p['indices'] = writer.old_accessor(p['indices'])
        out['nodes'].append({'name': node.get('name', str(i)), 'mesh': len(out['meshes'])})
        out['meshes'].append(mesh)
    for image in out.get('images', []):
        image['bufferView'] = writer.old_view(image['bufferView'])
    out['scenes'], out['scene'] = [{'nodes': list(range(len(out['nodes'])))}], 0
    out.pop('animations', None)
    out.pop('skins', None)
    return writer.encode(out)


def png_pixels(path):
    """Read the review renderer's 8-bit RGBA PNG without color conversion."""
    import numpy as np
    raw = path.read_bytes()
    if raw[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('invalid review PNG')
    offset, compressed = 8, bytearray()
    while offset < len(raw):
        size = struct.unpack_from('>I', raw, offset)[0]
        kind, chunk = raw[offset + 4:offset + 8], raw[offset + 8:offset + 8 + size]
        if kind == b'IHDR':
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', chunk)
            if (depth, color, compression, filtering, interlace) != (8, 6, 0, 0, 0):
                raise ValueError('expected noninterlaced RGBA8 review PNG')
        elif kind == b'IDAT':
            compressed.extend(chunk)
        offset += size + 12
    data, stride = zlib.decompress(compressed), width * 4
    rows = np.zeros((height, stride), dtype=np.uint8)
    for y in range(height):
        start = y * (stride + 1)
        mode = data[start]
        for x, value in enumerate(data[start + 1:start + 1 + stride]):
            a = int(rows[y, x - 4]) if x >= 4 else 0
            b = int(rows[y - 1, x]) if y else 0
            c = int(rows[y - 1, x - 4]) if y and x >= 4 else 0
            p = a + b - c
            pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            predictor = [0, a, b, (a + b) // 2, a if pa <= pb and pa <= pc else b if pb <= pc else c][mode]
            rows[y, x] = (value + predictor) & 255
    return rows.reshape(height, width, 4)


def compare_views(id):
    import numpy as np
    differences, pairs = {}, []
    for view in ('front', 'side', 'face-front', 'face-side'):
        before = png_pixels(OUT / f'{id}-original-{view}.png')
        after = png_pixels(OUT / f'{id}-lod1-{view}.png')
        delta = np.abs(before[:, :, :3].astype(np.int16) - after[:, :, :3].astype(np.int16))
        differences[view] = {'meanAbsoluteRgb8': float(delta.mean()),
                             'rmsRgb8': float(np.sqrt((delta.astype(float) ** 2).mean())),
                             'maxChannelDifference': int(delta.max()),
                             'changedPixelPercent': float((delta.max(axis=2) > 0).mean() * 100),
                             'pixelsOver8Percent': float((delta.max(axis=2) > 8).mean() * 100)}
        pairs.append(np.concatenate((before, after), axis=1))
    sheet = np.concatenate(pairs, axis=0)
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    header = struct.pack('>IIBBBBB', sheet.shape[1], sheet.shape[0], 8, 6, 0, 0, 0)
    pixels = b''.join(b'\0' + row.tobytes() for row in sheet)
    (OUT / f'{id}-comparison.png').write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
                                             + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b''))
    (OUT / f'{id}-pixel-diff.json').write_text(json.dumps({
        'id': id, 'method': 'RGB8 encoded PNG, same camera/CPU Cycles settings; includes sampling differences',
        'sheet': 'left before / right after; front, side, face-front, face-side', 'views': differences,
    }, indent=2) + '\n', encoding='utf-8')
    print('@@PIXEL_DIFF@@' + json.dumps({'id': id, 'views': differences}), flush=True)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def render_asset(path, prefix, qa, framing=None, freeze=False):
    original = path.read_bytes()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.use_auto_save_temporary_files = False
    bpy.context.preferences.filepaths.temporary_directory = str(OUT / 'temp')
    # Import the actual glTF default pose. The importer otherwise activates the
    # first clip, while forcing REST discards glTF node transforms in favour of
    # inverse-bind-derived rest bones (not equivalent, notably Staff B scale).
    # Remove only animation declarations in a local, byte-preserving BIN copy.
    size = struct.unpack_from('<I', original, 12)[0]
    document = json.loads(original[20:20 + size])
    document.pop('animations', None)
    header = json.dumps(document, separators=(',', ':')).encode('utf-8')
    header += b' ' * (-len(header) % 4)
    tail = original[20 + size:]
    imported = (struct.pack('<III', 0x46546C67, 2, 20 + len(header) + len(tail))
                + struct.pack('<II', len(header), 0x4E4F534A) + header + tail)
    if freeze:
        imported = freeze_default_pose(path)
    temporary = OUT / 'temp' / (prefix + '-default-pose.glb')
    temporary.parent.mkdir(parents=True, exist_ok=True)
    with temporary.open('xb') as handle:
        handle.write(imported)
    if bpy.ops.import_scene.gltf(filepath=str(temporary), disable_bone_shape=True,
                                 guess_original_bind_pose=False) != {'FINISHED'}:
        raise RuntimeError('GLB import failed')
    scene = bpy.context.scene
    # A shared static rest/default pose; this is not animated/device acceptance.
    for obj in scene.objects:
        obj.animation_data_clear()
        if obj.type == 'ARMATURE':
            obj.data.pose_position = 'POSE'
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
              'bounds': [list(low), list(high)], 'pose': ('evaluated glTF default node/skin transforms; static review-only wrapper' if freeze else
                  'glTF default node transforms; animation declarations omitted in temporary import copy; BIN unchanged')}
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


def run(qa_script=None, label=None, only=None, before_dir=None, after_dir=None, freeze=False):
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
    def local_directory(value):
        path = (ROOT / value).resolve()
        if not path.is_relative_to(ROOT):
            raise ValueError('comparison inputs must stay inside this repository')
        return path
    before = local_directory(before_dir) if before_dir else None
    after = local_directory(after_dir) if after_dir else ROOT / 'web/assets/models/characters/lod'
    for asset in manifest['assets']:
        if only and asset['id'] != only:
            continue
        framing = render_asset(before / asset['file'] if before else ROOT / asset['source'], asset['id'] + '-original', qa, freeze=freeze)
        render_asset(after / asset['file'], asset['id'] + '-lod1', qa, framing, freeze=freeze)
        compare_views(asset['id'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--qa-script')
    parser.add_argument('--label', help='fresh report subdirectory, e.g. final')
    parser.add_argument('--only', help='review only a changed character')
    parser.add_argument('--before-dir', help='repository-local approved LOD1 baseline directory')
    parser.add_argument('--after-dir', help='repository-local generated LOD1 directory')
    parser.add_argument('--freeze', action='store_true', help='render evaluated glTF default geometry without Blender skin retargeting; retain non-frozen review separately')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    run(**vars(args))
