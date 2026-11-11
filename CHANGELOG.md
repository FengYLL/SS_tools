# 更新日志

## V1.3.0 (2026-11-12)

### 前端（ComfyUI Web UI）
- 节点面板注入逻辑改为幂等：重复触发 `onNodeCreated` 不再叠加按钮，重开工作流不会出现两排入口。
- 「交流群」按钮新增剪贴板降级：用 `http://` 局域网地址打开 ComfyUI（非安全上下文）时，`navigator.clipboard` 不可用也能复制群号。
- 复制失败时按钮直接显示群号文本，不需要再展开控制台。
- 所有外链集中到 `LINKS` 表；只读文本控件设置 `serialize: false`，不再写进工作流 JSON。
- 增加控件后统一做一次安全重排，节点高度按实际控件数计算。

### 兼容性修复
- 修复 `_embed_payload_lsb` 在 NumPy 2.x 下编码必然失败的问题（`uint8 & ~mask` 抛出 `OverflowError`）；改用显式 8 位掩码，Python 3.10~3.14 / NumPy 2.x 全绿。

### 打包与发布
- 新增 `pyproject.toml`、`__version__` 版本号（1.3.0）。
- 新增测试套件：负载往返（编码→解码逐字节比对）、节点注册、前端扩展 harness。
- 新增 GitHub Actions：`ci.yml` 跑测试，`release.yml` 打 tag 自动打包并发布 Release（zip + SHA256SUMS）。

## V1.2
- ComfyUI 节点（DuckHideNode / DuckDecodeNode）、本地 exe 工具、macOS 工具、浏览器解码插件。
