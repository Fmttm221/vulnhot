# VulnHOT — 漏洞情报垂直站（AIHOT 框架的行业包）

> 这个仓库是 [`KKKKhazix/AIHOT`](https://github.com/KKKKhazix/AIHOT) 的 fork，把默认的“AI 行业示例站”改造成**漏洞与攻击情报站**。
> 所有改动都发生在 `site/`（站点身份）与 `industry/`（行业包：分类、主题、信源、提示词、门槛）里，`apps/` 与 `packages/` 未改动，因此可以持续合并上游更新。
> 框架自身的能力与约定见 `README.md`、`AGENTS.md` 和 `docs/`；本文只写**本 fork 自己的东西**：读者定位、改了哪些文件、信源清单、怎么跑、还差什么。

---

## 1. 读者是谁

同时站在攻防两侧的安全从业者：

| 一侧 | 每天要回答的问题 | 对应的产品决策 |
|---|---|---|
| **防守方**（安全工程师、运维/开发负责人、应急响应） | 这个洞会不会轮到我？我现在该做什么？ | 排序看“在野利用 / KEV / 影响版本 / 补丁与缓解”；`metricUnits` 里放了“件权威源报道” |
| **攻击一侧**（渗透测试、红队、SRC、漏洞研究者） | 哪个洞现在真的有可用 PoC？目标是不是我手上的组件？复现条件苛刻吗？ | `PoC/复现` 单列一类；PoC 仓库与 nuclei 模板进信源；“利用技术”单列一类 |

两类读者共享同一份事实（编号、受影响组件与版本、利用状态、补丁），所以**分类不按攻防切，按情报形态切**：

```
在野利用 / PoC复现 / 漏洞通告 / 供应链 / 攻击事件
```

排序与打分的核心口径写死在 `industry/prompts/selection-score.md` 里，最重要的一条硬规则是：

> **不得由“高危”“严重”“紧急”“CVSS 9.8”推断出“已在野利用”“已复现”“可直接利用”。这些状态只有原文明确写出时才成立。**

这条规则同时出现在评分（`selection-score.md`）、结构化（`structure.md`）和术语翻译（`rules-domain.md`）三层，避免“严重漏洞”被改写成“已被利用”。

---

## 2. 改了什么

### 2.1 `site/`（站点身份）

| 文件 | 改了什么 |
|---|---|
| `site/site.ts` | 站名 `VulnHOT`；行业词 `漏洞`；首页/主题页标题、描述、关键词；`mcpPrefix: vulnhot`；`interfaceVersion: 1.0.0`；`crawlerName: VulnHOTBot/1.0`；出刊时间沿用 08:00 / 周一 10:00 / 每月 1 日 10:30；`REPORTS.metricUnits.firstPartyEvents` 改成“件权威源报道”；`ITEM_COPY.reasonLabel` 改成“为什么值得看”；`FEED_COPY.allLeavesOut` 写明“不含利用代码与原文全文”；关于页、分享图、Agent 接入页文案全部重写 |
| `site/brand/logo.svg`、`icon.png`、`icon-192.png`、`apple-icon.png`、`favicon.ico` | 换成 VulnHOT 自己的盾形 + 闪电标记（**不是 AIHOT 的 Logo**） |
| `site/brand/nameplates/*` | 用 `scripts/nameplates.ts` 重新生成报头字：“漏洞日报 / 漏洞周报 / 漏洞月报 / 往期日报” |
| `site/pages/terms.md`、`privacy.md` | 按漏洞情报站改写（新增“本站不提供什么”“不构成测试授权”“不托管利用代码”），**运营主体、联系方式、生效日期仍是占位符** |
| `site/changelog.json` | 上线公告改写 |

### 2.2 `industry/`（行业包，工作量主体）

| 文件 | 改了什么 |
|---|---|
| `taxonomy.ts` | 5 个类别（`exploited` / `poc` / `advisory` / `supply-chain` / `incident`）；`ITEM_TYPES` 6 类（`exploited_vuln` / `poc_release` / `vendor_advisory` / `supply_chain` / `exploit_technique` / `incident_report`）；词表：8 个分类标签 + 26 个主题标签（漏洞类型与平台）+ 16 个实体标签（厂商）；`TAG_SYNONYMS` 共 200+ 条中文变体映射；27 家厂商的 `ENTITIES`（含 `aliases`/`orgNames`/`otherNames`）、27 条 `IDENTITY_LEXICON`、27 组 `PUBLISHER_DOMAINS`；**`RELEASE = null`**（漏洞行业没有“新模型发布”这类统一发布物，报头不显示该指标）；`PLAIN_TERMS` 换成漏洞术语 |
| `topics.json` | 43 个主题，三组：厂商与组件 20、漏洞类型 15、情报形态 7 |
| `selection.ts` | 起手门槛 `T1 58 / T1_5 62 / T2 72`、`understandFloor 45`（**尚未校准**，见 §6） |
| `prompts/prefilter.md` | 宽召回地判断“是不是一个具体漏洞或攻击事件”，PASS / BLOCK / UNKNOWN 三态，UNKNOWN 保留待补材料 |
| `prompts/selection-score.md` | **核心**：读者定义换成攻防两侧；6 类内容类型与五轴权重表（`exploited_vuln` 3/1/2/2/2 … `incident_report` 3/2/2/3/0）；“必须正常评价的价值”与“必须压住的噪声”（含 `sig ≤ N` 硬上限）；新增“事件口径校正”：状态升级按实质变化评分，**简短不扣分** |
| `prompts/rules-domain.md` | 编号（CVE/GHSA/CNVD/CWE）、缩写（RCE/SSRF/LFI…）、组件与版本号、状态词（`exploited in the wild` = 已在野利用）与核心硬规则的翻译口径 |
| `prompts/structure.md` | 类别/标签/主体/scope/fact 抽取口径改成漏洞视角：动作须区分披露/确认在野利用/公开 PoC/发布补丁/更正通告；漏洞档案页与 CVE 索引页 `scope` 为 `unknown`、`fact` 为 `null` |
| `prompts/content-understanding.md` | `itemType` 6 类、标签白名单、示例改成 Apache CVE 通告 |
| `prompts/group-definitions.md` | 补一条行业判据：**同一个漏洞编号被多方报道算同一次发生** |
| `prompts/rules-self-contained-title.md`、`summarize-*.md`、`report-period.md`、`identity-context.md` | 标题写法与摘要优先保留项改成漏洞字段（编号/受影响版本/利用条件/修复版本） |
| `sources.json` | 从 123 个候选里移植 **89 个**：74 个已启用（其中 56 个做过真实抓取验证），15 个等凭据（见 §3） |


### 2.3 `modules/`（本站自己的功能，三个模块）

框架里没有的功能按框架的模块机制实现，一个功能一个 npm 包，不改 `apps/` `packages/`（唯一例外见下）。

| 模块 | 作用 |
|---|---|
| `modules/vulnhot-themes/` | 额外两套配色：**黑客（幽灵绿）** 与 **白客（白帽蓝）**，页面在 `/appearance`，侧栏与「我的」页都有入口。做法是模块在 `<head>` 注入一段先于绘制运行的脚本，给 `<html>` 打上 `data-vulnhot` 并塞入一套 CSS 变量；框架的浅色/深夜/跟随系统照旧生效，两套偏好各管各的（用框架的深浅色开关一动，就退出额外配色）。黑客配色会在内容后面挂一块 `canvas` 画缓慢下落的代码流：尊重 `prefers-reduced-motion`、标签页切到后台就停 |
| `modules/vuln-signals/` | 文章页上的**客观信号**：CVSS / EPSS / KEV 三值 + 风险画像雷达 + 进展阶段条 + 同事实的进展时间线 + 攻击面标签 + 「这条信息有误？」入口（点它会把草稿写进本站的草稿键，跳到引擎的反馈页并预填）。表 `cve_risk_signals`（迁移 `0901`；`0902` 建的 `cve_repo_counts` 已随 GitHub 计数下线，见 `0913`）；三个定时任务分别同步 CISA KEV（每 6 小时）、FIRST EPSS（每天 05:20）、NVD CVSS（每 10 分钟补 18 个，未认证 5 次/30 秒所以慢）；接口 `GET /api/site/signals/:id`。**PoC 条目数不再自己数**（GitHub 搜索有速率限制、也只覆盖 GitHub 一家），改读 `modules/vuln-pocs/` 同步的公开索引；没装那个模块时就只有 CVSS/EPSS/KEV。**只抓我们自己收录过的 CVE**（从精选标题与摘要里抽编号），不为全库付代价 |
| `modules/vuln-pocs/` | **把 pocindex 的公开利用索引内化成本站自己的数据**：一个编号一行（`poc_cve`，83k 个有公开利用的 CVE，带描述、披露日期与各类条目数）+ 每条利用一行（`poc_artifact`，13.7 万行：GitHub 仓库地址与星数、Nuclei 模板、Metasploit 模块、ExploitDB 条目、Vulhub 环境）。定时任务 `vuln-pocs.sync` 每 6 小时拉一次（传 10 MB、解开 50 MB，写库约 40 秒），索引里下架的行随之删除、规模异常时不清表。页面：`/poc` 搜索页（按编号前缀或描述关键词）、`/poc/:cve` 单条页；文章页多一块**「公开利用」**（这条资讯的 CVE 有几个仓库/模板/模块、最热的仓库在哪），侧栏与「我的」都有入口。接口 `GET /api/site/pocs/:cve` 与 `GET /api/site/pocs/search`。**CVSS/EPSS/KEV 不在这个模块存**——那三样由 `vuln-signals` 抓，单条页只是读了它的表，避免同一批数字存两份。数据来源 <https://pocindex.io>（MIT，公开 JSON、无 key、无速率限制） |
| `modules/vuln-brief/` | **每条新入选的精选**打开后的精读（原先红蓝视角的位置；不只是漏洞，被投毒、泄露这类事件同样写）：一篇 300–600 字的连通短文，像讲新闻一样把“这是什么、出了什么问题、多严重、跟我有没有关系”顺着说下来，产品/机构/工具名就地用一句话解释（Drupal Core、gitlab-onigmo-scanner 这类），**重点用 `==…==` 标在文内、页面渲染成站点主题色 `--accent`**（血焰红下是那个偏橙的红，幽灵绿是荧绿、白帽蓝是蓝），正文后面才是「我是否受影响」「现在该做什么」两串可执行条目。表 `vuln_brief`（迁移 `0906`–`0908` 重建，`0903`/`0904` 是历史）、队列 `vuln-brief.compose`、每 5 分钟挑 4 条补写，接口 `GET /api/site/brief/:id`，提示词在 `prompts/brief.md`，模型步骤名 `brief`（可用 `BRIEF_MODEL` 单独换模型）。**不是每条精选都精读**：只给最近 `WINDOW_HOURS`（12 小时）内入选、还没写过的精选写，一天最多 `MAX_PER_DAY` 条（默认 150）；更早的存量不补——这是这个模块的预算闸门；新的先写（同批里评分高、进 KEV 的靠前）。材料由本条正文 + 客观信号（CVSS/EPSS/KEV/PoC 仓库数）+ 同一事件的其他报道拼成，素材不足时输出 `caveats` 而不是补编 |

**一处框架改动（有意为之，已最小化）**：文章详情页原本没有任何模块插口，模块的部件无法挂上去。所以在 `apps/web/app/modules.ts` 加了一个通用插口 `WebModule.itemPage`，并在 `apps/web/app/routes/item.tsx` 里用十几行把它渲染在 AI 导读下面。这两处都是**通用插口**（任何模块都能用），合并上游时冲突面很小；除此之外 `apps/`、`packages/` 未改。


### 2.4 没改的东西（红线）

- `apps/`、`packages/`：除上面说的 `itemPage` 插口（2 个文件、十几行）外没有改动；其余全部落在 `site/`、`industry/`、`modules/`。
- 主题色仍用框架自带的强调色（定义在 `apps/web/app/app.css`），没有为了改品牌去动框架 CSS。
- `database/migrations/`：只加过 `0905_drop_vuln_perspective.sql`（红蓝视角下线时删除它的表），没有别的迁移。

### 2.5 `scripts/ingest-pusher.ts`（框架装不下的信源怎么接）

框架的六种信源装不下"需要 key、需要会话、只有官方 API、或者没有 RSS 的全量入口"的来源。
这个脚本干的就是那件事：抓下来，规范化成条目，推到 `POST /api/ingest/items`（框架的 `external` 信源），
之后引擎照常预筛、评分、归组、出刊——对读者和 Agent 来说与 RSS 源没有任何区别。

| 模式 | 来源 | 需要 | 说明 |
|---|---|---|---|
| `--source nvd` | NVD 2.0 API（最近修改的 CVE） | 无（`NVD_API_KEY` 选填） | 无 key 时 5 次/30 秒，脚本已按 6.2 秒间隔翻页；超过 48 小时的按回灌处理，不冲"今天" |
| `--source osv` | OSV `POST /v1/query` | `--packages` 清单或 `OSV_PACKAGES` | OSV 没有"最近更新"的全量入口，只能按你关心的组件查（`ecosystem@name@version` 一行一个） |
| `--source epss` | FIRST EPSS | 无 | 把"利用概率已经很高"的编号推成一条情报；默认阈值 0.5、上限 40 条 |
| `--source openssf` | OpenSSF 恶意包库（GitHub 提交） | `GITHUB_TOKEN` 选填 | 一个提交一条，标明来源 |
| `--source cnvd` | CNVD 列表（**骨架**） | `CNVD_COOKIE` | 站点有防护，需要浏览器里的有效会话；选择器要在真实页面上核一遍 |

用法与环境变量写在脚本开头的注释里；建议的 crontab 也在那里。**每个来源都可以 `--dry-run` 先看抓到什么再真推。**

---

## 3. 信源清单（99 个：75 个在跑、24 个暂停或等凭据）

分级：`T1` 官方一手（CVE 登记库、CERT、厂商 PSIRT）· `T1_5` 厂商研究团队与准官方 · `T2` 媒体与个人。
参与：`精选` = 进精选与全部动态；`热度` = 只作热度证据（Hacker News / Lobsters 的讨论帖）。

**A. 已启用的 75 个**（其中 68 个在移植时逐个跑过真实采集器）

| id | 名称 | 类型 | 分级 | 参与 | 间隔(分) | owner |
|---|---|---|---|---|---|---|
| `json-cisa-kev` | CISA 已知被利用漏洞目录 (KEV) | JSON | T1 | 精选 | 60 | cisa |
| `json-ghsa` | GitHub 安全公告库 (GHSA) | JSON | T1 | 精选 | 30 | github |
| `json-redhat-cve` | Red Hat CVE 数据库 | JSON | T1 | 精选 | 180 | redhat |
| `rss-debian-dsa` | Debian 安全公告 (DSA) | RSS | T1 | 精选 | 180 |  |
| `rss-drupal-security` | Drupal 安全公告 | RSS | T1 | 精选 | 180 |  |
| `rss-fortinet-psirt` | Fortinet PSIRT 公告 | RSS | T1 | 精选 | 120 | fortinet |
| `rss-github-blog-security` | GitHub 安全博客 | RSS | T1 | 精选 | 360 | github |
| `rss-ivanti-security` | Ivanti 安全公告 | RSS | T1 | 精选 | 180 | ivanti |
| `rss-jenkins-advisories` | Jenkins 安全公告 | RSS | T1 | 精选 | 180 | jenkins |
| `rss-kubernetes-security` | Kubernetes 安全公告 | RSS | T1 | 精选 | 360 | kubernetes |
| `rss-mozilla-advisories` | Mozilla 安全博客 (MFSA) | RSS | T1 | 精选 | 180 | mozilla |
| `rss-php-releases` | PHP 版本与安全修复 | RSS | T1 | 精选 | 360 |  |
| `rss-ubuntu-usn` | Ubuntu 安全公告 (USN) | RSS | T1 | 精选 | 180 |  |
| `rss-wordpress-patchstack` | Patchstack WordPress 漏洞库 | RSS | T1 | 精选 | 180 | wordpress |
| `web-apple-security` | Apple 安全更新 | 网页 | T1 | 精选 | 360 | apple |
| `web-nginx-advisories` | nginx 安全公告 | 网页 | T1 | 精选 | 360 | nginx |
| `web-openssl-advisories` | OpenSSL 安全公告 | 网页 | T1 | 精选 | 360 | openssl |
| `rss-assetnote` | Assetnote 研究 | RSS | T1_5 | 精选 | 360 |  |
| `rss-checkpoint-research` | Check Point Research | RSS | T1_5 | 精选 | 180 |  |
| `rss-cve-mitre-recent` | MITRE CVE 记录 (cvelistV5) | JSON | T1_5 | 精选 | 30 |  |
| `rss-exodusintel` | Exodus Intelligence | RSS | T1_5 | 精选 | 360 |  |
| `rss-exploit-db` | Exploit-DB 最新利用 | RSS | T1_5 | 精选 | 30 |  |
| `rss-github-security-lab` | GitHub Security Lab | RSS | T1_5 | 精选 | 360 |  |
| `rss-google-tag` | Google 安全与威胁分析 | RSS | T1_5 | 精选 | 360 |  |
| `rss-microsoft-security-blog` | 微软安全博客 | RSS | T1_5 | 精选 | 180 |  |
| `rss-msrc-update-guide` | 微软 MSRC 安全更新 | RSS | T1_5 | 精选 | 60 | microsoft |
| `rss-ncsc-uk` | 英国 NCSC 报告 | RSS | T1_5 | 精选 | 360 |  |
| `rss-nuclei-templates` | Nuclei 模板新增检测 | JSON | T1_5 | 精选 | 60 |  |
| `rss-portswigger-research` | PortSwigger 安全研究 | RSS | T1_5 | 精选 | 180 |  |
| `rss-projectdiscovery-blog` | ProjectDiscovery 博客 | RSS | T1_5 | 精选 | 180 |  |
| `rss-qualys-blog` | Qualys 威胁研究 | RSS | T1_5 | 精选 | 240 |  |
| `rss-rapid7-blog` | Rapid7 研究与公告 | RSS | T1_5 | 精选 | 180 |  |
| `rss-sans-isc` | SANS ISC 日记 | RSS | T1_5 | 精选 | 60 |  |
| `rss-securelist` | Kaspersky Securelist | RSS | T1_5 | 精选 | 180 |  |
| `rss-sonarsource-research` | SonarSource 安全研究 | RSS | T1_5 | 精选 | 360 |  |
| `rss-talos` | Cisco Talos 情报博客 | RSS | T1_5 | 精选 | 120 |  |
| `rss-tenable-blog` | Tenable 安全博客 | RSS | T1_5 | 精选 | 180 |  |
| `rss-thedfirreport` | The DFIR Report | RSS | T1_5 | 精选 | 360 |  |
| `rss-trailofbits` | Trail of Bits 博客 | RSS | T1_5 | 精选 | 360 |  |
| `rss-unit42` | Palo Alto Unit 42 | RSS | T1_5 | 精选 | 120 |  |
| `rss-watchtowr-labs` | watchTowr Labs | RSS | T1_5 | 精选 | 180 |  |
| `rss-welivesecurity` | ESET WeLiveSecurity | RSS | T1_5 | 精选 | 180 |  |
| `rss-zdi-blog` | Zero Day Initiative 博客 | RSS | T1_5 | 精选 | 240 |  |
| `rss-zdi-published` | Trend ZDI 已发布公告 | RSS | T1_5 | 精选 | 120 |  |
| `web-trendmicro-research` | Trend Micro 研究与公告 | 网页 | T1_5 | 精选 | 240 |  |
| `rss-4hou` | 嘶吼 RoarTalk | RSS | T2 | 精选 | 240 |  |
| `rss-anquanke` | 安全客 | RSS | T2 | 精选 | 60 |  |
| `rss-arstechnica-security` | Ars Technica 安全 | RSS | T2 | 精选 | 60 |  |
| `rss-csoonline` | CSO Online | RSS | T2 | 精选 | 120 |  |
| `rss-cyberscoop` | CyberScoop | RSS | T2 | 精选 | 120 |  |
| `rss-cybersecuritydive` | Cybersecurity Dive | RSS | T2 | 精选 | 120 |  |
| `rss-darkreading` | Dark Reading | RSS | T2 | 精选 | 60 |  |
| `rss-dbappsecurity-ti` | 安恒威胁情报中心 | RSS | T2 | 精选 | 240 |  |
| `rss-hackread` | Hackread | RSS | T2 | 精选 | 120 |  |
| `rss-infosecurity-magazine` | Infosecurity Magazine | RSS | T2 | 精选 | 120 |  |
| `rss-krebs` | Krebs on Security | RSS | T2 | 精选 | 360 |  |
| `rss-lobsters-security` | Lobsters · security | RSS | T2 | 热度 | 60 |  |
| `rss-nsfocus-blog` | 绿盟科技技术博客 | RSS | T2 | 精选 | 240 |  |
| `rss-paper-seebug` | 知道创宇 404 实验室 Paper | RSS | T2 | 精选 | 180 |  |
| `rss-schneier` | Schneier on Security | RSS | T2 | 精选 | 360 |  |
| `rss-secpulse` | 安全脉搏 | RSS | T2 | 精选 | 180 |  |
| `rss-securityaffairs` | Security Affairs | RSS | T2 | 精选 | 60 |  |
| `rss-seebug` | 知道创宇 Seebug 漏洞平台 | RSS | T2 | 精选 | 120 |  |
| `rss-sploitus` | Sploitus 利用聚合 | RSS | T2 | 精选 | 120 |  |
| `rss-xz-aliyun` | 阿里云先知社区 | RSS | T2 | 精选 | 120 |  |
| `web-hn-cve` | Hacker News · CVE 讨论 | JSON | T2 | 热度 | 30 |  |
| `web-hn-exploit` | Hacker News · exploit | JSON | T2 | 热度 | 60 |  |
| `web-hn-vulnerability` | Hacker News · vulnerability | JSON | T2 | 热度 | 30 |  |
| `ext-nvd-cve` | NVD 新增 CVE（外部推送） | 外部推送 | T1 | 精选 | 120 |  |
| `ext-osv` | OSV 开源漏洞库（外部推送） | 外部推送 | T1 | 精选 | 120 |  |
| `ext-epss` | FIRST EPSS 评分（外部推送） | 外部推送 | T1 | 精选 | 120 |  |
| `ext-ossf-malicious` | OpenSSF 恶意包库（外部推送） | 外部推送 | T1 | 精选 | 120 |  |
| `ext-cnvd-login` | CNVD 详情（带会话）（外部推送） | 外部推送 | T1 | 精选 | 120 |  |
| `ext-tg-security` | Telegram 安全频道（外部推送） | 外部推送 | T1 | 精选 | 120 |  |

**B. 已放进清单、等凭据后再启用的 15 个**（不填 key 就不会抓，也不会在后台变成红色失败源；填好后在后台「预览抓取」校验再启用）

| id | 名称 | 类型 | 分级 | 参与 | 间隔(分) | owner |
|---|---|---|---|---|---|---|
| `x-vxunderground` | X：vx-underground (@vxunderground) | X 账号 | T1_5 | 精选 | 60 |  |
| `x-watchtowr` | X：watchTowr Labs (@watchtowr) | X 账号 | T1_5 | 精选 | 60 |  |
| `x-projectdiscovery` | X：ProjectDiscovery (@projectdiscovery) | X 账号 | T1_5 | 精选 | 60 |  |
| `x-malwrhunterteam` | X：MalwareHunterTeam (@malwrhunterteam) | X 账号 | T1_5 | 精选 | 60 |  |
| `x-campuscodi` | X：Catalin Cimpanu (@campuscodi) | X 账号 | T1_5 | 精选 | 60 |  |
| `x-shadowserver` | X：ShadowServer (@ShadowServer) | X 账号 | T1_5 | 精选 | 60 |  |
| `mp-e5ae89e585a8` | 公众号：安全内参 | 公众号 | T2 | 精选 | 180 |  |
| `mp-e5beaee6ada5` | 公众号：微步在线研究响应中心 | 公众号 | T2 | 精选 | 180 |  |
| `mp-e5a587e5ae89` | 公众号：奇安信 CERT | 公众号 | T2 | 精选 | 180 |  |
| `mp-e995bfe4baad` | 公众号：长亭科技 | 公众号 | T2 | 精选 | 180 |  |
| `jina-qianxin-ti` | 奇安信威胁情报中心（Jina 渲染） | 网页 | T2 | 精选 | 180 |  |
| `jina-cnvd` | CNVD 漏洞公告（Jina 渲染） | 网页 | T1 | 精选 | 180 |  |
| `jina-cnnvd` | CNNVD 漏洞预警（Jina 渲染） | 网页 | T1 | 精选 | 180 |  |
| `jina-oscs` | OSCS 开源安全情报（Jina 渲染） | 网页 | T2 | 精选 | 180 |  |
| `jina-cert360` | 360CERT 安全通告（Jina 渲染） | 网页 | T2 | 精选 | 180 |  |

**验证方式**：`packages/backend/src/sources/{rss,json-list,web-list}.ts` 里真实的采集器逐个跑一遍（不是看 HTTP 200），要求抓到的条目数 > 0，并抽查标题、链接与发布时间。汇总：移植时逐个验证的 68 个全部返回条目，其中 `web-*` 这 4 个网页列表源没有列表级发布时间（框架对非回灌条目允许 `published_at` 为空，用抓取时间兜底）。

### 3.1 覆盖矩阵（对照 CVEHOT 的 8 个源）

| 维度 | CVEHOT | VulnHOT |
|---|---|---|
| 一手登记库 | CVE、GHSA | CVE（cvelistV5 commits）、GHSA、Red Hat CVE、Debian/Ubuntu/Drupal/PHP |
| 在野利用 | CISA KEV | CISA KEV、ZDI 已发布公告、Exploit-DB、Sploitus |
| 厂商公告 | 0 | **MSRC、nginx、OpenSSL、Apple、Fortinet、Ivanti、Jenkins、Kubernetes、Mozilla、WordPress(Patchstack)、GitHub**（Apache 因正文抓不到暂缺，见 §3.2） |
| PoC / 利用 | nomi-sec、trickest | nomi-sec、trickest、Metasploit 模块、nuclei 模板、Exploit-DB、Sploitus |
| 供应链 | OpenSSF | （暂缺官方恶意包源，见 §4） |
| 安全媒体 | 0 | Dark Reading、Security Affairs、CyberScoop、CSO Online、Infosecurity Magazine、Hackread、Ars Technica、Krebs |
| 厂商研究 / 情报 | 0 | Unit 42、Talos、Securelist、Check Point、watchTowr、PortSwigger、ProjectDiscovery、Trail of Bits、Assetnote、Rapid7、Qualys、Tenable、DFIR Report、WeLiveSecurity、SonarSource、Exodus、Google TAG、SANS ISC、NCSC |
| 国内源 | 0 | 先知、Seebug、404 Paper、安全客、安全脉搏、嘶吼、绿盟、安恒 |
| 社群信号 | 0 | Hacker News ×3、Lobsters（只作热度） |

### 3.2 从 123 个候选里剔除的 55 个（含原因）

**A. 本机实测抓不到，暂不纳入**（换网络/在服务器上用后台“预览抓取”复验后再加回来）：

| id | 现象 |
|---|---|
| `bleepingcomputer`、`securityweek`、`the-record`、`flashpoint`、`sentinelone-labs` | Cloudflare / WAF 对 Node 抓取端返回 403（同一地址用 .NET 抓是 200，属于 TLS 指纹差异，不是地址失效） |
| `thehackernews`(feedburner)、`chrome-releases`、`google-project-zero`、`google-online-security`、`citizenlab`、`gitlab-security`、`intel471`、`recorded-future` | 本机 HTTPS 连接被重置（ECONNRESET），属网络可达性问题 |
| `helpnetsecurity` | 返回 202（人机校验页） |
| `reddit-*`（4 个版块） | reddit.com JSON 接口对本机返回 403 / 连接重置 |
| `oracle-cpu` | 403 |
| `qianxin-ti` | 条目链接由 JS 生成，列表里没有 `href`，网页列表采不到 URL |
| `apache-httpd` | 列表本身能抓到 180 条（标题里带严重级别与编号），但条目链接指向 `cve.org` 的 JS 渲染记录页，正文抓不到；等写 `external` 脚本把 `dd` 里的详情推上来再接回来 |


**B. 上游那个 Python 项目里本身就是停用状态**（自身地址失效 / 需要登录态 / 需要前端渲染；共 25 个，含 `nvd-recent`、`osv-dev`、`epss-first`、`cnvd`、`cnnvd`、`freebuf`、`atlassian-security`、`cisco-security`、`vmware-security`、`android-bulletin`、`suse-security`、`packetstorm`、`cisa-advisories`、`mandiant`、`sophos-news`、`dragos-blog`、`claroty-research`、`ssd-disclosure`、`enisa`、`hackerone-hacktivity`、`bugcrowd-disclosures`、`oscs1024`、`cert360`、`chaitin-blog`、`aqniu`、`threatbook`、`sangfor-ti`、`mastodon-infosec`、`bluesky-cve`、`vulncheck-kev`、`github-poc-search`）。

**C. 需要单独写采集脚本的**（框架的六种信源装不下，留给模块阶段）：
`nvd-recent`（NVD 2.0 的 `descriptions` 是数组，`json_list` 的点路径取不到；官方无 RSS）、`osv-dev`（`POST /v1/query`）、`epss-first`（只是评分，没有文章实体）。这三者属于风险信号模块（CVSS/EPSS/KEV 结构化数值）的数据源，不该进“文章”流水线。

### 3.3 上线后的实测调整（GitHub 提交流）
初次批量采集后改了三处，已回写 `sources.json` 并同步到库里：

1. **GitHub 提交流原来用 `commits.atom`（github.com），上线后连续超时 / 连接被重置**，而 `api.github.com` 一直正常。所以 `cvelistV5`、`nuclei-templates` 两个源改成 `json_list`，直接打 `https://api.github.com/repos/<repo>/commits?per_page=30`：`titlePaths` 与 `summaryPaths` 都取 `commit.message`，并设 `summaryIsBody: true`，这样不必再去抓 github.com 的提交页正文。
2. **另外三个提交流（nomi-sec/PoC-in-GitHub、metasploit-framework、trickest/cve）已移除**：它们的提交信息是 “Auto Update README.md” 这类机械文本，当文章标题没有价值。**“某个 CVE 到今天一共有多少个 PoC 仓库”这类信号属于阶段 D 的 `cve-repo-index` 模块**（按编号建索引），不该硬塞进文章流水线。
3. **CISA KEV 仍然偶发超时**（cisa.gov 时快时慢：同一地址 .NET 抓 1.5 秒、Node 抓 20 秒以上）。源保留，失败会自动重试并计入健康度；抓到即入库。

### 3.4 信源复审：从“广度优先”转成“质量优先”

运行约两天后，按**实际 token 成本与真实产出**把 74 个启用源审了一遍（数据来自 `receipts` 与 `publications`，不是凭感觉）：

> 25.89M 打分 tokens 里，**12.57M（49%）来自“一条精选都没产出”的源**，16.24M（63%）来自“产出 ≤1 条”的源。

因此停用 9 个源（启用 74 → 65，省掉 43% 的打分预算），原因写在各条目的 `_off_reason` 里：

| 源 | 消耗 | 产出 | 停用理由 |
|---|---:|---:|---|
| `web-apple-security` | 6.00 M | 0 | 更新日志式长文，与 CVE 通告重复，占 23% 预算 |
| `json-redhat-cve` | 2.06 M | 1 | 登记库镜像，与 NVD/GHSA 重复 |
| `rss-cve-mitre-recent` | 1.97 M | 0 | 登记库镜像，均分 10.6 |
| `rss-nuclei-templates` | 0.61 M | 1 | 检测模板不是情报，均分 10.5 |
| `rss-darkreading` / `rss-xz-aliyun` / `rss-debian-dsa` / `rss-paper-seebug` / `rss-msrc-update-guide` | 0.62 M | 0 | 正文抽取 100% `unconfirmed`（付费墙/反爬），模型只能凭标题猜 |

另外 `rss-sploitus` 的抓取间隔统一为 120 分钟（聚合器单价约 158k tokens / 条精选）。**这不是“永久删除”**：登记库的结构化价值（CVSS/EPSS/引用计数）继续由 `vuln-signals` 自己同步，不依赖它们产文章；抓取器按站点修好后可以重新启用。

### 3.5 境外信源与出网代理

大陆网络下有两类抓不到，原因不同、解法也不同：

| 类型 | 站点 | 现象 | 解法 |
|---|---|---|---|
| GFW 丢包 | `security.googleblog.com`、`feeds.feedburner.com`、`r.jina.ai`、`api.telegram.org` | 超时 / connection reset | 任意非大陆出口 |
| Cloudflare 托管挑战 | `bleepingcomputer.com`、`securityweek.com`、`therecord.media` | 403 + `cf-mitigated: challenge`，标题 `Just a moment...` | IP 信誉好的出口（住宅节点，或部分日本/台湾/美国机房节点） |
| 工作量证明人机页 | `theregister.com` | 标题 `Are we human?` | 放弃，同题材由 Talos/ZDI/SANS/Krebs 覆盖 |

做法：在本机跑一个 mihomo 本地出口（`127.0.0.1:7890`，配置文件里只留 `mixed-port` + 一个 `url-test` 组 + `MATCH` 规则，不启用 redir-port/fake-ip），后端 `EGRESS_PROXY_URL` 指向它；
同时把**已实测能直连的 60 个主机**写进 `site/site.ts` 的 `DEPLOYMENT.directFetchHosts`，只有必须出境的请求才走代理。
这样机场流量只花在必须的地方，共享出口 IP 被限流也不影响主站。两个反例：`api.github.com` 走代理会被限流（403），
`api.anquanke.com` 走代理直接连不上（000），所以它们必须在直连名单里。

新增的信源（The Hacker News、BleepingComputer、SecurityWeek、The Record、Google Online Security Blog）都靠这条路抓。
节点掉线由本地进程的守护与探活兜底；具体配置随部署环境而定，不属于本仓库的一部分（`deploy/` 已在 `.gitignore` 里）。

---

## 4. 还差什么（按优先级）

1. **模型 key 已填、两个安全阀已打开**（`LLM_*` 指向 `deepseek-flash`，`COLLECT_ENABLED` / `MODEL_CALLS_ENABLED` = true）。但 worker 必须常驻才会采集与出刊：本机 `npm run dev:worker`，或 `docker compose up -d`。
2. **门槛校准**（阶段 C）：从已入库资料里挑 100–200 条人工标“该选/不该选”存成 `.data/gold.jsonl`，然后
   `node --env-file=.env scripts/eval-selection.ts --gold .data/gold.jsonl`，
   在后台 SelectBench 逐条看判错的，改 `selection-score.md` 或门槛再跑。现在的 58/62/72 只是起手值。
3. **条款与隐私说明、域名、备案号**（`site/pages/`、`site.ts` 的 `icp`/`psb`）需要本人确认后填写。
4. **供应链官方源**：OpenSSF 恶意包库（`ossf/malicious-packages`）的 commits atom 与 npm/PyPI 公告尚未接入。
5. **阶段 D 的 P0 模块**（`risk-signal` → `asset-match` → `fast-alert`）：本次只做了 A+B+C。做完 D 才是“资产风险感知与告警平台”，与“漏洞新闻站”的区别就在这一步。

---

## 5. 怎么跑

### 5.1 本机开发（不用 Docker）

```bash
node scripts/init-env.ts                 # 生成 .env（管理员密码会打印一次）
# 在 .env 里填 LLM_API_KEY（以及 LLM_BASE_URL / LLM_MODEL）
# 本机跑需要数据库，.env 里加一行：
#   DATABASE_URL=postgres://user:pass@127.0.0.1:5432/vulnhot

node --env-file=.env scripts/migrate.ts  # 建表
node --env-file=.env scripts/seed.ts     # 导入 industry/sources.json 的 71 个信源

npm run dev:api                          # 8646 之外的 3001 端口
npm run dev:worker
npm run dev:web                          # http://127.0.0.1:3000
```

### 5.2 Docker

```bash
docker compose up -d --build             # http://localhost:3000，后台 /admin
```

首次启动会跑迁移并导入示范信源；第一次全量采集大约半小时处理完。

### 5.3 改完必跑

```bash
npm run typecheck
DATABASE_URL=postgres://…/<库名>_test npm test    # 库名必须以 _test 或 _ci 结尾
node scripts/smoke.ts --base http://localhost:3000
```

---

## 6. 待本人决定的事（不要替你拍板）

1. **站名与 `mcpPrefix`**：现在是 `VulnHOT` / `vulnhot`（上线后有人接入就不能改）。
2. **门槛与读者权重**：门槛 58/62/72 是起手值；如果读者更偏渗透侧或更偏防守侧，`selection-score.md` 的“必须正常评价的价值”要调。
3. **信源取舍**：§3.2 里 20 个实测失败的高价值源（尤其 The Hacker News、BleepingComputer、Reddit）要不要在服务器上复验并加回来。
4. **分类**：5 类是否够用（要不要拆出“漏洞预警”“补丁”）——注意类别的 `key` 会进网址与接口，上线后不能改。
5. **条款与隐私说明的正式内容**、域名、ICP/PSB 备案号。
6. **阶段 D 做不做**（资产比对 + 快车道告警），以及资产清单从哪来、告警发到哪里。
7. **预算上限**（模型 API + X + 公众号 + Jina）。

---

## 7. 与上游的关系

- fork 自 `KKKKhazix/AIHOT`（MIT）。站点名称与 Logo 是本仓库自己的，不使用 AIHOT 的名称与 Logo（见 `NOTICE`）。
- 合并上游更新：

```bash
git remote add upstream https://github.com/KKKKhazix/AIHOT.git
git fetch upstream && git merge upstream/main
```

  冲突应集中在 `site/` 与 `industry/`；如果出现在 `apps/` 或 `packages/`，说明有人动了框架代码，按红线回退。
- 框架相关的问题先读 `docs/`（`customize.md`、`sources.md`、`selection.md`、`architecture.md`、`deploy.md`）。
