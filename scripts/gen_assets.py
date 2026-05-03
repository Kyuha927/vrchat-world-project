#!/usr/bin/env python3
"""
벨튀 대작전 — VRChat 월드 3D 에셋 생성 파이프라인.

Meshy API text-to-3d를 사용해 경량 VRChat 에셋(GLB)을 생성합니다.
scripts/meshy_prompts.json에서 프롬프트를 읽고,
assets/raw/에 원본 GLB를 저장하며,
world_spec/asset_manifest.json 상태를 업데이트합니다.

사용법:
  python gen_assets.py                  # 전체 생성
  python gen_assets.py --dry-run        # API 호출 없이 프롬프트 확인
  python gen_assets.py --single cyber_door  # 단일 에셋
  python gen_assets.py --status         # 현재 상태 확인

환경 변수:
  MESHY_API_KEY: Meshy AI API 키 (필수)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"
RAW_DIR = ROOT / "assets" / "raw"
READY_DIR = ROOT / "assets" / "ready"
PROMPTS_PATH = ROOT / "scripts" / "meshy_prompts.json"
MANIFEST_PATH = ROOT / "world_spec" / "asset_manifest.json"

MESHY_BASE = "https://api.meshy.ai/openapi/v2"
MAX_RETRIES = 3
POLL_INTERVAL = 10  # seconds


def log(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    line = f"[{datetime.now().isoformat()}] {msg}"
    print(line)
    log_file = LOG_DIR / f"gen_assets_{stamp[:8]}.log"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def meshy_request(endpoint: str, api_key: str, method: str = "GET",
                  data: dict | None = None) -> dict:
    """Make a request to Meshy API."""
    url = f"{MESHY_BASE}{endpoint}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")

    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Meshy API {e.code}: {error_body}") from e


def create_text_to_3d(prompt: str, api_key: str) -> str:
    """Create a text-to-3d task and return the task ID."""
    result = meshy_request("/text-to-3d", api_key, method="POST", data={
        "mode": "preview",  # preview = faster, lower quality but fine for game assets
        "prompt": prompt,
        "art_style": "low-poly",
        "topology": "quad",
        "target_polycount": 500,
    })
    task_id = result.get("result") or result.get("id")
    log(f"  ✅ 태스크 생성: {task_id}")
    return task_id


def poll_task(task_id: str, api_key: str) -> dict:
    """Poll a Meshy task until completion."""
    while True:
        result = meshy_request(f"/text-to-3d/{task_id}", api_key)
        status = result.get("status", "UNKNOWN")

        if status == "SUCCEEDED":
            log(f"  ✅ 완료: {task_id}")
            return result

        if status in ("FAILED", "EXPIRED"):
            raise RuntimeError(f"Task {task_id} failed: {status}")

        progress = result.get("progress", 0)
        log(f"  ⏳ 폴링: {task_id} → {status} ({progress}%)")
        time.sleep(POLL_INTERVAL)


def download_glb(task_result: dict, output_path: Path) -> int:
    """Download the GLB file from a completed task."""
    model_urls = task_result.get("model_urls", {})
    glb_url = model_urls.get("glb")
    if not glb_url:
        raise RuntimeError("GLB URL not found in task result")

    log(f"  📥 다운로드: {glb_url}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    req = Request(glb_url)
    with urlopen(req) as resp:
        data = resp.read()

    output_path.write_bytes(data)
    size_kb = len(data) / 1024
    log(f"  💾 저장: {output_path.name} ({size_kb:.1f}KB)")
    return len(data)


def load_prompts() -> dict:
    """Load Meshy prompts from JSON."""
    return json.loads(PROMPTS_PATH.read_text(encoding="utf-8"))


def load_manifest() -> dict:
    """Load asset manifest."""
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def save_manifest(manifest: dict) -> None:
    """Save asset manifest."""
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False),
                             encoding="utf-8")


def generate_asset(asset: dict, api_key: str, manifest: dict) -> bool:
    """Generate a single 3D asset. Returns True on success."""
    asset_id = asset["id"]
    prompt = asset["meshy_text_to_3d_prompt"]

    # Check if already generated
    for m_asset in manifest.get("assets", []):
        if m_asset.get("id") == asset_id and m_asset.get("status") == "succeeded":
            log(f"⏭️  스킵 (이미 생성됨): {asset_id}")
            return True

    log(f"🔨 생성 시작: {asset_id}")
    log(f"   프롬프트: {prompt[:100]}...")

    for retry in range(MAX_RETRIES):
        try:
            # Create task
            task_id = create_text_to_3d(prompt, api_key)

            # Poll for completion
            task_result = poll_task(task_id, api_key)

            # Download GLB
            output_path = RAW_DIR / f"{asset_id}.glb"
            file_size = download_glb(task_result, output_path)

            # Update manifest
            for m_asset in manifest.get("assets", []):
                if m_asset.get("id") == asset_id:
                    m_asset["status"] = "succeeded"
                    m_asset["task_id"] = task_id
                    m_asset["raw_path"] = str(output_path)
                    m_asset["file_size"] = file_size
                    break

            save_manifest(manifest)
            log(f"✅ 생성 완료: {asset_id} ({file_size / 1024:.1f}KB)")
            return True

        except Exception as e:
            log(f"❌ 실패 (시도 {retry + 1}/{MAX_RETRIES}): {asset_id} — {e}")
            if retry < MAX_RETRIES - 1:
                time.sleep(5)

    # All retries exhausted
    for m_asset in manifest.get("assets", []):
        if m_asset.get("id") == asset_id:
            m_asset["status"] = "failed"
            break
    save_manifest(manifest)
    return False


def show_status(manifest: dict) -> None:
    """Show current status of all assets."""
    log("═" * 50)
    log("📊 에셋 상태:")
    for asset in manifest.get("assets", []):
        status_emoji = {
            "pending": "⏳",
            "succeeded": "✅",
            "failed": "❌",
            "generating": "🔄",
        }.get(asset.get("status", ""), "❓")
        poly = asset.get("poly_budget", "?")
        log(f"  {status_emoji} {asset['id']:20s} — {asset.get('status', '?'):12s} (poly: {poly})")
    log("═" * 50)


def main():
    parser = argparse.ArgumentParser(description="벨튀 VRChat 3D 에셋 생성")
    parser.add_argument("--dry-run", action="store_true", help="프롬프트만 확인")
    parser.add_argument("--single", type=str, help="단일 에셋 ID")
    parser.add_argument("--status", action="store_true", help="현재 상태 확인")
    args = parser.parse_args()

    log("═" * 50)
    log("🎮 벨튀 대작전 — VRChat 3D 에셋 생성 파이프라인")
    log("═" * 50)

    manifest = load_manifest()

    if args.status:
        show_status(manifest)
        return

    prompts = load_prompts()
    assets = prompts.get("assets", [])

    if args.single:
        assets = [a for a in assets if a["id"] == args.single]
        if not assets:
            log(f"❌ 에셋 ID '{args.single}'를 찾을 수 없습니다.")
            sys.exit(1)

    log(f"📦 대상 에셋: {len(assets)}개")

    if args.dry_run:
        log("\n📋 [DRY RUN] 프롬프트 확인:")
        log("─" * 50)
        for asset in assets:
            log(f"\n  [{asset['id']}]")
            log(f"    Poly: {asset['expected_polygon_count']}")
            log(f"    Prompt: {asset['meshy_text_to_3d_prompt'][:120]}...")
        log("\n" + "─" * 50)
        log(f"✅ DRY RUN 완료. {len(assets)}개 에셋 확인됨.")
        return

    # API key check
    api_key = os.environ.get("MESHY_API_KEY", "")
    if not api_key:
        # Try .env file
        env_file = ROOT / "scripts" / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("MESHY_API_KEY="):
                    api_key = line.split("=", 1)[1].strip()
                    break
        if not api_key or api_key == "your_meshy_key_here":
            log("❌ MESHY_API_KEY가 설정되지 않았습니다.")
            log("   scripts/.env 파일에 API 키를 입력하거나")
            log("   환경 변수로 설정하세요: export MESHY_API_KEY=your_key")
            sys.exit(1)

    # Create directories
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    READY_DIR.mkdir(parents=True, exist_ok=True)

    # Generate assets
    start = time.time()
    succeeded = 0
    failed = 0

    for asset in assets:
        if generate_asset(asset, api_key, manifest):
            succeeded += 1
        else:
            failed += 1

    elapsed = time.time() - start

    log("\n" + "═" * 50)
    log("📊 생성 결과:")
    log(f"   ✅ 성공: {succeeded}")
    log(f"   ❌ 실패: {failed}")
    log(f"   ⏱️  소요: {elapsed:.1f}초")
    log("═" * 50)


if __name__ == "__main__":
    main()
