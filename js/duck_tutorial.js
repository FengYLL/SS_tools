/**
 * SS_tools 前端扩展 V1.3.0
 *
 * 在 DuckHideNode / DuckDecodeNode / DuckQREncodeNode 上注入教程、工具与交流入口。
 * 相对 V1.2 的前端改动：
 *  1. 注入幂等：同一节点重复触发 onNodeCreated 不会叠加按钮；
 *  2. 剪贴板降级：通过 http:// 局域网地址访问 ComfyUI（非安全上下文）时仍能复制群号；
 *  3. 入口地址集中在 LINKS 表，改链接只改一处；
 *  4. 自定义文本控件关闭序列化，工作流 JSON 不再写入只读展示控件；
 *  5. 加控件后统一走一次安全重排，节点高度不再被截断。
 */
import { app } from "/scripts/app.js";

export const EXTENSION_NAME = "SSTools.DuckTutorial";
export const VERSION = "1.3.0";

/** 所有外链集中在这里，方便换成自己的站点。 */
export const LINKS = Object.freeze({
    qrTutorial: "http://duck.airush.top:81/qr_jump.html",
    qrDashboard: "https://duckp.airush.top/dashboard",
    tutorials: "http://duck.airush.top:81/jiaocheng.html",
    localTools: "http://duck.airush.top:81/sstool_jump.html",
    onlineDecode: "http://duck.airush.top:81/online_jump.html",
});

export const QQ_GROUP_TEXT = "一群：1020585041 二群：690810507";
export const DISCLAIMER =
    "免责声明: 此节点为开源项目，仅用于作品内容保护和学习交流，使用即承诺符合法律法规，自愿承担全部风险与责任。";

const NODE_NAMES = ["DuckHideNode", "DuckDecodeNode", "DuckQREncodeNode"];
const UI_FLAG = "__ssToolsUiV130";
const GROUP_BUTTON = "交流群";

function openExternal(url) {
    try {
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (win) win.opener = null;
        return true;
    } catch (err) {
        console.error("[SS_tools] 打开链接失败:", url, err);
        return false;
    }
}

/** 复制文本：优先 clipboard API，非安全上下文回退到 execCommand。 */
export async function copyText(text) {
    const nav = typeof navigator === "object" && navigator ? navigator : null;
    const secure =
        typeof window === "object" && window ? window.isSecureContext !== false : false;

    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function" && secure) {
        try {
            await nav.clipboard.writeText(text);
            return true;
        } catch (err) {
            // 权限被拒或上下文不是 https，继续走降级路径
        }
    }

    if (typeof document === "undefined" || !document || typeof document.createElement !== "function") {
        return false;
    }
    const host = document.body || document.documentElement;
    if (!host || typeof host.appendChild !== "function") return false;

    let area;
    try {
        area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        area.style.opacity = "0";
        host.appendChild(area);
        if (typeof area.select === "function") area.select();
        if (typeof area.setSelectionRange === "function") area.setSelectionRange(0, text.length);
        return typeof document.execCommand === "function" ? !!document.execCommand("copy") : false;
    } catch (err) {
        return false;
    } finally {
        if (area) {
            try {
                if (typeof area.remove === "function") area.remove();
                else host.removeChild(area);
            } catch (err) {
                // 清理失败不影响复制结果
            }
        }
    }
}

function refreshNode(node) {
    try {
        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
    } catch (err) {
        console.error("[SS_tools] 刷新节点失败:", err);
    }
}

