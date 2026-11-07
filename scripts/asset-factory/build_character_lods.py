"""Build additive temporary-character LOD candidates; never re-export a source.

Blender 5.2.2, in a separate process after storage admission:
  blender -b --factory-startup --python-exit-code 1 -P THIS.py -- --output DIR
Read-only inventory (ordinary Python; no bpy dependency):
  python -B THIS.py --inspect

The GLB scene, skins, materials and animation samples are copied, not round-
tripped through Blender's scene importer/exporter. Blender's Decimate modifier
only processes individual mesh primitives. This preserves rigid node animation
(Wangjai), shared joints (Staff), exact bind matrices and all original clips.
No Draco, Meshopt, WebP or KTX2 decoder is added or required. Outputs are review
candidates, NOT art approval, device qualification or automatic runtime adoption.
"""
import argparse
import copy
import hashlib
import json
import math
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'web/assets/models/characters'
SOURCES = {
    'zuri': ('candidates/zuri-face-r4.glb', '68fdfc353eb2ca71f0c4ebef4453157033c11dd5a62d92249f347104458516ab', 40000, 3000000),
    'wangjai': ('wangjai.glb', '5bf4e7886fd6f0844ebd54b60aa31a1383e32f0bf1bfa5bfb681d8a60aa4f09e', 25000, 1500000),
    'staff-a': ('staff-a.glb', '9e82d9d5b783e49ce0e902bd13e9398f3255e86c380b481f45266e608c38e7fc', 25000, 1500000),
    'staff-b': ('staff-b.glb', 'b88bfed7072ec5482e046113c36785a513c91f96a194564e6ea3b838b6fc8c82', 25000, 1500000),
}
COMPONENTS = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
MAX_DROPPED_SKIN_WEIGHT = .02


class SkinInfluenceLoss(ValueError):
    """Only this known quality failure permits a less aggressive retry."""

    def __init__(self, loss):
        self.loss = loss
        super().__init__(f'skin influence loss {loss:.6%} exceeds 2%; retain more geometry')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_glb(path):
    data = path.read_bytes()
    if len(data) < 28 or struct.unpack_from('<III', data) != (0x46546C67, 2, len(data)):
        raise ValueError(f'invalid GLB header: {path}')
    size, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4E4F534A:
        raise ValueError('first GLB chunk must be JSON')
    doc = json.loads(data[20:20 + size])
    count, kind = struct.unpack_from('<II', data, 20 + size)
    if kind != 0x004E4942 or 28 + size + count != len(data):
        raise ValueError('expected a single embedded BIN chunk')
    if len(doc.get('buffers', [])) != 1 or 'uri' in doc['buffers'][0]:
        raise ValueError('external/multiple buffers are not supported')
    binary = data[28 + size:]
    if doc['buffers'][0]['byteLength'] > len(binary):
        raise ValueError('truncated BIN chunk')
    return doc, binary, data


def view_bytes(doc, binary, index):
    view = doc['bufferViews'][index]
    if view.get('buffer', 0) != 0 or view.get('extensions'):
        raise ValueError('unsupported buffer view')
    start, size = view.get('byteOffset', 0), view['byteLength']
    if start < 0 or size < 0 or start + size > len(binary):
        raise ValueError('buffer view outside BIN chunk')
    return binary[start:start + size]


def accessor_values(doc, binary, index):
    accessor = doc['accessors'][index]
    if 'sparse' in accessor or 'bufferView' not in accessor:
        raise ValueError('sparse/implicit accessors require a reviewed recipe')
    code, size = COMPONENTS[accessor['componentType']]
    width = WIDTHS[accessor['type']]
    view = doc['bufferViews'][accessor['bufferView']]
    raw = view_bytes(doc, binary, accessor['bufferView'])
    stride = view.get('byteStride', size * width)
    start = accessor.get('byteOffset', 0)
    if stride < size * width or start + max(0, accessor['count'] - 1) * stride + size * width > len(raw):
        raise ValueError('invalid accessor range')
    values = [struct.unpack_from('<' + code * width, raw, start + i * stride) for i in range(accessor['count'])]
    if accessor.get('normalized'):
        divisor = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}.get(accessor['componentType'])
        if divisor is None:
            raise ValueError('invalid normalized accessor')
        values = [tuple(max(-1, x / divisor) for x in row) for row in values]
    if any(not math.isfinite(x) for row in values for x in row):
        raise ValueError('nonfinite accessor')
    return values


