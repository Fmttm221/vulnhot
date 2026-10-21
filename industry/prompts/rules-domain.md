
【漏洞与安全领域翻译规则 — 本平台 100% 是漏洞情报、攻击与防御的安全内容，严格遵守】

## 1. 编号与标识一律保留英文原文

不翻译、不改写、不省略、不补零：`CVE-2026-12345` / `GHSA-xxxx-xxxx-xxxx` / `CNVD-2026-12345` / `CNNVD-202610-1234` / `CWE-79` / `CAPEC-123`。
**规则：任何形如 `XXX-YYYY-NNNN` 的编号一律照抄，绝不省略年份、绝不补零、绝不改写成中文。**

`CVSS 3.1` / `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` 一字不改，向量串不拆开、不翻译成中文。

机构与项目名保留英文：`CISA` / `KEV` / `NVD` / `OSV` / `EPSS` / `MITRE` / `NVD` / `CNVD` / `CNNVD` / `CNA` / `PSIRT` / `CERT` / `CNCERT`。

## 2. 安全缩写保留英文

`RCE` / `XSS` / `SSRF` / `CSRF` / `LFI` / `RFI` / `SQLi` / `XXE` / `DoS` / `DDoS` / `UAF` / `OOB` / `SSTI` / `IDOR` / `PoC` / `EXP` / `IOC` / `TTP` / `C2` / `EDR` / `XDR` / `WAF` / `RASP` / `SIEM` / `0day` / `1day` / `Nday`。

歧义默认值：
- `PoC` = 概念验证程序，**绝不译成“警察”**；`PoC available` = 已有公开 PoC。
- `EXP` = 漏洞利用程序，不是“经验值”。
- `exploit` 作名词是“利用程序 / 利用代码”，作动词是“利用”，**绝不译成“开发”“开发票”“利用（劳动）”**。
- `patch` = 补丁；`workaround` = 规避方案；`mitigation` = 缓解措施；`advisory` = 通告。
- `bypass` = 绕过；`elevation of privilege` = 提权；`sandbox escape` = 沙箱逃逸。
- `disclosure` = 披露；`responsible disclosure` = 负责任披露。

## 3. 组件与厂商名保留英文原名

不意译、不音译；版本号一字不改（`2.4.49` 不写成“2.4.49 版本”，`17.9.4a` 不写成“第 17.9.4a 版”，`V2` 不写成“第 2 版”）。

厂商与产品举例（不限于此，凡是产品名一律保留英文）：`Windows` / `Exchange` / `SharePoint` / `Chrome` / `Android` / `vCenter` / `ESXi` / `Confluence` / `Jira` / `WebLogic` / `Tomcat` / `Struts` / `Log4j` / `FortiGate` / `FortiOS` / `Connect Secure` / `PAN-OS` / `GlobalProtect` / `NetScaler` / `BIG-IP` / `kubelet` / `ingress-nginx` / `Jenkins` / `OpenSSL` / `nginx` / `Apache HTTP Server`。

中国厂商优先用官方中文名（首次出现可双标）：奇安信 / 绿盟 / 深信服 / 安恒 / 微步 / 长亭 / 火绒 / 360 / 腾讯安全 / 阿里云安全 / 知道创宇。

## 4. 状态词固定译法与本领域的核心硬规则

固定译法：
- `exploited in the wild` = 已在野利用；`proof of concept available` = 已有公开 PoC。
- `unauthenticated` / `pre-auth` = 无需认证；`remote` = 远程；`adjacent` = 邻近网络；`local` = 本地。
- `patch available` = 已发布补丁；`no fix yet` = 暂无补丁；`mitigation` = 缓解措施；`workaround` = 规避方案。
- `actively exploited` = 已被利用；`targeted exploitation` = 定向利用。
- `end of life` = 已停止支持；`unsupported` = 不再维护。

**核心硬规则（贯穿标题、摘要与推荐理由）：**
- 只有原文明确写出时，才能使用“已在野利用”“已复现”“可直接利用”“无需认证”“影响默认配置”这些状态。
- **不得由“高危”“严重”“紧急”“CVSS 9.8”推断出上述任何一种状态。** “严重”只说明评分高，不说明有人用过它。
- 原文说“潜在可利用”“理论上可以”，就必须保留这个不确定性，不能改写成肯定的“可被利用”。
- 原文说“补丁已发布”但没说是否被利用，就不能写成“已被利用后紧急修复”。

## 5. 代码、命令、URL、数字与版本区间一字不改

- 反引号代码、payload、HTTP 报文、Shell 与 SQL 片段不翻译、不省略、不美化。
- 命令（`curl -I`、`nmap -sV`）与 URL 原样保留。
- CVSS 分数保留原值（`9.8` 不写成“接近满分”“接近 10 分”）。
- 影响版本区间保留原样（`2.4.49 – 2.4.50`、`< 8.5.5`、`>= 7.0, < 7.6` 不要改写成“多個版本”或“多个较早版本”）。
- 时间、期限（如 KEV 的修复截止日期）按原文明示的日期写法保留，不换算、不模糊成“近期”。
