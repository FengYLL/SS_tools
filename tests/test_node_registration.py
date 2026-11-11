"""节点注册与版本号。"""
from __future__ import annotations

import os
import unittest

from tests.support import REPO_ROOT, load_package


class NodeRegistrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.pkg = load_package()

    def test_version_matches_release(self) -> None:
        self.assertEqual(self.pkg.__version__, "1.3.0")

    def test_web_directory_points_to_js(self) -> None:
        self.assertEqual(self.pkg.WEB_DIRECTORY, "./js")
        self.assertTrue(os.path.isfile(os.path.join(REPO_ROOT, "js", "duck_tutorial.js")))

    def test_python_nodes_registered(self) -> None:
        for node_name in ("DuckHideNode", "DuckDecodeNode"):
            with self.subTest(node=node_name):
                self.assertIn(node_name, self.pkg.NODE_CLASS_MAPPINGS)
                self.assertIn(node_name, self.pkg.NODE_DISPLAY_NAME_MAPPINGS)

    def test_display_names_are_unique(self) -> None:
        names = list(self.pkg.NODE_DISPLAY_NAME_MAPPINGS.values())
        self.assertEqual(len(names), len(set(names)))

    def test_missing_optional_qr_node_does_not_break_package(self) -> None:
        # 本仓库快照可能不带 duck_qr_encoder_node.py，导入必须优雅降级。
        self.assertTrue(self.pkg.NODE_CLASS_MAPPINGS, "至少应注册编码/解码节点")


if __name__ == "__main__":
    unittest.main()