def primitive_triangles(doc, primitive):
    if primitive.get('mode', 4) != 4:
        raise ValueError('only triangle primitives are supported')
    count = doc['accessors'][primitive.get('indices', primitive['attributes']['POSITION'])]['count']
    if count % 3:
        raise ValueError('triangle index count is not divisible by three')
    return count // 3


def stats(doc, binary, data):
    textures = []
    for image in doc.get('images', []):
        if image.get('mimeType') != 'image/png' or 'uri' in image:
            raise ValueError('recipe expects embedded PNG images')
        raw = view_bytes(doc, binary, image['bufferView'])
        if raw[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError('invalid PNG')
        textures.append({'name': image.get('name', ''), 'mimeType': 'image/png',
                         'width': struct.unpack_from('>I', raw, 16)[0],
                         'height': struct.unpack_from('>I', raw, 20)[0], 'bytes': len(raw)})
    return {'bytes': len(data), 'sha256': sha(data),
            'triangles': sum(primitive_triangles(doc, p) for m in doc['meshes'] for p in m['primitives']),
            'meshes': len(doc['meshes']), 'materials': len(doc.get('materials', [])),
            'primitives': sum(len(m['primitives']) for m in doc['meshes']),
            'skins': len(doc.get('skins', [])),
            'bones': sorted({doc['nodes'][j]['name'] for s in doc.get('skins', []) for j in s['joints']}),
            'clips': [a['name'] for a in doc.get('animations', [])], 'textures': textures}


def reduction(id, name, triangles):
    """Source-specific conservative recipe. Protect faces before chasing budgets.

    An over-budget face-preserving candidate is reported, never silently subjected
    to a second aggressive whole-body pass. All names refer to pinned input GLBs.
    """
    if triangles <= 128:
        return 1.0
    if id == 'zuri':
        if name in ('Retopo-Girl', 'Eye Brows', 'Eye Lashes', 'Eye.L', 'Eye.R', 'Tongue', 'Shoes'):
            return 1.0
        if name == 'Zuri_Bob_Unified':
            return .12
        if name == 'Hands':
            return .20
        if name in ('Pant.002', 'Zuri_Cardigan_Torso'):
            return .08
        return .25
    if id == 'wangjai':
        if name in ('wangjai-shell', 'wangjai-visor', 'wangjai-eye-left', 'wangjai-eye-right', 'wangjai-smile'):
            return .5 if name != 'wangjai-smile' else 1.0
        return .20
    if any(token in name for token in ('sculpted-face', 'lip', 'smile', 'brow', 'nostril', 'lash', 'lid')):
        return 1.0
    if any(token in name for token in ('eye-white', 'iris', 'pupil', 'catchlight', 'ear')):
        return .30
    if name.endswith('shoe-sole'):
        return 1.0  # Keep the existing seat-fit/standing contact surface.
    if any(token in name for token in ('hair', 'lock', 'fringe', 'sideburn')):
        return .22
    return .16


class Repack:
    """Compact only referenced data; retain original accessor/sample bytes verbatim."""
    def __init__(self, doc, binary):
        self.doc, self.binary = doc, binary
        self.views, self.accessors, self.chunks = [], [], bytearray()
        self.view_map, self.accessor_map = {}, {}

    def add_view(self, raw, template=None):
        self.chunks.extend(b'\0' * (-len(self.chunks) % 4))
        view = copy.deepcopy(template or {})
        view.update(buffer=0, byteOffset=len(self.chunks), byteLength=len(raw))
        self.chunks.extend(raw)
        self.views.append(view)
        return len(self.views) - 1

    def old_view(self, index):
        if index not in self.view_map:
            self.view_map[index] = self.add_view(view_bytes(self.doc, self.binary, index), self.doc['bufferViews'][index])
        return self.view_map[index]

    def old_accessor(self, index):
        if index not in self.accessor_map:
            accessor = copy.deepcopy(self.doc['accessors'][index])
            if 'sparse' in accessor or 'bufferView' not in accessor:
                raise ValueError('unsupported accessor during compaction')
            accessor['bufferView'] = self.old_view(accessor['bufferView'])
            self.accessors.append(accessor)
            self.accessor_map[index] = len(self.accessors) - 1
        return self.accessor_map[index]

    def add_accessor(self, values, kind, component=5126):
        if not values or any(len(row) != WIDTHS[kind] for row in values):
            raise ValueError('empty or malformed generated accessor')
        if any(not math.isfinite(x) for row in values for x in row):
            raise ValueError('nonfinite generated accessor')
        pack = struct.Struct('<' + COMPONENTS[component][0] * WIDTHS[kind])
        raw = b''.join(pack.pack(*row) for row in values)
        accessor = {'bufferView': self.add_view(raw), 'componentType': component, 'count': len(values), 'type': kind}
        if kind == 'VEC3':
            accessor['min'] = [min(v[i] for v in values) for i in range(3)]
            accessor['max'] = [max(v[i] for v in values) for i in range(3)]
        self.accessors.append(accessor)
        return len(self.accessors) - 1

    def encode(self, doc):
        doc['accessors'], doc['bufferViews'] = self.accessors, self.views
        doc['buffers'] = [{'byteLength': len(self.chunks)}]
        raw = json.dumps(doc, separators=(',', ':'), ensure_ascii=True).encode('utf-8')
        raw += b' ' * (-len(raw) % 4)
        binary = bytes(self.chunks) + b'\0' * (-len(self.chunks) % 4)
        return (struct.pack('<III', 0x46546C67, 2, 28 + len(raw) + len(binary))
                + struct.pack('<II', len(raw), 0x4E4F534A) + raw
                + struct.pack('<II', len(binary), 0x004E4942) + binary)


def decimate(doc, binary, primitive, ratio):
    import bpy
    attrs = primitive['attributes']
    supported = {'POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0'}
    if set(attrs) - supported or primitive.get('targets') or primitive.get('extensions'):
        raise ValueError('unknown geometry contract; review instead of dropping attributes')
    values = {key: accessor_values(doc, binary, index) for key, index in attrs.items()}
    source_values = values
    indices = ([row[0] for row in accessor_values(doc, binary, primitive['indices'])]
               if 'indices' in primitive else list(range(len(values['POSITION']))))
    # glTF duplicates a vertex at every UV seam. Treating those copies as
    # disconnected geometry makes Collapse delete UV islands (holes/shards).
    # Reconnect ONLY exact matches of position, normal, skin and color; keep UV
    # on Blender's corner layer, then split it back into glTF vertices below.
    keys = sorted(set(values) - {'TEXCOORD_0'})
    unique, remap, representatives = {}, [], []
    for vertex in range(len(values['POSITION'])):
        key = tuple(values[k][vertex] for k in keys)
        if key not in unique:
            unique[key] = len(representatives)
            representatives.append(vertex)
        remap.append(unique[key])
    values = {key: [rows[i] for i in representatives] for key, rows in values.items()}
    positions = values['POSITION']
    mesh = bpy.data.meshes.new('LOD_primitive')
    obj = bpy.data.objects.new('LOD_primitive', mesh)
    bpy.context.scene.collection.objects.link(obj)
    try:
        mesh.from_pydata(positions, [], [[remap[j] for j in indices[i:i + 3]] for i in range(0, len(indices), 3)])
        if 'TEXCOORD_0' in values:
            uv = mesh.uv_layers.new(name='LOD_UV')
            uv.data.foreach_set('uv', [x for i in indices for x in source_values['TEXCOORD_0'][i]])
        # Do not join across a normal, color or skin discontinuity, unwrap,
        # recalculate original normals, or merge independently animated meshes.
        for key in ('NORMAL',):
            if key in values:
                attr = mesh.attributes.new('lod_' + key, 'FLOAT_VECTOR', 'POINT')
                attr.data.foreach_set('vector', [x for row in values[key] for x in (tuple(row) + (0,) * (3 - len(row)))])
        if 'COLOR_0' in values:
            # Staff uses linear vertex colors on hair/iris as well as its face.
            # Keep all channels and let collapse interpolate them with position.
            attr = mesh.attributes.new('lod_COLOR_0', 'FLOAT_COLOR', 'POINT')
            attr.data.foreach_set('color', [x for row in values['COLOR_0']
                                           for x in (tuple(row) + (1,) * (4 - len(row)))])
        if ('JOINTS_0' in values) != ('WEIGHTS_0' in values):
            raise ValueError('incomplete skin attributes')
        if 'JOINTS_0' in values:
            maximum = max(j for row in values['JOINTS_0'] for j in row)
            for i in range(maximum + 1):
                obj.vertex_groups.new(name='joint_' + str(i))
            for vertex, (joints, weights) in enumerate(zip(values['JOINTS_0'], values['WEIGHTS_0'])):
                for joint, weight in zip(joints, weights):
                    if weight > 0:
                        obj.vertex_groups[joint].add([vertex], weight, 'REPLACE')
        modifier = obj.modifiers.new('LOD1_Collapse', 'DECIMATE')
        modifier.decimate_type, modifier.ratio = 'COLLAPSE', ratio
        modifier.use_collapse_triangulate = True
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj], selected_editable_objects=[obj]):
            if bpy.ops.object.modifier_apply(modifier=modifier.name) != {'FINISHED'}:
                raise RuntimeError('Decimate failed')
        mesh = obj.data  # Applying a modifier may replace the mesh datablock.
        mesh.calc_loop_triangles()
        result = {'POSITION': [tuple(v.co) for v in mesh.vertices]}
        for key in ('NORMAL',):
            if key not in values:
                continue
            attribute = mesh.attributes.get('lod_' + key)
            if attribute is None or len(attribute.data) != len(mesh.vertices):
                raise RuntimeError('Decimate lost vertex data: ' + key)
            result[key] = []
            for item in attribute.data:
                vector = item.vector.copy()
                if key == 'NORMAL':
                    if vector.length < 1e-8:
                        raise ValueError('degenerate interpolated normal')
                    vector.normalize()
                result[key].append(tuple(vector)[:len(values[key][0])])
        if 'COLOR_0' in values:
            attribute = mesh.attributes.get('lod_COLOR_0')
            if attribute is None or len(attribute.data) != len(mesh.vertices):
                raise RuntimeError('Decimate lost vertex colors')
            result['COLOR_0'] = [tuple(item.color)[:len(values['COLOR_0'][0])] for item in attribute.data]
        max_dropped = 0
        if 'JOINTS_0' in values:
            result['JOINTS_0'], result['WEIGHTS_0'] = [], []
            for vertex in mesh.vertices:
                groups = sorted(((g.group, g.weight) for g in vertex.groups if g.weight > 0), key=lambda pair: (-pair[1], pair[0]))
                kept, dropped = groups[:4], sum(weight for _, weight in groups[4:])
                max_dropped = max(max_dropped, dropped)
                total = sum(weight for _, weight in kept)
                if total < 1e-8:
                    raise ValueError('Decimate produced an unweighted vertex')
                if dropped > MAX_DROPPED_SKIN_WEIGHT:
                    raise SkinInfluenceLoss(dropped)
                result['JOINTS_0'].append(tuple([joint for joint, _ in kept] + [0] * (4 - len(kept))))
                result['WEIGHTS_0'].append(tuple([weight / total for _, weight in kept] + [0.] * (4 - len(kept))))
        triangles = [tuple(t.vertices) for t in mesh.loop_triangles]
        if not triangles or len(triangles) >= len(indices) // 3:
            return None
        if 'TEXCOORD_0' in values:
            uv = mesh.uv_layers.get('LOD_UV')
            if uv is None:
                raise RuntimeError('Decimate lost corner UVs')
            split, split_attrs, triangles = {}, {key: [] for key in result}, []
            split_attrs['TEXCOORD_0'] = []
            for triangle in mesh.loop_triangles:
                corners = []
                for loop_index in triangle.loops:
                    vertex = mesh.loops[loop_index].vertex_index
                    coord = tuple(uv.data[loop_index].uv)
                    key = (vertex, coord)
                    if key not in split:
                        split[key] = len(split)
                        for attribute, rows in result.items():
                            split_attrs[attribute].append(rows[vertex])
                        split_attrs['TEXCOORD_0'].append(coord)
                    corners.append(split[key])
                triangles.append(tuple(corners))
            result = split_attrs
        return result, triangles, max_dropped
    finally:
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def safe_decimate(doc, binary, primitive, planned):
    """Retry each ratio from the original, never from a degraded intermediate.

    Collapse can mix more than four joints at a weight boundary. Raising the
    ratio reduces these collapses; if no attempted ratio passes, preserve the
    original primitive byte-for-byte. Do not relax the 2% truncation guard or
    catch other geometry/attribute errors as if they were quality fallbacks.
    """
    attempts = []
    ratios = [planned] + [v for v in (.25, .5, .75, .9, .98) if planned < v < 1]
    if planned < 1:
        for ratio in ratios:
            try:
                result = decimate(doc, binary, primitive, ratio)
            except SkinInfluenceLoss as error:
                attempts.append({'ratio': ratio, 'accepted': False,
                                 'reason': 'skin-influence-loss', 'droppedWeight': error.loss})
                continue
            attempts.append({'ratio': ratio, 'accepted': result is not None})
            if result is not None:
                return result, ratio, attempts
    return None, 1.0, attempts


