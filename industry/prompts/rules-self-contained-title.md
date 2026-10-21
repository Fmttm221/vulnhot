
【标题自洽规则 — 让读者不点开就知道"这是关于谁的什么事"】

1. 标题必须点出核心主体：漏洞编号（CVE/GHSA/CNVD）、受影响产品与厂商名、项目或工具名。有编号就把编号写进标题。
2. 原标题已经清楚点出主体的：英文标题翻译成中文、中文标题保持原意，不要为改写而改写。
3. 原标题只是版本号 / 代号 / 没信息量的 teaser（如 "v2.1.159"、"Small is a feature"、"Day 1"、"重磅发布"）时，结合【来源】和正文把主体补进标题。例：原标题 "Security Notice" + 来源 "Apache HTTP Server 安全通告" + 正文提到 CVE-2021-42013 → "Apache HTTP Server 修复 CVE-2021-42013"。
4. 补主体只能用【来源】或正文里真实出现的名字。正文和来源都没点出具体型号时，用上位词（如"某网络设备厂商")兜底，绝不凭"行业常识"编一个具体型号 / 版本 / 数字。
5. 原标题表达的【文章类型和核心动作】是硬边界：How / Why / Guide / Analysis / Review / Benchmark 这类解释、分析、教程或评测标题，中文标题必须保留这个类型；不能因为正文谈到一个已经存在的漏洞或组件，就改写成“披露 / 确认在野利用 / 公开 PoC”。只有原标题明确宣布了发布、推出、上线或开源，中文标题才能使用对应动作。保留文章类型不等于删主体：仍须按第 1-4 条补全正文或来源明确给出的厂商、产品与漏洞编号。
   例：原标题 "Chaining two bugs into pre-auth RCE on FortiGate" → "FortiGate 两个漏洞串联实现免认证 RCE 的复现思路"，不能写成 "Fortinet 修复免认证 RCE 漏洞"。
   例：原标题 "Detecting CVE-2024-3400 exploitation with Sigma" + 来源和正文明确是 Palo Alto GlobalProtect → "用 Sigma 规则检测 GlobalProtect CVE-2024-3400 利用"，不能只写成缺主体的 "如何写检测规则"。
6. 本条的动作和背景里的旧发布要分清：原文把发布写成过去的事（“At DevDay, we introduced …”“Last week we launched …”“上周我们发布了…”），本条是在讲用法、做演示或再次推广时，标题写介绍、演示或讲解，把发布交代成此前的事；不能写成“推出 / 发布 / 上线”，否则读者会当成今天的新闻。只有原文明确某项能力是现在才开放或新增，才对那一项用对应动作。
   例：正文 "Earlier this year we patched this in 8.5.5 … here is how the bypass works" → "Confluence 8.5.5 补丁的绕过思路分析"，不能写成 "Atlassian 修复 Confluence 认证绕过"。
