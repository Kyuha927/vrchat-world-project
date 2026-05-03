from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from scripts import qa_check


class QaCheckTests(unittest.TestCase):
    def write_manifest(self, root: Path, assets: list[dict]) -> Path:
        path = root / "asset_manifest.json"
        path.write_text(json.dumps({"assets": assets}), encoding="utf-8")
        return path

    def test_passes_when_assets_fit_budget(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest_path = self.write_manifest(
                root,
                [
                    {
                        "id": "door",
                        "poly_budget": 500,
                        "instances": 10,
                        "texture_resolution": 1024,
                    },
                    {"id": "button", "poly_budget": 50, "instances": 10},
                ],
            )
            result_path = root / "qa_result.json"

            result = qa_check.run_qa(manifest_path, result_path)

            self.assertEqual(result["status"], "PASS")
            self.assertEqual(result["total_estimated_polygons"], 5500)
            self.assertEqual(result["warnings"], [])
            self.assertEqual(json.loads(result_path.read_text(encoding="utf-8")), result)

    def test_fails_for_total_single_asset_and_texture_warnings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest_path = self.write_manifest(
                root,
                [
                    {
                        "id": "heavy_asset",
                        "poly_budget": 70000,
                        "instances": 1,
                        "textures": [
                            {"name": "albedo", "width": 2048, "height": 1024},
                        ],
                    },
                    {"id": "repeated_asset", "poly_budget": 1000, "instances": 50},
                ],
            )

            result = qa_check.run_qa(manifest_path, root / "qa_result.json")

            warning_codes = {warning["code"] for warning in result["warnings"]}
            self.assertEqual(result["status"], "FAIL")
            self.assertEqual(result["total_estimated_polygons"], 120000)
            self.assertIn("TOTAL_POLYGONS_OVER_BUDGET", warning_codes)
            self.assertIn("ASSET_POLYGONS_OVER_BUDGET", warning_codes)
            self.assertIn("TEXTURE_RESOLUTION_OVER_BUDGET", warning_codes)


if __name__ == "__main__":
    unittest.main()