function scheduleResize(node) {
    const resize = () => {
        try {
            if (node.computeSize && node.setSize) node.setSize(node.computeSize());
            refreshNode(node);
        } catch (err) {
            console.error("[SS_tools] 重排节点失败:", err);
        }
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(resize);
    else resize();
}

function attachWidget(node, widget) {
    if (typeof node.addCustomWidget === "function") {
        node.addCustomWidget(widget);
        return widget;
    }
    if (!Array.isArray(node.widgets)) node.widgets = [];
    node.widgets.push(widget);
    return widget;
}

/** 文本展示控件：只读，不写进工作流 JSON。 */
export function createTextDisplay(text, color = "#888") {
    return {
        type: "ss_tools_text_display",
        name: "ss_tools_text_display",
        value: text,
        serialize: false,
        options: { serialize: false },
        computeSize(width) {
            const availWidth = Math.max(1, width - 30);
            let lineCount = 1;
            let currentLen = 0;
            for (let i = 0; i < text.length; i++) {
                currentLen += text.charCodeAt(i) > 255 ? 12 : 7;
                if (currentLen > availWidth) {
                    lineCount++;
                    currentLen = 0;
                }
            }
            return [width, lineCount * 16 + 10];
        },
        draw(ctx, node, widgetWidth, y) {
            const lineHeight = 16;
            const maxWidth = Math.max(1, widgetWidth - 30);
            ctx.fillStyle = color;
            ctx.font = "11px Arial";
            let line = "";
            let currentY = y + 14;
            for (let i = 0; i < text.length; i++) {
                const testLine = line + text[i];
                if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
                    const lineWidth = ctx.measureText(line).width;
                    ctx.fillText(line, (widgetWidth - lineWidth) / 2, currentY);
                    line = text[i];
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            if (line.length > 0) {
                const lineWidth = ctx.measureText(line).width;
                ctx.fillText(line, (widgetWidth - lineWidth) / 2, currentY);
            }
        },
    };
}

export function addButton(node, label, onClick) {
    if (typeof node.addWidget === "function") {
        const widget = node.addWidget("button", label, null, onClick);
        if (widget) {
            widget.serialize = false;
            return widget;
        }
    }
    return attachWidget(node, {
        type: "button",
        name: label,
        label,
        value: null,
        serialize: false,
        options: { serialize: false },
        computeSize: (width) => [width, 20],
        mouse(event, pos, nodeRef) {
            if (typeof onClick === "function") onClick(event, pos, nodeRef);
            return true;
        },
    });
}

function findButton(node, label) {
    const widgets = Array.isArray(node.widgets) ? node.widgets : [];
    return (
        widgets.find((w) => w && (w.name === label || w.label === label)) || null
    );
}

async function copyGroupInfo(node) {
    const button = findButton(node, GROUP_BUTTON);
    const ok = await copyText(QQ_GROUP_TEXT);
    if (button) {
        button.label = ok ? `已复制到剪切板。${QQ_GROUP_TEXT}` : `复制失败，请手动复制：${QQ_GROUP_TEXT}`;
    }
    refreshNode(node);
}

function decorateNode(node, isQrNode) {
    if (!node || node[UI_FLAG]) return;
    node[UI_FLAG] = true;

    if (isQrNode) {
        addButton(node, "二维码引流教程", () => openExternal(LINKS.qrTutorial));
        addButton(node, "用二维码编码器定制内容", () => openExternal(LINKS.qrDashboard));
    }
    addButton(node, "教学视频合集", () => openExternal(LINKS.tutorials));
    addButton(node, "本地编码/解码工具下载", () => openExternal(LINKS.localTools));
    addButton(node, "在线解码工具", () => openExternal(LINKS.onlineDecode));
    addButton(node, GROUP_BUTTON, () => copyGroupInfo(node));

    attachWidget(node, createTextDisplay(DISCLAIMER));
    scheduleResize(node);
}

app.registerExtension({
    name: EXTENSION_NAME,
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!nodeData || !NODE_NAMES.includes(nodeData.name)) return;
        const isQrNode = nodeData.name === "DuckQREncodeNode";
        const onNodeCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            const result =
                typeof onNodeCreated === "function" ? onNodeCreated.apply(this, arguments) : undefined;
            decorateNode(this, isQrNode);
            return result;
        };
    },
});