def build_one(id, source, expected_hash, destination):
    doc, binary, original = read_glb(source)
    if sha(original) != expected_hash:
        raise ValueError('source revision changed: ' + str(source))
    out, writer, changes = copy.deepcopy(doc), Repack(doc, binary), []
    for index, mesh in enumerate(doc['meshes']):
        names = [n.get('name', '') for n in doc['nodes'] if n.get('mesh') == index]
        if len(names) != 1:
            raise ValueError('recipe expects one named instance per source mesh')
        name = names[0]
        for number, primitive in enumerate(mesh['primitives']):
            before = primitive_triangles(doc, primitive)
            ratio = reduction(id, name, before)
            protection_reason = None
            if id == 'zuri' and name.startswith('Zuri_Glasses_'):
                protection_reason = 'visual-qa-glasses-overlap'
            if id == 'wangjai' and (name in ('wangjai-shell', 'wangjai-visor') or name.startswith('wangjai-ear-')):
                protection_reason = 'visual-qa-visor-ear-surface-overlap'
            visual_protected = protection_reason is not None
            if visual_protected:
                simplified, applied, attempts = None, 1., []
            else:
                simplified, applied, attempts = safe_decimate(doc, binary, primitive, ratio)
            target = out['meshes'][index]['primitives'][number]
            if simplified is None:
                target['attributes'] = {key: writer.old_accessor(value) for key, value in primitive['attributes'].items()}
                if 'indices' in primitive:
                    target['indices'] = writer.old_accessor(primitive['indices'])
                if 'targets' in primitive:
                    target['targets'] = [{key: writer.old_accessor(value) for key, value in item.items()} for item in primitive['targets']]
                after, loss = before, 0
            else:
                attrs, triangles, loss = simplified
                target['attributes'] = {key: writer.add_accessor(values, 'VEC' + str(len(values[0])), 5123 if key == 'JOINTS_0' else 5126)
                                        for key, values in attrs.items()}
                component = 5123 if len(attrs['POSITION']) <= 65536 else 5125
                target['indices'] = writer.add_accessor([(i,) for triangle in triangles for i in triangle], 'SCALAR', component)
                after = len(triangles)
            retained = after > math.ceil(before * ratio)
            change = {'node': name, 'primitive': number, 'before': before, 'after': after,
                      'ratioRequested': ratio, 'ratioApplied': applied,
                      'retainedMoreThanPlanned': retained,
                      'retentionReason': (protection_reason if visual_protected else
                                          'skin-influence-guard' if applied > ratio else
                                          'seam-topology-collapse-limit') if retained else None,
                      'maxDroppedSkinWeight': loss, 'attempts': attempts}
            changes.append(change)
            if retained:
                print('@@RETAINED_GEOMETRY@@' + json.dumps({'id': id, **change}), flush=True)
    for skin in out.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = writer.old_accessor(skin['inverseBindMatrices'])
    for animation in out.get('animations', []):
        for sampler in animation['samplers']:
            for key in ('input', 'output'):
                sampler[key] = writer.old_accessor(sampler[key])
    for image in out.get('images', []):
        image['bufferView'] = writer.old_view(image['bufferView'])
    data = writer.encode(out)
    # Exclusive creation prevents overwriting any existing GLB, including a LOD.
    with destination.open('xb') as handle:
        handle.write(data)
    reread, new_binary, output = read_glb(destination)
    verify_preserved(doc, binary, reread, new_binary)
    if source.read_bytes() != original:
        raise RuntimeError('source changed during generation')
    return {'id': id, 'file': destination.name, **stats(reread, new_binary, output),
            'source': str(source.relative_to(ROOT)).replace('\\', '/'),
            'sourceSha256': expected_hash, 'before': stats(doc, binary, original),
            'changes': changes}


