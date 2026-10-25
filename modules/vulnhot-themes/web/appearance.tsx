import { t as translate, ui } from "@aihot/web/lib/i18n";
// /appearance：配色选择。六档：跟随系统、浅色、深夜（框架自带的三档）、黑客（幽灵绿）、黑客（血焰红）、白客（白帽蓝）。
// 点一下立即生效并记住；框架的「我的 → 深浅色」开关仍然可用，两边写的是同一组偏好。
import { useEffect, useState } from "react";
import { Kicker } from "@aihot/web/components/ui/Kicker";
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import { THEMES, type ExtraTheme } from "../palette.ts";
import { applyTheme, getThemePreference, resolvedTheme, setThemePreference } from "@aihot/web/lib/local-state";
import { applyExtraTheme, readExtraTheme } from "./client.ts";

export const handle: Screen = { tab: "me", name: "配色" };

export function meta() {
  return pageMeta({ title: translate("配色"), description: translate("VulnHOT 的配色：跟随系统、浅色、深夜，以及黑客（幽灵绿 / 血焰红）与白客（白帽蓝）三套额外配色。"), path: "/appearance" });
}

type Choice = "system" | "light" | "dark" | ExtraTheme;

const BASE: ReadonlyArray<{ key: "system" | "light" | "dark"; name: string; pitch: string; swatch: string[] }> = [
  { key: "system", name: "跟随系统", pitch: "跟着操作系统的深浅色走，白天亮、夜里暗。", swatch: ["#faf9f6", "#e9ede9", "#176b75", "#13191c"] },
  { key: "light", name: "浅色", pitch: "框架默认的纸质白，长时间读长文最省眼。", swatch: ["#ffffff", "#f3f3ef", "#176b75", "#b3402a"] },
  { key: "dark", name: "深夜", pitch: "框架默认的深色，青蓝点缀，室内灯光下最舒服。", swatch: ["#13191c", "#1a2226", "#12ccd8", "#d86a52"] },
];

function currentChoice(): Choice {
  return readExtraTheme() ?? getThemePreference() ?? "system";
}

/** 切换：额外配色只是一层覆盖；基础档交给框架自己的偏好与 applyTheme，避免两边各写一半。 */
function choose(choice: Choice): void {
  if (choice !== "system" && choice !== "light" && choice !== "dark") {
    applyExtraTheme(choice);
    return;
  }
  applyExtraTheme(null);
  const pref = choice === "system" ? null : choice;
  setThemePreference(pref);
  applyTheme(resolvedTheme(pref), pref === null);
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {colors.map((color) => (
        <span key={color} className="size-6 rounded-full ring-1 ring-inset ring-black/10" style={{ background: color }} />
      ))}
    </div>
  );
}

export default function Appearance() {
  const [choice, setChoice] = useState<Choice>("system");
  useEffect(() => setChoice(currentChoice()), []);

  const cards = [
    ...BASE.map((b) => ({ ...b, key: b.key as Choice })),
    ...THEMES.map((t) => ({ key: t.key as Choice, name: t.name, pitch: t.pitch, swatch: t.swatch })),
  ];

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-16 pt-4 lg:px-0">
      <Kicker>{translate("外观")}</Kicker>
      <h1 className="mt-3 text-[30px] font-black leading-[1.15] tracking-[-0.02em] text-ink lg:text-[34px]">{translate("换一套配色")}</h1>
      <p className="mt-2 max-w-[640px] text-[15px] leading-[1.75] text-ink-3">{translate("前三档是框架自带的基础色，后三档是本站加的：")}<span className="text-accent">{translate("幽灵绿")}</span>{translate("把整站压成终端绿，并在内容后面挂一层缓慢下落的代码流；")}<span className="text-accent">{translate("血焰红")}</span>{translate("是深蓝黑底配血焰橙红、角落带暖光晕，看仪表盘最舒服；")}<span className="text-accent">{translate("白帽蓝")}</span>{translate("换成接近白纸的冷白底配皇家蓝，像一份审计报告。选择只存在当前浏览器，不影响别人看到的样子。")}</p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => {
          const active = choice === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                choose(card.key);
                setChoice(card.key);
              }}
              aria-pressed={active}
              className={`group flex flex-col gap-3 rounded-card border p-4 text-left transition-colors ${
                active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[16px] font-bold text-ink">{ui(card.name)}</span>
                {active ? <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">{translate("使用中")}</span> : null}
              </div>
              <Swatches colors={card.swatch} />
              <p className="text-[13px] leading-[1.7] text-ink-3">{ui(card.pitch)}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 rounded-card border border-line-soft bg-surface-2 p-4 text-[13px] leading-[1.8] text-ink-3">
        <p className="font-semibold text-ink-2">{translate("两点说明")}</p>
        <p className="mt-1">{translate("黑客配色会强制使用深色底（框架的「深夜」），白客配色强制使用浅色底；在「我的」页用框架自带的深浅色开关切换时，会回到对应的基础色。")}</p>
        <p className="mt-1">{translate("数据流动画遵循系统的「减少动态效果」设置，标签页切到后台会停；不想看动画可以直接选白客。")}</p>
      </div>
    </div>
  );
}
