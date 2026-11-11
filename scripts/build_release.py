#!/usr/bin/env python3
"""打包发布产物。

输出（dist/）：
  SS_tools-vX.Y.Z.zip   可直接丢进 ComfyUI/custom_nodes 的整包
  SHA256SUMS            校验和
  release_notes.md      从 CHANGELOG.md 抽出的本版说明

只依赖标准库，CI 上不需要装任何东西。
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {
    ".git",
    ".github",
    ".venv",
    "venv",
    "dist",
    "build",
    "__pycache__",
    "node_modules",
    ".pytest_cache",
    "release_apks",
}
EXCLUDE_SUFFIXES = {".pyc", ".pyo"}
STORE_THRESHOLD = 8 * 1024 * 1024


def read_pyproject_version() -> str:
    text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    match = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
    if not match:
        sys.exit("pyproject.toml 缺少 version 字段")
    return match.group(1)


def read_init_version() -> str:
    text = (ROOT / "__init__.py").read_text(encoding="utf-8")
    match = re.search(r'^__version__\s*=\s*"([^"]+)"', text, re.MULTILINE)
    if not match:
        sys.exit("__init__.py 缺少 __version__")
    return match.group(1)


def iter_files():
    for path in sorted(ROOT.rglob("*")):
        rel = path.relative_to(ROOT)
        if any(part in EXCLUDE_DIRS for part in rel.parts):
            continue
        if path.is_dir() or path.suffix.lower() in EXCLUDE_SUFFIXES:
            continue
        yield path, rel


def changelog_section(version: str) -> str:
    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    pattern = re.compile(
        r"^##\s*V?" + re.escape(version) + r".*?$\n(.*?)(?=^##\s|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        return f"SS_tools v{version}"
    body = match.group(1).strip()
    return f"## SS_tools v{version}\n\n{body}\n"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expect-version", default="", help="CI 里传 tag 的版本号，用于校验一致性")
    args = parser.parse_args()

    pyproject_version = read_pyproject_version()
    init_version = read_init_version()
    if pyproject_version != init_version:
        sys.exit(f"版本号不一致: pyproject={pyproject_version} __init__={init_version}")
    if args.expect_version and args.expect_version.lstrip("v") != pyproject_version:
        sys.exit(f"tag 版本 {args.expect_version} 与项目版本 {pyproject_version} 不一致")

    version = pyproject_version
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    zip_path = dist / f"SS_tools-v{version}.zip"
    if zip_path.exists():
        zip_path.unlink()

    count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path, rel in iter_files():
            info = zipfile.ZipInfo.from_file(path, arcname=f"SS_tools/{rel.as_posix()}")
            info.compress_type = (
                zipfile.ZIP_STORED if path.stat().st_size >= STORE_THRESHOLD else zipfile.ZIP_DEFLATED
            )
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
            count += 1

    digest = sha256_of(zip_path)
    (dist / "SHA256SUMS").write_text(f"{digest}  {zip_path.name}\n", encoding="utf-8")
    (dist / "release_notes.md").write_text(changelog_section(version), encoding="utf-8")

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"打包完成: {zip_path.name} ({count} 个文件, {size_mb:.1f} MB)")
    print(f"SHA256: {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