def verify_preserved(before, old_binary, after, new_binary):
    for key in ('nodes', 'scenes', 'scene', 'materials', 'textures', 'samplers', 'extensionsUsed', 'extensionsRequired'):
        if before.get(key) != after.get(key):
            raise ValueError('preservation failure: ' + key)
    old_skins, new_skins = copy.deepcopy(before.get('skins', [])), copy.deepcopy(after.get('skins', []))
    if len(old_skins) != len(new_skins):
        raise ValueError('skin count changed')
    for a, b in zip(old_skins, new_skins):
        if 'inverseBindMatrices' in a:
            if accessor_values(before, old_binary, a.pop('inverseBindMatrices')) != accessor_values(after, new_binary, b.pop('inverseBindMatrices')):
                raise ValueError('bind matrix changed')
        if a != b:
            raise ValueError('skeleton changed')
    aa, bb = copy.deepcopy(before.get('animations', [])), copy.deepcopy(after.get('animations', []))
    if len(aa) != len(bb):
        raise ValueError('clip count changed')
    for a, b in zip(aa, bb):
        if len(a['samplers']) != len(b['samplers']):
            raise ValueError('animation sampler count changed')
        for sa, sb in zip(a['samplers'], b['samplers']):
            for key in ('input', 'output'):
                if accessor_values(before, old_binary, sa.pop(key)) != accessor_values(after, new_binary, sb.pop(key)):
                    raise ValueError('animation samples changed')
        if a != b:
            raise ValueError('animation channels, names or interpolation changed')
    if len(before.get('images', [])) != len(after.get('images', [])):
        raise ValueError('image count changed')
    for a, b in zip(before.get('images', []), after.get('images', [])):
        if view_bytes(before, old_binary, a['bufferView']) != view_bytes(after, new_binary, b['bufferView']):
            raise ValueError('texture changed')


