// 两套额外配色（黑客「幽灵绿」/ 白客「白帽蓝」）。
//
// 做法：不改框架的 CSS，也不改框架的主题脚本。模块在 <head> 里注入一段先于绘制运行的脚本：
// 读本站自己的偏好（localStorage `vulnhot-theme`），给 <html> 打上 `data-vulnhot`，并把这一套变量
// 塞进一个后插入的 <style>。框架照旧管 `data-theme`（浅色/深夜/跟随系统），我们只在它之上覆盖颜色，
// 所以框架那边的开关仍然有效，两边不会打架。

/** 本站自己的偏好键（与框架的 `aihot-theme` 分开，避免互相覆盖）。 */
export const THEME_KEY = "vulnhot-theme";

export type ExtraTheme = "hacker" | "whitehat";

/** 每套配色的说明，用在配色页上。 */
export const THEMES: ReadonlyArray<{ key: ExtraTheme; name: string; pitch: string; swatch: string[] }> = [
  {
    key: "hacker",
    name: "黑客 · 幽灵绿",
    pitch: "纯黑底 + 幽灵绿，背景是缓慢下落的代码流。终端感最强，夜里看漏洞最清醒。",
    swatch: ["#02080a", "#0a2418", "#00ff9c", "#ff5c74"],
  },
  {
    key: "whitehat",
    name: "白客 · 白帽蓝",
    pitch: "接近白纸的冷白底 + 皇家蓝，克制、对比度高，像一份审计报告，适合白天和投屏。",
    swatch: ["#f6f9fd", "#e4ecf7", "#1d4ed8", "#0f766e"],
  },
];

/**
 * 两套配色的 CSS。选择器用 `html[data-vulnhot=...]`，与框架的 `[data-theme=...]` 同权重、但我们后插入，
 * 所以在同一条链路上总是后生效。
 */
export const PALETTE_CSS = `
html[data-vulnhot="hacker"]{color-scheme:dark;background:#02080a}
html[data-vulnhot="hacker"] body{background:transparent}
html[data-vulnhot="hacker"]{
--bg:transparent;--bg-sunk:rgba(2,16,10,.82);--bg-muted:rgba(4,24,15,.86);--well:rgba(0,255,156,.05);
--surface:rgba(3,14,10,.86);--surface-2:rgba(4,18,12,.9);--raised:rgba(6,24,16,.92);
--sidebar:rgba(2,10,7,.9);--daybar:rgba(2,12,8,.88);
--ink:#d7ffe9;--ink-2:#b9f6d8;--ink-3:#79d6a8;--ink-4:#57b184;
--line:rgba(0,255,156,.16);--line-strong:rgba(0,255,156,.3);--line-soft:rgba(0,255,156,.08);
--accent:#00ff9c;--accent-ink:#8dffcb;--accent-soft:rgba(0,255,156,.12);--accent-softer:rgba(0,255,156,.05);--accent-contrast:#02120a;
--note:#5cd69c;--hot:#ff5c74;--hot-soft:rgba(255,92,116,.14);--amber:#ffd166;--amber-ink:#ffd166;--amber-soft:rgba(255,209,102,.12);
--ok:#00ff9c;--ok-soft:rgba(0,255,156,.12);--ok-ink:#8dffcb;
--rank-1:#ff5c74;--rank-2:#ff9e64;--rank-3:#ffd166;--rank-rest:#5c8f78;
--shadow-card:none;--shadow-card-hover:none;--shadow-soft:0 6px 18px rgba(0,0,0,.5);--shadow-thumb:0 1px 2px rgba(0,0,0,.6);--shadow-pop:0 16px 40px rgba(0,0,0,.6);
--prose-ink:#cdf7e2;--code-bg:rgba(1,10,6,.92);--code-keyword:#00ff9c;--code-string:#9dff8a;--code-number:#ffd166;--code-title:#8ad7ff;--code-variable:#ff9e64;--code-meta:#ff5c74;
--selection:rgba(0,255,156,.25)
}
html[data-vulnhot="hacker"] ::-webkit-scrollbar-thumb{background:rgba(0,255,156,.25)}
html[data-vulnhot="whitehat"]{color-scheme:light;background:#f6f9fd}
html[data-vulnhot="whitehat"]{
--bg:#f6f9fd;--bg-sunk:#eef3fa;--bg-muted:#e4ecf7;--well:#eef3fa;
--surface:#ffffff;--surface-2:#fbfdff;--raised:#ffffff;--sidebar:#f2f6fc;--daybar:#e9f0f9;
--ink:#101a2b;--ink-2:#1d2a3f;--ink-3:#4a5a72;--ink-4:#64748b;
--line:#dde6f2;--line-strong:#c9d6e8;--line-soft:#e9eff8;
--accent:#1d4ed8;--accent-ink:#1e3a8a;--accent-soft:rgba(29,78,216,.08);--accent-softer:rgba(29,78,216,.05);--accent-contrast:#ffffff;
--note:#3b6ea5;--hot:#b4232a;--hot-soft:rgba(180,35,42,.08);--amber:#a16207;--amber-ink:#7c4a06;--amber-soft:rgba(161,98,7,.1);
--ok:#0f766e;--ok-soft:rgba(15,118,110,.1);--ok-ink:#0d6b64;
--rank-1:#b4232a;--rank-2:#9a5b1f;--rank-3:#8a6a1a;--rank-rest:#5b6b82;
--shadow-card:0 1px 2px rgba(16,26,43,.03);--shadow-card-hover:0 3px 12px rgba(16,26,43,.07);
--prose-ink:#1b2737;--code-bg:#f4f7fb;--code-keyword:#1d4ed8;--code-string:#0f766e;--code-number:#9a6700;--code-title:#6d28d9;--code-variable:#b4510f;--code-meta:#be123c;
--selection:rgba(29,78,216,.16)
}
`;

/**
 * 先于绘制运行的脚本（WebModule.root.bootScript）：把上次选的配色在首帧之前放上去，避免闪一下默认色。
 * 只有站点的两套额外配色走这里；浅色/深夜/跟随系统仍然完全交给框架。
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var K=${JSON.stringify(THEME_KEY)},S="vulnhot-theme-style";
var p=localStorage.getItem(K);if(p!=="hacker"&&p!=="whitehat")return;
var h=document.documentElement;
h.setAttribute("data-theme",p==="hacker"?"dark":"light");
h.setAttribute("data-vulnhot",p);
var s=document.getElementById(S);
if(!s){s=document.createElement("style");s.id=S;s.textContent=${JSON.stringify(PALETTE_CSS)};document.head.appendChild(s);}
}catch(e){}})();`;
