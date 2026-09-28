import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import probe, run
from capture import resources


class CommandTests(unittest.TestCase):
    def test_rejects_shell_strings_and_unapproved_programs_before_execution(self):
        with patch("common.subprocess.run") as process:
            for command in ("git --version", [], ["sh", "-c", "touch unwanted"], ["git; touch unwanted"]):
                with self.assertRaises(ValueError):
                    run(command)
            with self.assertRaises(TypeError):
                run(["git", "--version"], shell=True)
            with self.assertRaises(TypeError):
                run(["git", "--version"], executable="sh")
            process.assert_not_called()

    def test_argument_metacharacters_remain_literal_and_child_path_cannot_change_tool(self):
        with tempfile.TemporaryDirectory() as temporary:
            marker = Path(temporary) / "unwanted"
            argument = f"--version; touch {marker}"
            with self.assertRaises(subprocess.CalledProcessError):
                run(["git", argument], env={**os.environ, "PATH": temporary})
            self.assertFalse(marker.exists())

    def test_resource_tag_cannot_supply_git_options_or_escape_cache(self):
        with patch("capture.run") as process, patch("capture.download") as download:
            for tag in ("--output=unwanted", "../outside", "release/../../outside", "main:other", "main;touch unwanted"):
                with self.assertRaisesRegex(ValueError, "Invalid resource"):
                    resources("en", ".", tag)
            process.assert_not_called()
            download.assert_not_called()

    def test_git_revision_is_terminated_and_repository_is_absolute(self):
        with patch("capture.run", return_value='<resources><string name="name">Value</string></resources>') as process:
            self.assertEqual(resources("en", ".", "v1.10.9"), {"name": "Value"})
            args = process.call_args.args[0]
            self.assertTrue(Path(args[2]).is_absolute())
            self.assertEqual(args[3:], ["show", "--end-of-options", "v1.10.9:app/src/main/res/values/strings.xml", "--"])

    def test_option_like_media_filename_is_passed_as_an_absolute_path(self):
        with patch("common.run", return_value='{"format":{"duration":"1"}}') as process:
            probe("-show_entries")
            self.assertEqual(process.call_args.args[0][-1], Path("-show_entries").resolve())
