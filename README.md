# VulnHOT — 漏洞情报热点站

<p align="center">
  <b>每天自动采集全球漏洞情报、用模型判断并写作、把同一个漏洞的多方报道归成一个事件、按“今天要不要动手”排序，出日报。</b><br>
  网页 · RSS · 公开 API · MCP · llms.txt，同时服务于人和 Agent。
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-176b75?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Node.js-24-176b75?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 24">
  <img src="https://img.shields.io/badge/PostgreSQL-17-176b75?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 17">
  <img src="https://img.shields.io/badge/Docker-Compose-176b75?style=flat-square&logo=docker&logoColor=white" alt="Docker Compose">
</p>

**面向读者**：同时站在攻防两侧的安全从业者。守方要回答“这个洞会不会轮到我、现在该做什么”，渗透测试与红队要回答“哪个洞现在真有能用的 PoC、目标是不是我手上的组件”。

> 本仓库是 [`KKKKhazix/AIHOT`](https://github.com/KKKKhazix/AIHOT)（MIT）的 fork：`apps/`、`packages/` 一行未改，改造全部落在 `site/`（站点身份）与 `industry/`（行业包：分类、主题、信源、提示词、门槛），因此可以持续合并上游更新。
>
> **本 fork 自己的东西——读者定位、改动清单、71 个实抓验证过的信源、怎么跑、还差什么——都在 [`VULNHOT.md`](VULNHOT.md)。**
> 框架约定见 [`AGENTS.md`](AGENTS.md)，框架文档见 [`docs/`](docs/)，上游英文说明见 [`README.en.md`](README.en.md)。

---

## 它做什么

```
信源 → 采集(判重·抓原文) → 预筛 → 独立两次评分 → 写作 → 结构化 → 归组(事件·热度)
                                                          ↓
                                    公开读取层 publication/（单一出口）
                                                          ↓
                        日报 · 周报 · 月报 · 网页 · RSS · API v1 · MCP · llms.txt · 站点地图
```

- **判重**：URL、标题指纹、正文重合多层判重。
- **双次独立评分**：同一份标准独立打两次分，两次之和 ≥ 2×门槛才入选，抗单次评分抖动。
- **事件聚簇**：向量召回候选 → 模型判定“同一次发生 / 后续进展 / 两件事” → 写入前二次复核。**同一个漏洞编号被多方报道算同一次发生。**
- **热度算法**：按事件而非文章计算；48 小时内每个独立来源只计一次、24 小时减半。
- **日报不调模型**：纯规则编排；周报月报从日报汇编，模型只写总述。
- **Agent 原生**：MCP 工具、`/api/v1/agent`、`llms.txt`、Agent Markdown。

## 漏洞行业的判断口径（本 fork 的核心）

- **分类**：在野利用 / PoC/复现 / 漏洞通告 / 供应链 / 攻击事件。
- **五轴打分**：`sig` 实质份量、`nov` 信息增量、`cred` 证据强度、`reson` 影响面、`act` 可处置性，按 6 类内容类型给不同权重。
- **硬规则**：不得由“高危”“严重”“紧急”“CVSS 9.8”推断出“已在野利用”“已复现”“可直接利用”——这些状态只有原文明确写出时才成立。
- **简短不扣分**：CISA KEV 新增一条、厂商一句“已确认在野利用”、一个只有编号和受影响版本的 PoC 仓库，都是最短也最有用的材料。

## 快速开始

```bash
# 1) 生成 .env（会打印一次管理员密码）
node scripts/init-env.ts

# 2) 在 .env 里填模型：LLM_BASE_URL / LLM_API_KEY / LLM_MODEL（任何 OpenAI 兼容接口）

# 3) 启动（需要 Docker）
docker compose up -d --build        # http://localhost:3000，后台在 /admin
```

开发时把 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED` 关掉，只跑本地数据；不用 Docker 的本机跑法与验收命令见 [`VULNHOT.md`](VULNHOT.md) 第 5 节。

## 部署前必做的两件事

1. **改条款与隐私说明**：`site/pages/terms.md`、`site/pages/privacy.md` 是模板，运营主体、联系方式、生效日期必须由运营者本人确认后填写（必要时请专业人士审阅）。
2. **校准入选门槛**：`industry/selection.ts` 里的 58/62/72 是起手值，要用自己标注的样本跑 `scripts/eval-selection.ts` 重新校准，否则“选得准不准”没有依据。

## 目录

| 位置 | 内容 |
|---|---|
| `site/` | 站名文案 `site.ts`、逐步模型 `models.ts`、品牌 `brand/`、条款页 `pages/`、根目录固定文件 `public/`、更新日志 `changelog.json` |
| `industry/` | 分类标签 `taxonomy.ts`、主题 `topics.json`、示范信源 `sources.json`、提示词 `prompts/`、门槛 `selection.ts` |
| `modules/<名字>/` | 本站专属功能（一个功能一个 npm 包） |
| `apps/api` `apps/worker` `apps/web` | Fastify 接口 · 定时任务与队列 · React Router SSR（**不改**） |
| `packages/backend` `packages/contracts` | 业务实现与共享类型（**不改**） |
| `database/migrations/` | 数据库迁移，按完整文件名排序执行 |

## 许可与致谢

代码 MIT（见 [`LICENSE`](LICENSE)）。引擎来自 [AIHOT](https://github.com/KKKKhazix/AIHOT)；AIHOT 的名称与 Logo 不在其 MIT 授权范围内，本仓库使用自己的名称与图标（见 [`NOTICE`](NOTICE)）。站内展示的标题与摘要由模型根据公开来源生成，原文版权归各来源所有；本站不托管、不分发漏洞利用代码。
