#!/usr/bin/env python3
"""
🔧 벨튀 대작전 — 3D 에셋 최적화 스크립트 (Blender Python)

사용법:
  blender --background --python optimize-assets.py
  blender --background --python optimize-assets.py -- --single choroki_idle
  blender --background --python optimize-assets.py -- --max-polys 10000

/assets/raw/3d/*.glb → 최적화 → /assets/ready/3d/*.glb
"""

import bpy
import json
import os
import sys
import datetime
from pathlib import Path

# ── 경로 설정 ──────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
RAW_DIR = ROOT_DIR / "assets" / "raw" / "3d"
READY_DIR = ROOT_DIR / "assets" / "ready" / "3d"
LOG_DIR = ROOT_DIR / "logs"
MANIFEST_PATH = ROOT_DIR / "assets" / "3d" / "asset_manifest.json"
PROMPTS_PATH = SCRIPT_DIR / "prompts" / "3d_assets.json"

# ── CLI 인수 파싱 (Blender는 -- 이후의 인수를 사용) ──
argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = []

SINGLE_ID = None
MAX_POLYS = 15000
MAX_TEXTURE = 1024

for i, arg in enumerate(argv):
    if arg == "--single" and i + 1 < len(argv):
        SINGLE_ID = argv[i + 1]
    if arg == "--max-polys" and i + 1 < len(argv):
        MAX_POLYS = int(argv[i + 1])
    if arg == "--max-texture" and i + 1 < len(argv):
        MAX_TEXTURE = int(argv[i + 1])


def log(message):
    """타임스탬프 로그 기록"""
    ts = datetime.datetime.now().isoformat()
    line = f"[{ts}] {message}"
    print(line)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOG_DIR / f"optimize-{datetime.date.today()}.log"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_manifest():
    """매니페스트 로드"""
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"version": "1.0", "assets": []}


def save_manifest(manifest):
    """매니페스트 저장"""
    manifest["optimized_at"] = datetime.datetime.now().isoformat()
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def load_prompts():
    """프롬프트에서 폴리곤/텍스처 타겟 로드"""
    targets = {}
    if PROMPTS_PATH.exists():
        with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        for cat in data.get("categories", {}).values():
            for asset in cat.get("assets", []):
                targets[asset["id"]] = {
                    "poly_target": asset.get("poly_target", MAX_POLYS),
                    "texture_size": asset.get("texture_size", MAX_TEXTURE),
                }
    return targets


def clear_scene():
    """씬 초기화"""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(filepath):
    """GLB 파일 임포트"""
    bpy.ops.import_scene.gltf(filepath=str(filepath))


def count_polys():
    """씬 내 전체 폴리곤 수 계산"""
    total = 0
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            total += len(obj.data.polygons)
    return total


def decimate_meshes(target_polys):
    """Decimate modifier로 폴리곤 감소"""
    current = count_polys()
    if current <= target_polys:
        log(f"  폴리곤 OK: {current} <= {target_polys}")
        return current

    ratio = target_polys / current
    ratio = max(ratio, 0.05)  # 최소 5%

    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if len(obj.data.polygons) < 100:
            continue

        mod = obj.modifiers.new(name="Decimate", type="DECIMATE")
        mod.ratio = ratio
        mod.use_collapse_triangulate = True

        bpy.context.view_layer.objects.active = obj
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            log(f"  ⚠️ Decimate 적용 실패 ({obj.name}): {e}")

    final = count_polys()
    log(f"  폴리곤 감소: {current} → {final} (목표: {target_polys})")
    return final


def resize_textures(max_size):
    """텍스처 리사이즈"""
    resized = 0
    for img in bpy.data.images:
        if img.size[0] > max_size or img.size[1] > max_size:
            scale = max_size / max(img.size)
            new_w = int(img.size[0] * scale)
            new_h = int(img.size[1] * scale)
            img.scale(new_w, new_h)
            resized += 1
            log(f"  텍스처 리사이즈: {img.name} → {new_w}x{new_h}")
    if resized == 0:
        log(f"  텍스처 OK: 모두 {max_size}px 이하")


def export_glb(filepath):
    """최적화된 GLB 내보내기"""
    filepath = str(filepath)
    READY_DIR.mkdir(parents=True, exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_apply=True,
    )


def optimize_asset(glb_path, asset_id, targets):
    """단일 에셋 최적화"""
    target = targets.get(asset_id, {"poly_target": MAX_POLYS, "texture_size": MAX_TEXTURE})

    log(f"\n🔧 최적화 시작: {asset_id}")
    log(f"  입력: {glb_path}")
    log(f"  목표 폴리곤: {target['poly_target']}, 텍스처: {target['texture_size']}px")

    clear_scene()
    import_glb(glb_path)

    initial_polys = count_polys()
    log(f"  원본 폴리곤: {initial_polys}")

    # 1. 폴리곤 감소
    final_polys = decimate_meshes(target["poly_target"])

    # 2. 텍스처 리사이즈
    resize_textures(target["texture_size"])

    # 3. 내보내기
    output_path = READY_DIR / f"{asset_id}.glb"
    export_glb(output_path)

    file_size = output_path.stat().st_size
    log(f"  출력: {output_path} ({file_size / 1024:.1f}KB)")
    log(f"  ✅ 최적화 완료: {initial_polys} → {final_polys} polys")

    return {
        "ready_path": str(output_path),
        "optimized_polys": final_polys,
        "file_size": file_size,
    }


def main():
    log("═" * 50)
    log("🔧 벨튀 대작전 — 3D 에셋 최적화 시작")
    log("═" * 50)

    targets = load_prompts()
    manifest = load_manifest()

    # GLB 파일 목록
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    glb_files = sorted(RAW_DIR.glob("*.glb"))

    if SINGLE_ID:
        glb_files = [f for f in glb_files if f.stem == SINGLE_ID]

    if not glb_files:
        log("⚠️ 최적화할 GLB 파일이 없습니다.")
        return

    log(f"📦 최적화 대상: {len(glb_files)}개")

    results = {"succeeded": 0, "failed": 0}

    for glb_path in glb_files:
        asset_id = glb_path.stem
        try:
            result = optimize_asset(glb_path, asset_id, targets)

            # 매니페스트 업데이트
            for asset in manifest.get("assets", []):
                if asset["id"] == asset_id:
                    asset["ready_path"] = result["ready_path"]
                    asset["optimized_polys"] = result["optimized_polys"]
                    asset["optimized_size"] = result["file_size"]
                    break

            results["succeeded"] += 1
        except Exception as e:
            log(f"  ❌ 최적화 실패: {asset_id} — {e}")
            results["failed"] += 1

    save_manifest(manifest)

    log("\n" + "═" * 50)
    log("📊 최적화 결과")
    log(f"  ✅ 성공: {results['succeeded']}")
    log(f"  ❌ 실패: {results['failed']}")
    log("═" * 50)


if __name__ == "__main__":
    main()
