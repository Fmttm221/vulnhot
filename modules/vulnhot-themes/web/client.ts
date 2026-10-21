// 浏览器一侧：应用/读取额外配色。放在 web/ 下，由网页的 tsconfig（带 DOM）检查；
// palette.ts 只放数据与 CSS，后端与构建两侧都能安全导入。
import { PALETTE_CSS, THEME_KEY, type ExtraTheme } from "../palette.ts";

const STYLE_ID = "vulnhot-theme-style";

/** 切换配色后广播给页面上的其他部件（数据流背景等）。 */
export const THEME_CHANGED = "vulnhot-theme-changed";

/** 在浏览器里切换配色：同时写本站偏好与框架的深浅色偏好，让两边的开关显示一致。 */
export function applyExtraTheme(pref: ExtraTheme | null): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  try {
    if (!pref) {
      localStorage.removeItem(THEME_KEY);
      html.removeAttribute("data-vulnhot");
      document.getElementById(STYLE_ID)?.remove();
      window.dispatchEvent(new Event(THEME_CHANGED));
      return;
    }
    localStorage.setItem(THEME_KEY, pref);
    localStorage.setItem("aihot-theme", pref === "hacker" ? "dark" : "light");
    html.setAttribute("data-theme", pref === "hacker" ? "dark" : "light");
    html.setAttribute("data-vulnhot", pref);
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = PALETTE_CSS;
    window.dispatchEvent(new Event(THEME_CHANGED));
  } catch {
    /* 隐私模式下写不了 localStorage：这一次仍然生效 */
  }
}

/** 当前生效的额外配色（读不到或没设就是 null）。 */
export function readExtraTheme(): ExtraTheme | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "hacker" || value === "whitehat" ? value : null;
  } catch {
    return null;
  }
}
