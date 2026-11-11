/**
 * 前端扩展 harness：在 Node 里把 /scripts/app.js 换成桩，验证控件注入、幂等与剪贴板降级。
 * 运行：node --test tests/js/duck_tutorial.test.mjs
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXTENSION_SOURCE = new URL("../../js/duck_tutorial.js", import.meta.url);

const openedUrls = [];
const clipboardState = { execCommandResult: true };

class FakeNode {
    constructor() {
        this.widgets = [];
        this.size = [240, 100];
        this.dirty = false;
    }
    addWidget(type, name, value, callback) {
        const widget = { type, name, label: name, value, callback, options: {} };
        this.widgets.push(widget);
        return widget;
    }
    computeSize() {
        return [240, 40 + this.widgets.length * 22];
    }
    setSize(size) {
        this.size = size;
    }
    setDirtyCanvas() {
        this.dirty = true;
    }
}

function installBrowserStubs() {
    globalThis.window = {
        isSecureContext: false,
        open(url) {
            openedUrls.push(url);
            return { opener: null };
        },
    };
    try {
        Object.defineProperty(globalThis, "navigator", {
            value: { clipboard: undefined },
            configurable: true,
            writable: true,
        });
    } catch {
        Object.defineProperty(globalThis.navigator, "clipboard", { value: undefined, configurable: true });
    }
    const body = {
        children: [],
        appendChild(el) {
            this.children.push(el);
        },
        removeChild(el) {
            this.children = this.children.filter((item) => item !== el);
        },
    };
    globalThis.document = {
        body,
        documentElement: body,
        execCommand(command) {
            return command === "copy" ? clipboardState.execCommandResult : false;
        },
        createElement() {
            return {
                style: {},
                value: "",
                setAttribute() {},
                select() {},
                setSelectionRange() {},
                remove() {},
            };
        },
    };
}

let extensionModule;
let appStub;

before(async () => {
    installBrowserStubs();
    appStub = {
        registered: [],
        registerExtension(ext) {
            this.registered.push(ext);
        },
    };
    globalThis.__SS_APP_STUB__ = appStub;

    const source = await readFile(EXTENSION_SOURCE, "utf8");
    const rewritten = source.replace('from "/scripts/app.js"', 'from "./app_stub.mjs"');
    assert.notEqual(rewritten, source, "扩展必须从 /scripts/app.js 导入 app");

    const dir = await mkdtemp(path.join(tmpdir(), "ss-tools-js-"));
    await writeFile(path.join(dir, "app_stub.mjs"), "export const app = globalThis.__SS_APP_STUB__;\n", "utf8");
    const modulePath = path.join(dir, "duck_tutorial.mjs");
    await writeFile(modulePath, rewritten, "utf8");
    extensionModule = await import(pathToFileURL(modulePath).href);
});

function makePatchedNodeClass(nodeName) {
    const ext = appStub.registered[0];
    class ScopedNode extends FakeNode {}
    ext.beforeRegisterNodeDef(ScopedNode, { name: nodeName }, appStub);
    return ScopedNode;
}

function labelsOf(node) {
    return node.widgets.map((widget) => widget.label ?? widget.name);
}

test("注册扩展并暴露版本", () => {
    assert.equal(appStub.registered.length, 1);
    const ext = appStub.registered[0];
    assert.equal(ext.name, "SSTools.DuckTutorial");
    assert.equal(extensionModule.VERSION, "1.3.0");
});

test("DuckHideNode 注入 5 个控件（4 按钮 + 免责声明）", () => {
    const NodeClass = makePatchedNodeClass("DuckHideNode");
    const node = new NodeClass();
    node.onNodeCreated();
    assert.deepEqual(labelsOf(node), [
        "教学视频合集",
        "本地编码/解码工具下载",
        "在线解码工具",
        "交流群",
        "ss_tools_text_display",
    ]);
});

test("DuckQREncodeNode 额外注入二维码入口", () => {
    const NodeClass = makePatchedNodeClass("DuckQREncodeNode");
    const node = new NodeClass();
    node.onNodeCreated();
    assert.deepEqual(labelsOf(node).slice(0, 2), ["二维码引流教程", "用二维码编码器定制内容"]);
    // 2 个二维码入口 + 4 个通用入口 + 1 个免责声明文本控件
    assert.equal(node.widgets.length, 7);
});

test("重复触发 onNodeCreated 不会叠加控件", () => {
    const NodeClass = makePatchedNodeClass("DuckDecodeNode");
    const node = new NodeClass();
    node.onNodeCreated();
    const first = node.widgets.length;
    node.onNodeCreated();
    node.onNodeCreated();
    assert.equal(node.widgets.length, first);
});

test("非目标节点不被挂载控件", () => {
    const NodeClass = makePatchedNodeClass("KSampler");
    assert.equal(NodeClass.prototype.onNodeCreated, undefined);
});

test("加完控件后按控件数量重排节点", () => {
    const NodeClass = makePatchedNodeClass("DuckHideNode");
    const node = new NodeClass();
    node.onNodeCreated();
    assert.deepEqual(node.size, [240, 40 + node.widgets.length * 22]);
    assert.equal(node.dirty, true);
});

test("教程按钮打开对应外链", async () => {
    openedUrls.length = 0;
    const NodeClass = makePatchedNodeClass("DuckHideNode");
    const node = new NodeClass();
    node.onNodeCreated();
    const tutorial = node.widgets.find((widget) => widget.label === "教学视频合集");
    await tutorial.callback();
    assert.deepEqual(openedUrls, [extensionModule.LINKS.tutorials]);
});

test("非安全上下文下交流群改用 execCommand 复制", async () => {
    clipboardState.execCommandResult = true;
    const NodeClass = makePatchedNodeClass("DuckHideNode");
    const node = new NodeClass();
    node.onNodeCreated();
    const groupButton = node.widgets.find((widget) => widget.label === "交流群");
    await groupButton.callback();
    assert.ok(groupButton.label.startsWith("已复制到剪切板"), groupButton.label);
    assert.ok(groupButton.label.includes(extensionModule.QQ_GROUP_TEXT));
});

test("复制失败时把群号直接写进按钮文本", async () => {
    clipboardState.execCommandResult = false;
    const NodeClass = makePatchedNodeClass("DuckHideNode");
    const node = new NodeClass();
    node.onNodeCreated();
    const groupButton = node.widgets.find((widget) => widget.label === "交流群");
    await groupButton.callback();
    assert.ok(groupButton.label.startsWith("复制失败"), groupButton.label);
    assert.ok(groupButton.label.includes(extensionModule.QQ_GROUP_TEXT));
    clipboardState.execCommandResult = true;
});

test("免责声明控件只读且可测量、可绘制", () => {
    const widget = extensionModule.createTextDisplay(extensionModule.DISCLAIMER);
    assert.equal(widget.serialize, false);
    const [, height] = widget.computeSize(220);
    assert.ok(height > 0);

    const drawn = [];
    widget.draw(
        {
            fillStyle: "",
            font: "",
            measureText: (text) => ({ width: text.length * 7 }),
            fillText: (text) => drawn.push(text),
        },
        null,
        220,
        0,
    );
    assert.ok(drawn.length > 0);
});
