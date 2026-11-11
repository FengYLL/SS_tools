NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

try:
    from .duck_encode_node import NODE_CLASS_MAPPINGS as STEG_NODES, NODE_DISPLAY_NAME_MAPPINGS as STEG_DISPLAY
    NODE_CLASS_MAPPINGS.update(STEG_NODES)
    NODE_DISPLAY_NAME_MAPPINGS.update(STEG_DISPLAY)
except Exception as e:
    print(f"❌ SS_tools Import Error (Encode): {e}")

try:
    from .duck_decode_node import NODE_CLASS_MAPPINGS as DECODE_NODES, NODE_DISPLAY_NAME_MAPPINGS as DECODE_DISPLAY
    NODE_CLASS_MAPPINGS.update(DECODE_NODES)
    NODE_DISPLAY_NAME_MAPPINGS.update(DECODE_DISPLAY)
except Exception as e:
    print(f"❌ SS_tools Import Error (Decode): {e}")

try:
    from .duck_qr_encoder_node import NODE_CLASS_MAPPINGS as QR_NODES, NODE_DISPLAY_NAME_MAPPINGS as QR_DISPLAY
    NODE_CLASS_MAPPINGS.update(QR_NODES)
    NODE_DISPLAY_NAME_MAPPINGS.update(QR_DISPLAY)
except ImportError:
    print("ℹ️ SS_tools: Duck QR Encoder node not found. Skipping.")
except Exception as e:
    print(f"❌ SS_tools Import Error (QR): {e}")

# 前端扩展目录（ComfyUI 会把 ./js 挂到 /extensions/SS_tools/ 下）
WEB_DIRECTORY = "./js"

# 版本号：与 pyproject.toml / CHANGELOG.md / git tag 保持一致
__version__ = "1.3.0"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY", "__version__"]
