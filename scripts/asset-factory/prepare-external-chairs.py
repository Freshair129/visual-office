"""Convert selected Kenney Furniture Kit chairs into measured custom-GLB fixtures.

Run inside Blender 5.2+ in a separate background process, for example:
  blender.exe -b --factory-startup --python-exit-code 1 \
    -P scripts/asset-factory/prepare-external-chairs.py -- \
    --source-root .local/reference-inputs/kenney-oga/Models \
    --out-root tests/fixtures/external-chairs

The mesh is transformed only for axis conversion, uniform metric scale, and the
ground-centered X/Z origin. The source OBJ and MTL files remain unchanged.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import struct
import sys
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


SOURCE_URL = "https://opengameart.org/content/furniture-kit"
LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/"
AUTHOR = "Kenney"
TITLE = "Furniture Kit"
APPROACH_MARGIN_M = 0.60
SEAT_HEIGHT_RANGE_M = (0.45, 0.60)
TARGET_HEIGHT_RANGE_M = (0.95, 1.15)

ASSETS = [
    {
        "id": "kenney-chair-four-leg",
        "name": "Kenney Four-leg Chair",
        "obj": "chair.obj",
        "height": 1.00,
        "backrest_source_z": "positive",
        "forward_heading": math.pi,
    },
    {
        "id": "kenney-chair-rounded-back",
        "name": "Kenney Rounded-back Chair",
        "obj": "chairRounded.obj",
        "height": 1.05,
        "backrest_source_z": "positive",
        "forward_heading": math.pi,
    },
    {
        "id": "kenney-chair-swivel",
        "name": "Kenney Swivel Desk Chair",
        "obj": "chairDesk.obj",
        "height": 1.18,
        "backrest_source_z": "positive",
        "forward_heading": math.pi,
    },
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_relative(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def clear_scene() -> None:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)
    bpy.context.view_layer.update()


def import_obj(source_path: Path):
    before = set(bpy.data.objects)
    result = bpy.ops.wm.obj_import(
        filepath=str(source_path),
        forward_axis="NEGATIVE_Z",
        up_axis="Y",
        global_scale=1.0,
        use_split_objects=True,
        use_split_groups=False,
        validate_meshes=True,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"OBJ import did not finish: {source_path.name}")
    objects = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if len(objects) != 1:
        raise RuntimeError(f"Expected one mesh object in {source_path.name}; got {len(objects)}")
    return objects[0]


def source_geometry(obj):
    """Return original Y-up OBJ bounds and a weighted seat-surface centroid."""
    vertices = [vertex.co.copy() for vertex in obj.data.vertices]
    if not vertices:
        raise RuntimeError(f"No vertices in source object {obj.name}")
    lo = [min(point[axis] for point in vertices) for axis in range(3)]
    hi = [max(point[axis] for point in vertices) for axis in range(3)]
    size = [hi[axis] - lo[axis] for axis in range(3)]
    if min(size) <= 1e-6:
        raise RuntimeError(f"Degenerate source dimensions in {obj.name}: {size}")

    # Kenney OBJ is Y-up. Among upward-facing planes in the ordinary seat-height
    # band, choose the plane with the largest area. That is the visible seating
    # surface on the wood chairs and the upholstered swivel chair.
    groups = defaultdict(list)
    for polygon in obj.data.polygons:
        if polygon.normal.y <= 0.96 or polygon.area <= 0.02:
            continue
        points = [obj.data.vertices[index].co for index in polygon.vertices]
        center = [sum(point[axis] for point in points) / len(points) for axis in range(3)]
        if not (0.30 <= center[1] / size[1] <= 0.60):
            continue
        groups[round(center[1], 3)].append((polygon.area, center))
    candidates = []
    for y, faces in groups.items():
        total_area = sum(area for area, _ in faces)
        center = [sum(area * point[axis] for area, point in faces) / total_area for axis in range(3)]
        candidates.append((total_area, y, center))
    if not candidates:
        raise RuntimeError(f"Could not measure a seat surface in {obj.name}")
    area, seat_y, seat_center = max(candidates, key=lambda candidate: candidate[0])
    return {
        "boundsMin": lo,
        "boundsMax": hi,
        "sourceSize": size,
        "seatSource": {"center": seat_center, "planeY": seat_y, "area": area},
    }


def normalize_to_metric_gltf_axes(obj, source, target_height: float) -> dict:
    """Bake Y-up source coordinates into Blender Z-up metric coordinates.

    Blender's glTF exporter maps Blender (x, y, z) to glTF (x, z, -y).
    This conversion therefore preserves the source OBJ's Y-up coordinates in
    glTF, subtracts the X/Z center and bottom, and applies uniform scale.
    """
    lo = source["boundsMin"]
    hi = source["boundsMax"]
    size = source["sourceSize"]
    center_x = (lo[0] + hi[0]) / 2.0
    center_z = (lo[2] + hi[2]) / 2.0
    bottom_y = lo[1]
    scale = target_height / size[1]
    transform = Matrix((
        (scale, 0.0, 0.0, -center_x * scale),
        (0.0, 0.0, -scale, center_z * scale),
        (0.0, scale, 0.0, -bottom_y * scale),
        (0.0, 0.0, 0.0, 1.0),
    ))
    obj.data.transform(transform)
    uv_count = len(obj.data.uv_layers)
    # The source has no image textures; its UVs are out of range/zero-area and
    # are unused by its flat-color MTL materials. Keep the original OBJ intact.
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.matrix_world = Matrix.Identity(4)
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)
    obj.name = "ExternalChair"
    obj.data.name = "ExternalChairMesh"
    material_notes = []
    for material in obj.data.materials:
        if material:
            material.name = material.name.replace(".001", "").replace(".002", "")
            if material.node_tree is not None:
                principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
                if principled:
                    # The unsupported MTL Ks value would otherwise become
                    # KHR_materials_specular. The browser loader accepts core
                    # metallic/roughness PBR; use its standard dielectric default.
                    specular = principled.inputs.get("Specular IOR Level")
                    tint = principled.inputs.get("Specular Tint")
                    if specular:
                        specular.default_value = 0.5
                    if tint:
                        tint.default_value = (1.0, 1.0, 1.0, 1.0)
                    material_notes.append({
                        "material": material.name,
                        "unsupportedSpecularNormalizedToCoreDefault": bool(specular),
                        "baseColorPreserved": True,
                    })
    bpy.context.view_layer.update()
    return {"uvLayersRemoved": uv_count, "materialCorePbr": material_notes}


def glb_summary(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20:
        raise RuntimeError(f"GLB is too small: {path}")
    magic, version, total_length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or total_length != len(data):
        raise RuntimeError(f"Invalid GLB header: {path}")
    offset = 12
    document = None
    binary_chunks = 0
    while offset < len(data):
        if offset + 8 > len(data):
            raise RuntimeError("Truncated GLB chunk header")
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        if len(chunk) != length or length % 4:
            raise RuntimeError("Malformed GLB chunk")
        if kind == 0x4E4F534A and document is None:
            document = json.loads(chunk.decode("utf-8").rstrip(" \t\r\n\x00"))
        elif kind == 0x004E4942:
            binary_chunks += 1
        else:
            raise RuntimeError(f"Unexpected GLB chunk type {kind:#x}")
        offset += length
    if not document or document.get("asset", {}).get("version") != "2.0":
        raise RuntimeError("Missing glTF 2.0 document")
    if binary_chunks != 1 or len(document.get("buffers", [])) != 1:
        raise RuntimeError("Expected one embedded geometry buffer")
    if document["buffers"][0].get("uri") or any(item.get("uri") for item in document.get("images", [])):
        raise RuntimeError("GLB references external resources")
    if document.get("animations") or document.get("skins") or document.get("cameras"):
        raise RuntimeError("Expected a static unrigged prop")
    if any(extension.lower().find("draco") >= 0 or "meshopt" in extension.lower()
           for extension in document.get("extensionsUsed", [])):
        raise RuntimeError("Compressed glTF extensions are not supported by the custom asset loader")
    primitive_count = sum(len(mesh.get("primitives", [])) for mesh in document.get("meshes", []))
    triangle_count = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            accessor_id = primitive.get("indices", primitive.get("attributes", {}).get("POSITION"))
            accessor = document.get("accessors", [])[accessor_id]
            count = accessor.get("count", 0)
            if (primitive.get("mode", 4) != 4) or count % 3:
                raise RuntimeError("Expected indexed/static triangle geometry")
            triangle_count += count // 3
    if triangle_count <= 0 or triangle_count > 200_000:
        raise RuntimeError(f"Unexpected triangle count: {triangle_count}")
    return {
        "glbBytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "primitives": primitive_count,
        "triangles": triangle_count,
        "animations": len(document.get("animations", [])),
        "skins": len(document.get("skins", [])),
        "extensionsUsed": document.get("extensionsUsed", []),
    }


def load_blender_qa_tools():
    qa_root = Path(r"C:\Users\suanr\.codex\skills\blender-asset-qa\scripts")
    sys.path.insert(0, str(qa_root))
    import qa_check
    import review_shots
    return qa_check, review_shots


def bounds_world(objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    if not points:
        raise RuntimeError("No geometry after GLB round-trip")
    lo = [min(point[axis] for point in points) for axis in range(3)]
    hi = [max(point[axis] for point in points) for axis in range(3)]
    size = [hi[axis] - lo[axis] for axis in range(3)]
    return lo, hi, size


def run(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", required=True, help="Extracted Kenney Models directory")
    parser.add_argument("--out-root", required=True, help="Fixture output directory")
    parser.add_argument("--archive", default="", help="Original source archive; defaults beside extracted folder")
    parser.add_argument("--source-url", default=SOURCE_URL)
    parser.add_argument("--author", default=AUTHOR)
    parser.add_argument("--license-url", default=LICENSE_URL)
    args = parser.parse_args(argv)

    source_root = Path(args.source_root).resolve()
    out_root = Path(args.out_root).resolve()
    license_source = source_root.parent / "License.txt"
    archive_path = Path(args.archive).resolve() if args.archive else source_root.parent.parent / "kenney_oga.zip"
    if not source_root.is_dir():
        raise FileNotFoundError(f"Source directory missing: {source_root}")
    if not license_source.is_file():
        raise FileNotFoundError(f"Original license missing: {license_source}")

    source_copy_root = out_root / "source"
    source_models_copy = source_copy_root / "Models"
    preview_root = out_root / "previews"
    qa_root = out_root / "qa"
    for folder in (source_models_copy, preview_root, qa_root):
        folder.mkdir(parents=True, exist_ok=True)

    source_files = {}
    for spec in ASSETS:
        obj_file = spec["obj"]
        mtl_file = Path(obj_file).with_suffix(".mtl").name
        for filename in (obj_file, mtl_file):
            source_file = source_root / filename
            if not source_file.is_file():
                raise FileNotFoundError(f"Source file missing: {source_file}")
            destination = source_models_copy / filename
            shutil.copyfile(source_file, destination)
            source_files[filename] = {
                "fixturePath": safe_relative(destination, out_root),
                "sha256": sha256(source_file),
                "bytes": source_file.stat().st_size,
            }
    license_copy = source_copy_root / "License.txt"
    shutil.copyfile(license_source, license_copy)
    license_info = {
        "id": "CC0-1.0",
        "name": "Creative Commons Zero 1.0 Universal",
        "url": args.license_url,
        "file": safe_relative(license_copy, out_root),
        "sha256": sha256(license_source),
    }
    archive_info = {
        "fileName": archive_path.name,
        "pathAtConversion": str(archive_path),
        "sha256": sha256(archive_path) if archive_path.is_file() else None,
        "includedInFixture": False,
    }
    actual_command = (
        f'"{bpy.app.binary_path}" -b --factory-startup --python-exit-code 1 '
        f'-P "{Path(__file__).resolve()}" -- --source-root "{source_root}" '
        f'--out-root "{out_root}"'
    )

    qa_check, review_shots = load_blender_qa_tools()
    generated = []
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0

    for spec in ASSETS:
        source_path = source_root / spec["obj"]
        clear_scene()
        obj = import_obj(source_path)
        source = source_geometry(obj)
        source_size = source["sourceSize"]
        target_height = float(spec["height"])
        if target_height < TARGET_HEIGHT_RANGE_M[0] or target_height > 1.20:
            raise ValueError(f"Target height {target_height} is outside the requested range plus small office-chair tolerance")
        if not (0.45 <= source["seatSource"]["planeY"] / source_size[1] * target_height <= 0.60):
            raise ValueError(f"Measured seat height falls outside 0.45-0.60m for {spec['id']}")

        scale = target_height / source_size[1]
        source_min, source_max = source["boundsMin"], source["boundsMax"]
        source_center_x = (source_min[0] + source_max[0]) / 2.0
        source_center_z = (source_min[2] + source_max[2]) / 2.0
        conversion_details = normalize_to_metric_gltf_axes(obj, source, target_height)

        output_glb = out_root / f"{spec['id']}.glb"
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        export_result = bpy.ops.export_scene.gltf(
            filepath=str(output_glb),
            export_format="GLB",
            use_selection=True,
            export_yup=True,
            export_apply=True,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
            export_skins=False,
            export_morph=False,
            export_materials="EXPORT",
        )
        if "FINISHED" not in export_result or not output_glb.is_file() or output_glb.stat().st_size == 0:
            raise RuntimeError(f"GLB export did not produce a non-empty file: {output_glb}")
        exported = glb_summary(output_glb)
        if exported["extensionsUsed"]:
            raise RuntimeError(f"Generated GLB has extensions unsupported by the custom loader: {exported['extensionsUsed']}")

        clear_scene()
        before = set(bpy.data.objects)
        import_result = bpy.ops.import_scene.gltf(filepath=str(output_glb))
        if "FINISHED" not in import_result:
            raise RuntimeError(f"Could not round-trip generated GLB: {output_glb}")
        imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
        if not imported:
            raise RuntimeError(f"No mesh imported from generated GLB: {output_glb}")
        roundtrip = bounds_world(imported)
        lo, hi, blender_size = roundtrip
        gltf_size = [blender_size[0], blender_size[2], blender_size[1]]
        # Round-trip objects are Blender Z-up: glTF horizontal Z is -Blender Y.
        gltf_center = [(lo[0] + hi[0]) / 2.0, -(lo[1] + hi[1]) / 2.0]
        ground = lo[2]
        if any(abs(actual - expected) > 1e-4 for actual, expected in zip(gltf_size, (source_size[0] * scale, target_height, source_size[2] * scale))):
            raise RuntimeError(f"Round-trip dimensions differ from uniform scale for {spec['id']}: {gltf_size}")
        if abs(gltf_center[0]) > 1e-4 or abs(gltf_center[1]) > 1e-4 or abs(ground) > 1e-4:
            raise RuntimeError(f"GLB origin is not centered and grounded for {spec['id']}: center={gltf_center}, ground={ground}")

        seat_source = source["seatSource"]["center"]
        seat = [
            (seat_source[0] - source_center_x) * scale,
            (seat_source[2] - source_center_z) * scale,
        ]
        seat_height = (seat_source[1] - source_min[1]) * scale
        depth = gltf_size[2]
        approach_z = -(depth / 2.0 + APPROACH_MARGIN_M)
        interaction = {
            "mode": "seat",
            "approach": [0.0, approach_z],
            "seat": seat,
            "height": seat_height,
            "heading": float(spec["forward_heading"]),
        }
        descriptor_size = gltf_size
        if abs(interaction["seat"][0]) > descriptor_size[0] / 2.0 + 1e-6 or abs(interaction["seat"][1]) > descriptor_size[2] / 2.0 + 1e-6:
            raise RuntimeError(f"Measured seat anchor lies outside measured model bounds for {spec['id']}")

        qa = qa_check.run(objects=[obj.name for obj in imported], profile="game", uv=False)
        qa["uvCheckSkipped"] = "GLB intentionally has no UVs or image textures; source OBJ/MTL are preserved separately."
        qa_path = qa_root / f"{spec['id']}.json"
        qa_path.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        material_preview = preview_root / f"{spec['id']}-material.png"
        wire_preview = preview_root / f"{spec['id']}-wire.png"
        review_material = review_shots.run(
            objects=[obj.name for obj in imported],
            out=str(material_preview),
            views=["front", "right", "back", "left", "three_quarter", "top"],
            mode="material",
            res=384,
        )
        review_wire = review_shots.run(
            objects=[obj.name for obj in imported],
            out=str(wire_preview),
            views=["front", "right", "three_quarter", "top"],
            mode="wire",
            res=384,
        )

        materials = []
        for item in imported:
            for material in item.data.materials:
                if material and material.name not in materials:
                    materials.append(material.name)
        output = {
            "id": spec["id"],
            "name": spec["name"],
            "category": "chair",
            "file": output_glb.name,
            "height": target_height,
            "interaction": interaction,
            "measured": {
                "gltfSize": gltf_size,
                "gltfGround": ground,
                "gltfXZCenter": gltf_center,
                "seatSurfaceSourceY": source["seatSource"]["planeY"],
                "seatSurfaceAreaSourceUnits": source["seatSource"]["area"],
                "seatSourceCenter": seat_source,
                "uniformScale": scale,
                "materials": materials,
                "conversionDetails": conversion_details,
                "qaPass": qa.get("pass"),
                "qaErrors": qa.get("errors", []),
                "qaWarnings": qa.get("warnings", []),
                "qaObjects": qa.get("objects", {}),
            },
            "previews": {
                "material": safe_relative(material_preview, out_root),
                "wire": safe_relative(wire_preview, out_root),
            },
            "qaFile": safe_relative(qa_path, out_root),
            "provenance": {
                "author": args.author,
                "title": TITLE,
                "sourceUrl": args.source_url,
                "sourceObj": safe_relative(source_path, source_root),
                "sourceObjSha256": sha256(source_path),
                "sourceMtl": safe_relative(source_root / source_path.with_suffix(".mtl").name, source_root),
                "sourceMtlSha256": sha256(source_root / source_path.with_suffix(".mtl").name),
                "sourceArchive": archive_info,
                "licenseFile": safe_relative(license_copy, out_root),
                "licenseSha256": license_info["sha256"],
                "conversion": {
                    "blender": bpy.app.version_string,
                    "command": actual_command,
                    "sourceAxes": "OBJ Y-up; Blender import up_axis=Y, forward_axis=NEGATIVE_Z",
                    "outputAxes": "glTF 2.0 Y-up",
                    "normalization": "uniform scale to target height; X/Z centered; bottom at Y=0; no mesh remodeling",
                    "geometry": "source topology and vertices preserved; only source-axis conversion, uniform metric scale and centered/grounded origin applied",
                    "conversionDetails": conversion_details,
                    "uvPolicy": "dropped unused source UVs because the MTL inputs are flat-color only and imported UVs are malformed",
                    "commandTemplate": "blender.exe -b --factory-startup --python-exit-code 1 -P scripts/asset-factory/prepare-external-chairs.py -- --source-root .local/reference-inputs/kenney-oga/Models --out-root tests/fixtures/external-chairs",
                },
                "glb": exported,
            },
        }
        generated.append(output)
        print(json.dumps({"fixture": spec["id"], "dimensions": gltf_size, "interaction": interaction,
                          "sha256": exported["sha256"], "qaPass": qa.get("pass"),
                          "errors": qa.get("errors", []), "warnings": qa.get("warnings", [])}))

    manifest = {
        "schemaVersion": 1,
        "purpose": "External custom GLB lifecycle regression fixtures; not a runtime or default asset catalog.",
        "source": {
            "title": TITLE,
            "author": args.author,
            "url": args.source_url,
            "archive": archive_info,
            "sourceFiles": source_files,
        },
        "license": license_info,
        "conversion": {
            "blender": bpy.app.version_string,
            "command": actual_command,
            "commandTemplate": "blender.exe -b --factory-startup --python-exit-code 1 -P scripts/asset-factory/prepare-external-chairs.py -- --source-root .local/reference-inputs/kenney-oga/Models --out-root tests/fixtures/external-chairs",
            "sourceAxes": "OBJ Y-up; Blender import up_axis=Y, forward_axis=NEGATIVE_Z",
            "outputAxes": "glTF 2.0 Y-up",
            "normalization": "uniform scale to target height; X/Z centered; bottom at Y=0; no mesh remodeling",
            "geometry": "source topology and vertices preserved; only source-axis conversion, uniform metric scale and centered/grounded origin applied",
            "uvPolicy": "omit unused malformed source UV maps; MTL sources contain flat colors and no image textures",
            "approachMarginM": APPROACH_MARGIN_M,
            "seatHeightRangeM": list(SEAT_HEIGHT_RANGE_M),
            "preferredModelHeightRangeM": list(TARGET_HEIGHT_RANGE_M),
        },
        "fixtures": generated,
    }
    manifest_path = out_root / "fixtures.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(manifest_path), "fixtures": len(generated), "blender": bpy.app.version_string}))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    run(argv)
