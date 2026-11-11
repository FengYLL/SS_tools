"""负载往返：编码进鸭子图，再从 PNG 里解回来，逐字节比对。"""
from __future__ import annotations

import os
import tempfile
import unittest

import numpy as np
from PIL import Image

from tests.support import install_stubs, load_package


def _decode_png(path: str, password: str):
    from duck_decode_node import _extract_payload_with_k, _parse_header

    arr = np.array(Image.open(path).convert("RGB")).astype(np.uint8)
    errors = []
    for k in (2, 6, 8):
        try:
            header = _extract_payload_with_k(arr, k)
            return _parse_header(header, password)
        except Exception as exc:  # 换一档压缩位宽再试
            errors.append(exc)
    # 位宽猜错时解出来的是垃圾，报「长度异常」；密码问题才是我们要断言的，
    # 所以优先抛含密码提示的异常。
    for exc in errors:
        message = str(exc)
        if "密码" in message or "Password" in message:
            raise exc
    raise errors[0]


class PayloadRoundtripTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        load_package()
        install_stubs()
        from duck_payload_exporter import export_duck_payload

        cls.export = staticmethod(export_duck_payload)

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)

    def _export(self, payload: bytes, password: str, ext: str, compress: int) -> str:
        path, _ = self.export(
            payload,
            password=password,
            ext=ext,
            compress=compress,
            title="CI",
            output_dir=self._tmp.name,
            output_name=f"duck_{compress}.png",
        )
        return path

    def test_roundtrip_with_password(self) -> None:
        payload = os.urandom(48 * 1024)
        path = self._export(payload, "s3cret-密码", "json", 2)
        data, ext = _decode_png(path, "s3cret-密码")
        self.assertEqual(ext, "json")
        self.assertEqual(len(data), len(payload))
        self.assertEqual(data, payload)

    def test_roundtrip_without_password(self) -> None:
        payload = b"hello duck " * 2000
        path = self._export(payload, "", "bin", 6)
        data, ext = _decode_png(path, "")
        self.assertEqual(ext, "bin")
        self.assertEqual(data, payload)

    def test_wrong_password_is_rejected(self) -> None:
        payload = os.urandom(8 * 1024)
        path = self._export(payload, "right-password", "bin", 2)
        with self.assertRaises(ValueError) as ctx:
            _decode_png(path, "wrong-password")
        self.assertIn("密码错误", str(ctx.exception))

    def test_password_required_when_protected(self) -> None:
        payload = os.urandom(4 * 1024)
        path = self._export(payload, "guard", "txt", 2)
        with self.assertRaises(ValueError) as ctx:
            _decode_png(path, "")
        self.assertIn("需要密码", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
