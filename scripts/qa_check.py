#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from pipeline_common import ROOT, log


MANIFEST_PATH = ROOT / "world_spec" / "asset_manifest.json"
RESULT_PATH = ROOT / "logs" / "qa_result.json"

TOTAL_POLYGON_LIMIT = 50000
ASSET_POLYGON_LIMIT = 70000
TEXTURE_RESOLUTION_LIMIT = 1024


def _as_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        match = re.search(r"\d+", value.replace(",", ""))
        if match:
            return int(match.group(0))
    return default


def _resolution_numbers(value: Any) -> list[int]:
    if isinstance(value, bool) or value is None:
        return []
    if isinstance(value, (int, float)):
        return [int(value)]
    if isinstance(value, str):
        return [int(number) for number in re.findall(r"\d+", value.replace(",", ""))]
    if isinstance(value, dict):
        numbers: list[int] = []
        for key in ("resolution", "max_resolution", "size", "width", "height"):
            numbers.extend(_resolution_numbers(value.get(key)))
        return numbers
    if isinstance(value, list):
        numbers = []
        for item in value:
            numbers.extend(_resolution_numbers(item))
        return numbers
    return []


def _texture_violations(asset: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = [
        ("texture_resolution", asset.get("texture_resolution")),
        ("max_texture_resolution", asset.get("max_texture_resolution")),
        ("texture_size", asset.get("texture_size")),
        ("texture_max_size", asset.get("texture_max_size")),
    ]

    textures = asset.get("textures", []) or []
    if isinstance(textures, dict):
        for name, texture in textures.items():
            candidates.append((str(name), texture))
    else:
        for index, texture in enumerate(textures):
            label = texture.get("name", f"textures[{index}]") if isinstance(texture, dict) else f"textures[{index}]"
            candidates.append((label, texture))

    violations = []
    for name, value in candidates:
        numbers = _resolution_numbers(value)
        if not numbers:
            continue
        max_resolution = max(numbers)
        if max_resolution > TEXTURE_RESOLUTION_LIMIT:
            violations.append({
                "asset_id": asset.get("id", "<unknown>"),
                "texture": name,
                "max_resolution": max_resolution,
                "limit": TEXTURE_RESOLUTION_LIMIT,
            })
    return violations


def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def run_qa(manifest_path: Path = MANIFEST_PATH, result_path: Path = RESULT_PATH) -> dict[str, Any]:
    manifest = load_manifest(manifest_path)
    assets = manifest.get("assets", [])

    asset_results = []
    warnings = []
    total_polygons = 0

    for asset in assets:
        asset_id = asset.get("id", "<unknown>")
        poly_budget = _as_int(asset.get("poly_budget"))
        instances = _as_int(asset.get("instances"), default=1)
        estimated_polygons = poly_budget * instances
        total_polygons += estimated_polygons

        asset_results.append({
            "id": asset_id,
            "poly_budget": poly_budget,
            "instances": instances,
            "estimated_polygons": estimated_polygons,
        })

        if poly_budget >= ASSET_POLYGON_LIMIT:
            warnings.append({
                "code": "ASSET_POLYGONS_OVER_BUDGET",
                "asset_id": asset_id,
                "poly_budget": poly_budget,
                "limit": ASSET_POLYGON_LIMIT,
                "message": f"{asset_id} poly_budget {poly_budget} >= {ASSET_POLYGON_LIMIT}",
            })

        for violation in _texture_violations(asset):
            warnings.append({
                "code": "TEXTURE_RESOLUTION_OVER_BUDGET",
                "message": (
                    f"{violation['asset_id']} texture {violation['texture']} "
                    f"{violation['max_resolution']} > {TEXTURE_RESOLUTION_LIMIT}"
                ),
                **violation,
            })

    if total_polygons >= TOTAL_POLYGON_LIMIT:
        warnings.insert(0, {
            "code": "TOTAL_POLYGONS_OVER_BUDGET",
            "total_estimated_polygons": total_polygons,
            "limit": TOTAL_POLYGON_LIMIT,
            "message": f"total polygons {total_polygons} >= {TOTAL_POLYGON_LIMIT}",
        })

    result = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "status": "FAIL" if warnings else "PASS",
        "thresholds": {
            "total_polygon_limit": TOTAL_POLYGON_LIMIT,
            "asset_polygon_limit": ASSET_POLYGON_LIMIT,
            "texture_resolution_limit": TEXTURE_RESOLUTION_LIMIT,
        },
        "manifest_path": str(manifest_path),
        "asset_count": len(assets),
        "total_estimated_polygons": total_polygons,
        "assets": asset_results,
        "warnings": warnings,
    }

    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="벨튀 VRChat 월드 성능 예산 QA")
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH, help="asset_manifest.json 경로")
    parser.add_argument("--output", type=Path, default=RESULT_PATH, help="QA 결과 JSON 경로")
    args = parser.parse_args()

    result = run_qa(args.manifest, args.output)
    log(f"qa_check: assets={result['asset_count']} total_polygons={result['total_estimated_polygons']}")
    for warning in result["warnings"]:
        log(f"qa_check warning: {warning['message']}")
    log(result["status"])
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
