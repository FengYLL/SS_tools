# SS_tools v1.3.0 发布前测试报告

- 测试时间：2026-11-12（Asia/Shanghai）
- 被测提交：v1.3.0 发布分支
- 结论：**通过**，可进入 GitHub Actions 打包与发布

## 1. 测试环境（虚拟环境）

| 项 | 值 |
| --- | --- |
| 宿主 | Windows 11 + WSL2（Ubuntu） |
| 虚拟机内核 | Linux 6.18.33.2-microsoft-standard-WSL2 (x86_64) |
| Python | 3.14.4（`~/.ss_tools_venv` 独立虚拟环境） |
| NumPy | 2.5.4 |
| Pillow | 13.0.0 |
| Node.js | v24.16.0（Windows 侧跑前端 harness，CI 上对应 Node 20） |

虚拟环境从零创建（`python3 -m venv`），只装 `numpy`、`pillow` 两个真实依赖，ComfyUI / torch / moviepy 全部用桩替代，避免"测试环境跑的不是发布环境"。

## 2. 用例与结果

### Python（9 项全通过）

```
~/.ss_tools_venv/bin/python -m unittest discover -v
...
Ran 9 tests in 0.309s
OK
```

- `test_roundtrip_with_password`：48 KB 随机字节 → 鸭子图 → 解回逐字节一致
- `test_roundtrip_without_password`：无密码模式往返一致
- `test_wrong_password_is_rejected`：错误密码必须报「密码错误」
- `test_password_required_when_protected`：带保护但不给密码必须报「需要密码」
- `test_version_matches_release`：`__version__` = 1.3.0
- `test_web_directory_points_to_js`：`WEB_DIRECTORY` 指向 `./js` 且文件存在
- `test_python_nodes_registered`：DuckHideNode / DuckDecodeNode 注册成功
- `test_display_names_are_unique`：显示名不重复
- `test_missing_optional_qr_node_does_not_break_package`：缺少可选 QR 节点时优雅降级

### 前端（10 项全通过）

```
node --test tests/js/duck_tutorial.test.mjs
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

- 扩展注册名 `SSTools.DuckTutorial`、版本 1.3.0
- DuckHideNode 注入 4 按钮 + 1 免责声明控件；DuckQREncodeNode 额外 2 个二维码入口
- 重复触发 `onNodeCreated` 不叠加控件（幂等）
- 非目标节点（KSampler）不被挂载
- 加控件后按控件数重排节点高度
- 教程按钮打开正确外链
- 非安全上下文（`http://`）走 `execCommand` 降级复制成功
- 复制失败时按钮直接显示群号
- 免责声明控件只读且可测量、可绘制

## 3. 测试中发现并修复的问题

1. **NumPy 2.x 编码必崩**：`duck_payload_exporter._embed_payload_lsb` 使用 `flat[sel] & (~mask)`，负数掩码在 NumPy 2.x 触发 `OverflowError: Python integer -4 out of bounds for uint8`，任何一次编码都会失败。已改为 `np.uint8(0xFF & ~mask)`。
2. **前端重复注入**：V1.2 的按钮注入没有幂等保护，节点被复用/重载会叠出两排按钮。已用节点级标记位修复。

## 4. 打包产物校验

```
$ python scripts/build_release.py --expect-version 1.3.0
打包完成: SS_tools-v1.3.0.zip (31 个文件, 164.6 MB)
SHA256: df63b03c9398087d613474bcd676954ebdb38a3743489aa2c5f5f1bfd27d5090
```

## 5. 复现命令

```bash
# 虚拟机（WSL）里
python3 -m venv --without-pip ~/.ss_tools_venv
curl -fsSL https://bootstrap.pypa.io/get-pip.py | ~/.ss_tools_venv/bin/python -
~/.ss_tools_venv/bin/pip install numpy pillow
~/.ss_tools_venv/bin/python -m unittest discover -v

# 前端
node --test tests/js/duck_tutorial.test.mjs

# 打包
python scripts/build_release.py --expect-version 1.3.0
```
