// 三套额外配色（黑客「幽灵绿」/ 黑客「血焰红」/ 白客「白帽蓝」）。
//
// 做法：不改框架的 CSS，也不改框架的主题脚本。模块在 <head> 里注入一段先于绘制运行的脚本：
// 读本站自己的偏好（localStorage `vulnhot-theme`），给 <html> 打上 `data-vulnhot`，并把这一套变量
// 塞进一个后插入的 <style>。框架照旧管 `data-theme`（浅色/深夜/跟随系统），我们只在它之上覆盖颜色，
// 所以框架那边的开关仍然有效，两边不会打架。

/** 本站自己的偏好键（与框架的 `aihot-theme` 分开，避免互相覆盖）。 */
export const THEME_KEY = "vulnhot-theme";

export type ExtraTheme = "hacker" | "blood" | "whitehat";

/** 这套配色配哪个深浅色底（框架的深浅色开关要跟着对齐，两边的开关才不会打架）。 */
export const IMPLIED_THEME: Record<ExtraTheme, "light" | "dark"> = {
  hacker: "dark",
  blood: "dark",
  whitehat: "light",
};

/** 每套配色的说明，用在配色页上。 */
export const THEMES: ReadonlyArray<{ key: ExtraTheme; name: string; pitch: string; swatch: string[] }> = [
  {
    key: "hacker",
    name: "黑客 · 幽灵绿",
    pitch: "纯黑底 + 幽灵绿，背景是缓慢下落的代码流。终端感最强，夜里看漏洞最清醒。",
    swatch: ["#02080a", "#0a2418", "#00ff9c", "#ff5c74"],
  },
  {
    key: "blood",
    name: "黑客 · 血焰红",
    pitch: "深蓝黑底 + 血焰橙红，角落有暖光晕。比幽灵绿温和，长时间看面板不刺眼，仪表盘感最强。",
    swatch: ["#0b0f14", "#151d26", "#e4572e", "#f4a259"],
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
html[data-vulnhot="blood"]{color-scheme:dark;background:#0b0f14}
html[data-vulnhot="blood"] body{background:transparent}
html[data-vulnhot="blood"]{
background-image:radial-gradient(1200px 600px at 12% -10%,rgba(228,87,46,.10),transparent 60%),
radial-gradient(900px 500px at 100% 0%,rgba(42,157,143,.07),transparent 55%)}
html[data-vulnhot="blood"]{
--bg:#0b0f14;--bg-sunk:#0d1218;--bg-muted:#111827;--well:rgba(228,87,46,.05);
--surface:#0f141b;--surface-2:#111a22;--raised:#151d26;
--sidebar:#0c1116;--daybar:#0e141a;
--ink:#e2e8f0;--ink-2:#cbd5e1;--ink-3:#94a3b8;--ink-4:#64748b;
--line:rgba(228,87,46,.15);--line-strong:rgba(228,87,46,.3);--line-soft:rgba(228,87,46,.08);
--accent:#e4572e;--accent-ink:#f4a259;--accent-soft:rgba(228,87,46,.14);--accent-softer:rgba(228,87,46,.06);--accent-contrast:#0b0f14;
--note:#f4a259;--hot:#dc2626;--hot-soft:rgba(220,38,38,.16);--amber:#f59e0b;--amber-ink:#fbbf24;--amber-soft:rgba(245,158,11,.12);
--ok:#65a30d;--ok-soft:rgba(101,163,13,.14);--ok-ink:#a3e635;
--rank-1:#e4572e;--rank-2:#f4a259;--rank-3:#f59e0b;--rank-rest:#64748b;
--shadow-card:0 1px 2px rgba(0,0,0,.4);--shadow-card-hover:0 3px 14px rgba(0,0,0,.55);
--shadow-soft:0 6px 18px rgba(0,0,0,.5);--shadow-thumb:0 1px 2px rgba(0,0,0,.6);--shadow-pop:0 16px 40px rgba(0,0,0,.62);
--prose-ink:#dbe3ee;--code-bg:rgba(6,10,14,.92);--code-keyword:#e4572e;--code-string:#8ad7a2;--code-number:#f4a259;--code-title:#8ad7ff;--code-variable:#f59e0b;--code-meta:#dc2626;
--selection:rgba(228,87,46,.26)
}
html[data-vulnhot="blood"] ::-webkit-scrollbar-thumb{background:rgba(228,87,46,.28)}
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
var p=localStorage.getItem(K);if(p!=="hacker"&&p!=="blood"&&p!=="whitehat")return;
var h=document.documentElement;
h.setAttribute("data-theme",p==="whitehat"?"light":"dark");
h.setAttribute("data-vulnhot",p);
var s=document.getElementById(S);
if(!s){s=document.createElement("style");s.id=S;s.textContent=${JSON.stringify(PALETTE_CSS)};document.head.appendChild(s);}
}catch(e){}})();`;
