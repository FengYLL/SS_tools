"""测试支撑：为 ComfyUI / torch / moviepy 打桩，并按路径加载被测包。

这些桩只保证 import 期能求值，不模拟张量运算；真正跑算法的是 numpy + Pillow。
"""
from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import types

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _module(name: str, **attrs) -> types.ModuleType:
    mod = sys.modules.get(name)
    if mod is None:
        mod = types.ModuleType(name)
        sys.modules[name] = mod
    for key, value in attrs.items():
        setattr(mod, key, value)
    return mod


def install_stubs() -> None:
    """把 ComfyUI 运行时依赖替换成最小桩。"""
    if REPO_ROOT not in sys.path:
        sys.path.insert(0, REPO_ROOT)

    if "torch" not in sys.modules:
        class Tensor:  # noqa: D401 - 仅用于注解求值
            """最小 Tensor 占位。"""

        _module(
            "torch",
            Tensor=Tensor,
            from_numpy=lambda arr: Tensor(),
            zeros=lambda *args, **kwargs: Tensor(),
            cat=lambda *args, **kwargs: Tensor(),
            tensor=lambda *args, **kwargs: Tensor(),
        )

    output_dir = os.path.join(tempfile.gettempdir(), "ss_tools_test_output")
    os.makedirs(output_dir, exist_ok=True)
    _module(
        "folder_paths",
        get_output_directory=lambda: output_dir,
        get_temp_directory=lambda: tempfile.gettempdir(),
        get_input_directory=lambda: tempfile.gettempdir(),
    )

    if "moviepy" not in sys.modules:
        class _Clip:
            def __init__(self, *args, **kwargs):
                pass

            def close(self):
                return None

        moviepy = _module("moviepy")
        editor = _module(
            "moviepy.editor",
            ImageSequenceClip=_Clip,
            AudioFileClip=_Clip,
            VideoFileClip=_Clip,
            concatenate_audioclips=lambda clips: _Clip(),
        )
        moviepy.editor = editor
        for name in ("ImageSequenceClip", "AudioFileClip", "VideoFileClip", "concatenate_audioclips"):
            setattr(moviepy, name, getattr(editor, name))


def load_package() -> types.ModuleType:
    """按文件路径加载 SS_tools 包，避免依赖克隆目录名。"""
    install_stubs()
    name = "ss_tools_under_test"
    if name in sys.modules:
        return sys.modules[name]
    init_path = os.path.join(REPO_ROOT, "__init__.py")
    spec = importlib.util.spec_from_file_location(
        name, init_path, submodule_search_locations=[REPO_ROOT]
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载被测包: {init_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module
