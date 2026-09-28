import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prune import prune


class PruneTests(unittest.TestCase):
    def fixture(self, root):
        variants = []
        for theme in ("light", "dark"):
            relative = f"special-keys/en/api-37/{theme}/{'a' * 16}"
            directory = root / relative
            directory.mkdir(parents=True)
            files = {"poster": "poster.webp", "webm": "video.webm", "mp4": "video.mp4", "chapters": "chapters.vtt", "captions": "captions.vtt"}
            for filename in [*files.values(), "step.webp"]:
                (directory / filename).write_text("fixture")
            variants.append({"guide": "special-keys", "language": "en", "apiLevel": 37, "theme": theme, "build": "a" * 16, **{key: f"/guides/{relative}/{value}" for key, value in files.items()}, "steps": [{"image": f"/guides/{relative}/step.webp"}]})
        index = {"schemaVersion": 1, "variants": variants}
        (root / "index.json").write_text(json.dumps(index))
        obsolete = root / f"special-keys/en/api-37/light/{'b' * 16}"
        obsolete.mkdir()
        return index, obsolete

    def test_preview_then_remove_preserves_both_current_themes_and_other_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            index, obsolete = self.fixture(root)
            pending = root / ".pending-render"
            pending.mkdir()
            speech = root / "speech/audio.wav"
            speech.parent.mkdir()
            speech.write_text("cached speech")
            index_bytes = (root / "index.json").read_bytes()
            self.assertEqual(prune(root, dry_run=True), [obsolete])
            self.assertTrue(obsolete.exists())
            prune(root)
            self.assertFalse(obsolete.exists())
            self.assertTrue(pending.exists())
            self.assertTrue(speech.exists())
            self.assertEqual((root / "index.json").read_bytes(), index_bytes)
            for variant in index["variants"]:
                self.assertTrue((root / variant["webm"].removeprefix("/guides/")).exists())

    def test_missing_indexed_asset_blocks_all_deletions(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            index, obsolete = self.fixture(root)
            (root / index["variants"][0]["poster"].removeprefix("/guides/")).unlink()
            with self.assertRaisesRegex(ValueError, "asset is missing"):
                prune(root)
            self.assertTrue(obsolete.exists())

    def test_guide_filter_does_not_remove_another_guides_build(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _, obsolete = self.fixture(root)
            self.assertEqual(prune(root, guide="add-host"), [])
            self.assertTrue(obsolete.exists())