def run(output=None, inspect=False):
    inventory = []
    for id, (file, expected, _, _) in SOURCES.items():
        doc, binary, data = read_glb(ASSETS / file)
        if sha(data) != expected:
            raise ValueError('source hash mismatch: ' + file)
        inventory.append({'id': id, 'file': file, **stats(doc, binary, data)})
    if inspect:
        return {'mode': 'read-only-inventory', 'assets': inventory}
    import bpy
    if not bpy.app.background or '--factory-startup' not in sys.argv:
        raise RuntimeError('requires separate background Blender with --factory-startup')
    if bpy.app.version[:2] != (5, 2):
        raise RuntimeError('recipe requires Blender 5.2; review other versions separately')
    destination = Path(output or ASSETS / 'lod').resolve()
    protected = ('handoff', '.git', '.codex', '.agents', 'node_modules')
    if (not destination.is_relative_to(ROOT) or destination == ROOT
            or any(destination.is_relative_to(ROOT / name) for name in protected)):
        raise ValueError('output must be a new directory inside this repository, outside protected directories')
    if destination.exists() and (not destination.is_dir() or any(destination.iterdir())):
        raise FileExistsError('output directory is not empty; choose a fresh directory, never overwrite')
    # The lead qualified a 50 GiB C: operational floor and <=1 GiB peak writes.
    # Recheck in the process itself, in addition to the launch-time receipt.
    free = shutil.disk_usage(ROOT).free
    if free - 1024 ** 3 < 50 * 1024 ** 3:
        raise RuntimeError('C: projected free space is below the qualified 50 GiB floor')
    destination.mkdir(parents=True, exist_ok=True)
    assets = []
    for id, (file, expected, triangles, bytes_limit) in SOURCES.items():
        result = build_one(id, ASSETS / file, expected, destination / (id + '-lod1.glb'))
        result.update(lod=1, artApproved=False, targets={'triangles': triangles, 'bytes': bytes_limit})
        result['targetMet'] = result['triangles'] <= triangles and result['bytes'] <= bytes_limit
        result['limitations'] = ['Candidate requires multi-angle, animation and browser review.',
                                'Faces, contact soles and original textures are protected; budgets are guidance.',
                                'Physical-device performance is unmeasured; art remains unapproved.']
        assets.append(result)
        print('@@CHARACTER_LOD@@' + json.dumps({key: result[key] for key in ('id', 'triangles', 'bytes', 'sha256', 'targetMet')}), flush=True)
    report = {'schemaVersion': 'brand-character-lods/v1', 'quality': 'candidate-unreviewed',
              'units': 'metres', 'blender': bpy.app.version_string,
              'blenderBuild': bpy.app.build_hash.decode(),
              'pipelineSha256': sha(Path(__file__).read_bytes()),
              'skinInfluenceGuard': MAX_DROPPED_SKIN_WEIGHT,
              'sourceManifest': 'web/assets/models/characters/manifest.json',
              'artApproved': False, 'physicalDevicePerformance': 'unmeasured', 'assets': assets}
    with (destination / 'manifest.json').open('x', encoding='utf-8', newline='\n') as handle:
        handle.write(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', help='new repository-local output directory; defaults to characters/lod')
    parser.add_argument('--inspect', action='store_true', help='read and hash originals only; no Blender or writes')
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)
    print('@@LOD_REPORT@@' + json.dumps(run(**vars(args))))
