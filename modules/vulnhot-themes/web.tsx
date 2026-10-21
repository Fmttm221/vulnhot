// 额外配色的插口：首帧前应用（bootScript）、整站跟随（Bottom：数据流背景与跨标签页同步）、
// 以及侧栏与「我的」页上的入口。
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { WebModule } from "@aihot/web/modules";
import { resolvedTheme, watchAppearance } from "@aihot/web/lib/local-state";
import { THEME_BOOT_SCRIPT } from "./palette.ts";
import { applyExtraTheme, readExtraTheme, THEME_CHANGED } from "./web/client.ts";

function PaletteIcon({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h4a4 4 0 0 0 0-8h-4Z" />
      <circle cx="8.5" cy="9.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const CANVAS_ID = "vulnhot-datastream";

/**
 * 幽灵绿的数据流背景：一块 fixed 的 canvas，落在内容之下（html 背景之上），只在黑客配色下出现。
 * 尊重 prefers-reduced-motion，标签页切到后台就停，字号随屏宽。
 */
function DataStream(): null {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }
    // 安全场景的字库：十六进制与二进制、CVE/KEV/RCE 这类缩写、0x 前缀、符号与少量密文感的字符。
    // 不用日文假名：这一栏是"终端在滚日志"，不是赛博装饰。
    // 落下来的"词元"：十六进制、CVE 编号片、常见缩写、路径与符号。
    const tokens = [
      "0", "1", "0", "1", "f", "e", "7", "a", "c", "9", "d", "b",
      "0x7f", "0x41", "dead", "c0de", "beef", "ff", "00", "a3", "5c",
      "CVE-", "2026-", "-88771", "KEV", "RCE", "XSS", "SQLi", "SSRF", "LFI", "XXE",
      "PoC", "EXP", "C2", "IOC", "TTP", "EDR", "WAF", "TLS", "SSH", "SKID",
      "root", "shell", "sudo", "kernel", "patch", "bypass", "0day",
      "../", "/etc/passwd", "|", "&&", "::", "{}", "[]", "<>", "==", "!=",
      "$", "#", "%", "%00", "&#", "\\x41",
    ];
    let width = 0;
    let height = 0;
    let fontSize = 16;
    let drops: number[] = [];
    const resize = () => {
      width = canvas.width = innerWidth;
      height = canvas.height = innerHeight;
      fontSize = innerWidth < 641 ? 13 : 17;
      const columns = Math.ceil(width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * (-height / fontSize));
      ctx.fillStyle = "#02080a";
      ctx.fillRect(0, 0, width, height);
    };
    resize();
    addEventListener("resize", resize);
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 70) return;
      last = now;
      ctx.fillStyle = "rgba(2,8,10,0.14)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      for (let i = 0; i < drops.length; i++) {
        const glyph = tokens[(Math.random() * tokens.length) | 0]!;
        const y = drops[i]! * fontSize;
        ctx.fillStyle = Math.random() > 0.985 ? "rgba(200,255,228,0.95)" : "rgba(0,255,156,0.5)";
        ctx.fillText(glyph, i * fontSize, y);
        if (y > height && Math.random() > 0.972) drops[i] = 0;
        drops[i]! += 1;
      }
    };
    raf = requestAnimationFrame(draw);
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.remove();
    };
  }, []);
  return null;
}

/** 整站跟随：进来先对齐一次、标签页之间同步、黑客配色下挂上数据流。 */
function ThemeEffects(): ReactNode {
  const [stream, setStream] = useState(false);
  useEffect(() => {
    applyExtraTheme(readExtraTheme());
    setStream(readExtraTheme() === "hacker");
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "vulnhot-theme") return;
      applyExtraTheme(readExtraTheme());
      setStream(readExtraTheme() === "hacker");
    };
    const onLocalChange = () => setStream(readExtraTheme() === "hacker");
    // 框架自己的深浅色开关一动，就退出额外配色：两套偏好各自管各自的，不互相抢。
    const unwatch = watchAppearance((change) => {
      if (change !== "theme") return;
      const extra = readExtraTheme();
      if (!extra) return;
      const implied = extra === "hacker" ? "dark" : "light";
      if (resolvedTheme() !== implied) {
        applyExtraTheme(null);
        setStream(false);
      }
    });
    addEventListener("storage", onStorage);
    addEventListener(THEME_CHANGED, onLocalChange);
    return () => {
      unwatch();
      removeEventListener("storage", onStorage);
      removeEventListener(THEME_CHANGED, onLocalChange);
    };
  }, []);
  return stream ? <DataStream /> : null;
}

export const vulnhotThemesWeb: WebModule = {
  name: "vulnhot-themes",
  root: {
    bootScript: THEME_BOOT_SCRIPT,
    Bottom: ThemeEffects,
  },
  sidebar: { section: "外观", items: [{ to: "/appearance", label: "配色", icon: PaletteIcon }] },
  tools: [{ to: "/appearance", label: "配色", icon: <PaletteIcon size={16} /> }],
};
