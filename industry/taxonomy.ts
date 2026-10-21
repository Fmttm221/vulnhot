// 这个行业的分类体系：类别、标签词表、厂商（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。
//
// VulnHOT 的读者是同时来自防守与攻击两侧的安全从业者：
//   · 防守方（安全工程师、运维/开发负责人、应急响应）要回答“这个洞会不会轮到我、我现在该做什么”
//   · 渗透测试与红队要回答“哪个洞现在有可用的 PoC、目标是不是我手上的组件、能不能复现”
// 两类读者共享同一份事实（编号、影响版本、利用状态、补丁），所以分类不按“攻击/防守”切，按情报形态切。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类（教程、观点）：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * tagColor 是飞书推送卡片里跟在标题后面的这一类小标签的颜色（飞书 text_tag 的颜色名）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "exploited", tagColor: "red", label: "在野利用", feedLabel: "在野利用", section: "在野利用与紧急修补", guide: "已确认被在野利用、已列入 CISA KEV、已被大规模扫描攻击，或厂商明确证实有真实攻击的漏洞与攻击活动。只有原文明说被利用才算，不能由“高危”“严重”推断。" },
  { key: "poc", tagColor: "carmine", label: "PoC/复现", feedLabel: "PoC 与复现", section: "已公开 PoC 与复现", guide: "公开了 PoC、EXP、检测模板（nuclei 等）、复现步骤或完整利用细节的漏洞。仓库里出现可运行的利用代码、或新增了对应检测模板都算；只讨论“可能可以这样打”而没有落地代码的，第一条用“利用技术”。" },
  { key: "advisory", tagColor: "blue", label: "漏洞通告", feedLabel: "漏洞通告与补丁", section: "漏洞通告与补丁", guide: "厂商、CERT、CNA、GitHub 安全公告库等发布的漏洞通告、补丁、影响版本说明与安全更新。通告里附带缓解措施或补丁仍归这里；通告同时说明已被在野利用时归“在野利用”。" },
  { key: "supply-chain", tagColor: "orange", label: "供应链", feedLabel: "供应链与依赖风险", section: "供应链与依赖风险", guide: "开源仓库投毒、恶意包、依赖混淆、typosquatting、构建与发布凭证被滥用、镜像与 CI 供应链被入侵的风险与事件。单个开源项目出现普通代码漏洞不算供应链，按通告归。" },
  { key: "incident", tagColor: "violet", label: "攻击事件", feedLabel: "攻击事件与应急", section: "攻击事件与应急", guide: "已发生的真实攻击、勒索、数据泄露、APT 行动，以及应急响应、处置复盘与事后调查。攻击者利用哪个漏洞可以作为背景，但本条的重心是攻击行动本身。" },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布（AI 行业是“新模型”）：日报报头的“N 个新模型”、改分类后修订已出的报告都按它数。
 * category 是类别，tag 是标签，两者都对上才算；unit 接在数字后面。
 * 漏洞行业没有统一的“发布物”，设成 null，报头不显示这个数。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = null;

/** 周报月报的总述可以直接写、不必在报道里找到出处的行业通用词（小写）。站名会自动算进去。 */
export const PLAIN_TERMS: readonly string[] = [
  "cve", "cnvd", "cnnvd", "ghsa", "cwe", "capec", "cvss", "kev", "epss", "nvd", "osv", "cisa", "mitre", "cnnvd",
  "poc", "exp", "exploit", "0day", "1day", "nday", "waf", "rasp", "edr", "xdr", "siem", "soar", "ioc", "ttp", "c2", "apt",
  "rce", "lfi", "rfi", "xss", "csrf", "ssrf", "sqli", "xxe", "dos", "ddos", "uaf", "oob", "ssti", "idor",
];

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = ["exploited_vuln", "poc_release", "vendor_advisory", "supply_chain", "exploit_technique", "incident_report"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一（最后一个“其他”是模型漏标时的兜底）。 */
export const CATEGORY_TAGS = [
  "在野利用", "PoC/复现", "漏洞通告", "补丁/修复", "供应链", "攻击事件", "利用技术", "其他",
] as const;

/** 可选的主题标签：漏洞类型与受影响平台。 */
export const TOPIC_TAGS = [
  "RCE", "提权", "认证绕过", "反序列化", "注入", "文件读写", "SSRF", "内存破坏", "逻辑缺陷", "免认证", "无需交互",
  "Linux", "Windows", "macOS", "浏览器", "Java", "PHP", "Python", "Node.js", "容器/K8s", "网络设备", "VPN/网关",
  "中间件", "数据库", "云服务", "AI/大模型",
] as const;

/** 可选的实体标签（厂商、机构、平台）。 */
export const ENTITY_TAGS = [
  "Microsoft", "Google", "Apple", "Apache", "Cisco", "Fortinet", "Ivanti", "VMware", "Atlassian", "Oracle",
  "WordPress", "Jenkins", "Kubernetes", "Linux 内核", "GitHub", "CISA",
] as const;

/**
 * 模型常写的近义词，统一成词表里的写法。必须写全：
 * 模型会把“远程代码执行”“权限提升”“SQL注入”等中文变体直接当标签输出，不映射就进不了主题页。
 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  // 分类标签
  在野利用: "在野利用", 已被利用: "在野利用", "已遭利用": "在野利用", 实际利用: "在野利用", 真实攻击: "在野利用",
  exploited: "在野利用", "in-the-wild": "在野利用", kev: "在野利用", "cisa kev": "在野利用",
  poc: "PoC/复现", "poc/exp": "PoC/复现", 概念验证: "PoC/复现", 复现: "PoC/复现", exp: "PoC/复现", 漏洞利用代码: "PoC/复现",
  "proof-of-concept": "PoC/复现", poc发布: "PoC/复现", "poc公开": "PoC/复现",
  漏洞通告: "漏洞通告", 安全公告: "漏洞通告", 安全更新: "漏洞通告", 安全通告: "漏洞通告", 公告: "漏洞通告",
  advisory: "漏洞通告", 漏洞预警: "漏洞通告", 预警: "漏洞通告", "cve发布": "漏洞通告",
  补丁: "补丁/修复", 修复: "补丁/修复", 漏洞修复: "补丁/修复", 热修复: "补丁/修复", patch: "补丁/修复", 更新: "补丁/修复",
  供应链: "供应链", 供应链攻击: "供应链", 恶意包: "供应链", 投毒: "供应链", 依赖混淆: "供应链", 组件投毒: "供应链",
  "supply-chain": "供应链", "供应链安全": "供应链", 开源投毒: "供应链",
  攻击事件: "攻击事件", 安全事件: "攻击事件", 数据泄露: "攻击事件", 勒索: "攻击事件", 勒索软件: "攻击事件",
  incident: "攻击事件", 入侵: "攻击事件", 攻击活动: "攻击事件", apt: "攻击事件", 应急响应: "攻击事件",
  利用技术: "利用技术", 利用链: "利用技术", 绕过手法: "利用技术", 漏洞利用技术: "利用技术", 利用分析: "利用技术",
  "exploit technique": "利用技术", 利用方法: "利用技术", 攻击技术: "利用技术",
  其他: "其他", 安全资讯: "其他", 综合: "其他",

  // 主题标签：漏洞类型（键不能与词表里的标签同名，否则会把正确答案改掉）
  远程代码执行: "RCE", "代码执行": "RCE", rce漏洞: "RCE", 命令执行: "RCE", "任意代码执行": "RCE",
  提权: "提权", 权限提升: "提权", 本地提权: "提权", 特权提升: "提权", "提权漏洞": "提权", privilege: "提权",
  认证绕过: "认证绕过", 鉴权绕过: "认证绕过", 授权绕过: "认证绕过", 身份认证绕过: "认证绕过", 绕过认证: "认证绕过",
  反序列化: "反序列化", "反序列化漏洞": "反序列化", deserialization: "反序列化",
  注入: "注入", "sql注入": "注入", sqli: "注入", "sql 注入": "注入", 命令注入: "注入", 模板注入: "注入",
  ssti: "注入", xss: "注入", 跨站脚本: "注入", xxe: "注入", xxe注入: "注入", ldap注入: "注入", crlf注入: "注入",
  文件读写: "文件读写", 任意文件读取: "文件读写", 任意文件写入: "文件读写", 路径穿越: "文件读写", 目录穿越: "文件读写",
  目录遍历: "文件读写", 文件上传: "文件读写", 任意文件下载: "文件读写", 文件包含: "文件读写", lfi: "文件读写", rfi: "文件读写",
  服务端请求伪造: "SSRF", csrf: "SSRF",
  内存破坏: "内存破坏", 缓冲区溢出: "内存破坏", 堆溢出: "内存破坏", 栈溢出: "内存破坏", uaf: "内存破坏",
  释放后使用: "内存破坏", 越界写: "内存破坏", 越界读: "内存破坏", 整数溢出: "内存破坏", oob: "内存破坏",
  逻辑缺陷: "逻辑缺陷", 逻辑漏洞: "逻辑缺陷", 业务逻辑漏洞: "逻辑缺陷", idor: "逻辑缺陷", 越权: "逻辑缺陷",
  免认证: "免认证", 未授权: "免认证", 未授权访问: "免认证", 无需认证: "免认证", unauthenticated: "免认证",
  无需交互: "无需交互", 无交互: "无需交互", 无需用户交互: "无需交互",

  // 主题标签：平台与生态
  内核: "Linux", win: "Windows", 微软windows: "Windows", 苹果系统: "macOS",
  浏览器: "浏览器", chrome: "浏览器", firefox: "浏览器", edge: "浏览器", safari: "浏览器",
  spring: "Java", wordpress插件: "PHP", django: "Python", flask: "Python",
  nodejs: "Node.js", npm: "Node.js",
  容器: "容器/K8s", k8s: "容器/K8s", docker: "容器/K8s", "容器安全": "容器/K8s",
  网络设备: "网络设备", 路由器: "网络设备", 防火墙: "网络设备", 交换机: "网络设备", iot: "网络设备",
  "vpn": "VPN/网关", 网关: "VPN/网关", 防火墙网关: "VPN/网关", "ssl vpn": "VPN/网关", 边界设备: "VPN/网关",
  中间件: "中间件", "web中间件": "中间件", 应用服务器: "中间件",
  数据库: "数据库", mysql: "数据库", postgresql: "数据库", postgre: "数据库", redis: "数据库", mongodb: "数据库",
  云服务: "云服务", 公有云: "云服务", 云原生: "云服务", 云平台: "云服务",
  ai: "AI/大模型", "ai/大模型": "AI/大模型", 大模型: "AI/大模型", llm: "AI/大模型", 人工智能: "AI/大模型", 智能体: "AI/大模型",

  // 实体标签：厂商与机构（同一家公司只能落在一个标签上）
  微软: "Microsoft", msrc: "Microsoft",
  谷歌: "Google", chromium: "Google",
  苹果: "Apple",
  "apache软件基金会": "Apache", httpd: "Apache", tomcat: "Apache", struts: "Apache", log4j: "Apache",
  思科: "Cisco", "ios xe": "Cisco",
  fortigate: "Fortinet", 飞塔: "Fortinet",
  pulse: "Ivanti", pulsesecure: "Ivanti",
  broadcom: "VMware", vcenter: "VMware", esxi: "VMware", 博通: "VMware",
  confluence: "Atlassian", jira: "Atlassian", bitbucket: "Atlassian",
  weblogic: "Oracle", 甲骨文: "Oracle",
  woocommerce: "WordPress",
  詹金斯: "Jenkins",
  "linux内核": "Linux 内核", "linux kernel": "Linux 内核",
  ghsa: "GitHub", "github advisory": "GitHub", "github安全公告": "GitHub",
  美国网络安全和基础设施安全局: "CISA",
};

// ── 厂商与主体 ──────────────────────────────────────────────────────────────────────────

/**
 * 厂商主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看；orgNames 是这家厂商发公告时开头用的组织名（PSIRT、安全响应中心等），
 * 在它自己的主题页上读者知道说的是谁，可以省去；otherNames 是厂商的其他称呼（产品名、子品牌、安全公告库名）。
 * 所有这些名字都用来认出说的是哪家厂商，比如把事实的主体对到发布方。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  microsoft: { name: "Microsoft", displayTag: "Microsoft", aliases: ["Microsoft", "微软", "Windows", "Exchange", "SharePoint", "Azure"], orgNames: ["MSRC", "Microsoft Security Response Center", "微软安全响应中心", "Microsoft"], otherNames: ["Microsoft Security Update Guide", "Windows Update"] },
  google: { name: "Google", displayTag: "Google", aliases: ["Google", "Chrome", "Chromium", "Android", "谷歌"], orgNames: ["Google", "Chrome Security Team", "Android Security Team", "谷歌"], otherNames: ["Google Project Zero", "Google Threat Analysis Group"] },
  apple: { name: "Apple", displayTag: "Apple", aliases: ["Apple", "苹果", "iOS", "macOS", "Safari"], orgNames: ["Apple", "Apple Product Security", "苹果"], otherNames: ["Apple Security Updates"] },
  apache: { name: "Apache", displayTag: "Apache", aliases: ["Apache", "Apache Software Foundation", "ASF", "HTTP Server", "Tomcat", "Struts", "Log4j"], orgNames: ["Apache Software Foundation", "Apache Security Team"], otherNames: ["Apache Security Reports"] },
  cisco: { name: "Cisco", displayTag: "Cisco", aliases: ["Cisco", "思科", "IOS XE", "IOS XR", "Adaptive Security Appliance", "ASA", "Firepower"], orgNames: ["Cisco", "Cisco PSIRT", "思科"], otherNames: ["Cisco Security Advisories"] },
  fortinet: { name: "Fortinet", displayTag: "Fortinet", aliases: ["Fortinet", "FortiGate", "FortiOS", "FortiWeb", "FortiManager", "飞塔"], orgNames: ["Fortinet", "Fortinet PSIRT", "Fortinet Product Security Incident Response Team"], otherNames: ["FortiGuard Labs"] },
  ivanti: { name: "Ivanti", displayTag: "Ivanti", aliases: ["Ivanti", "Connect Secure", "Policy Secure", "Pulse Secure", "Endpoint Manager", "CSA"], orgNames: ["Ivanti", "Ivanti Security Advisory"], otherNames: ["Ivanti PSIRT"] },
  vmware: { name: "VMware", displayTag: "VMware", aliases: ["VMware", "vCenter", "ESXi", "Workstation", "Broadcom", "博通"], orgNames: ["VMware", "Broadcom", "VMware Security Response Center"], otherNames: ["VMware Security Advisories", "VMSA"] },
  atlassian: { name: "Atlassian", displayTag: "Atlassian", aliases: ["Atlassian", "Confluence", "Jira", "Bitbucket", "Bamboo", "Crowd"], orgNames: ["Atlassian", "Atlassian Security Team"], otherNames: ["Atlassian Security Advisories"] },
  oracle: { name: "Oracle", displayTag: "Oracle", aliases: ["Oracle", "WebLogic", "E-Business Suite", "PeopleSoft", "MySQL", "甲骨文"], orgNames: ["Oracle", "Oracle Security Alerts", "甲骨文"], otherNames: ["Oracle Critical Patch Update", "CPU"] },
  wordpress: { name: "WordPress", displayTag: "WordPress", aliases: ["WordPress", "WooCommerce", "Plugin", "WordPress 插件"], orgNames: ["WordPress", "WordPress Security Team"], otherNames: ["Wordfence", "Patchstack"] },
  jenkins: { name: "Jenkins", displayTag: "Jenkins", aliases: ["Jenkins", "CloudBees"], orgNames: ["Jenkins Security Team", "Jenkins"], otherNames: ["Jenkins Security Advisories"] },
  kubernetes: { name: "Kubernetes", displayTag: "Kubernetes", aliases: ["Kubernetes", "K8s", "kube-apiserver", "kubelet", "ingress-nginx"], orgNames: ["Kubernetes", "Kubernetes Security Response Committee", "KSSC"], otherNames: ["Kubernetes Security Advisories"] },
  "linux-kernel": { name: "Linux 内核", displayTag: "Linux 内核", aliases: ["Linux Kernel", "Linux 内核", "kernel.org", "netfilter"], orgNames: ["Linux Kernel Organization", "Linux 内核"], otherNames: ["kernel.org"] },
  github: { name: "GitHub", displayTag: "GitHub", aliases: ["GitHub", "GHSA", "GitHub Advisory Database", "GitHub Security Lab"], orgNames: ["GitHub", "GitHub Security Lab"], otherNames: ["GitHub Advisory Database", "GitHub Security Advisories"] },
  cisa: { name: "CISA", displayTag: "CISA", aliases: ["CISA", "Known Exploited Vulnerabilities", "KEV"], orgNames: ["CISA", "Cybersecurity and Infrastructure Security Agency", "美国网络安全和基础设施安全局"], otherNames: ["CISA KEV", "已知被利用漏洞目录"] },
  openssl: { name: "OpenSSL", displayTag: null, aliases: ["OpenSSL", "OpenSSL Foundation"], orgNames: ["OpenSSL", "OpenSSL Security Team"], otherNames: ["OpenSSL Security Advisory"] },
  nginx: { name: "nginx", displayTag: null, aliases: ["nginx", "F5", "NGINX"], orgNames: ["nginx", "F5"], otherNames: ["nginx security advisories"] },
  mozilla: { name: "Mozilla", displayTag: null, aliases: ["Mozilla", "Firefox", "Thunderbird"], orgNames: ["Mozilla", "Mozilla Foundation Security Advisory"], otherNames: ["MFSA"] },
  redhat: { name: "Red Hat", displayTag: null, aliases: ["Red Hat", "RHEL", "红帽"], orgNames: ["Red Hat", "Red Hat Product Security"], otherNames: ["Red Hat Security Advisory", "RHSA"] },
  f5: { name: "F5", displayTag: null, aliases: ["F5", "BIG-IP", "BIG-IQ", "NGINX"], orgNames: ["F5", "F5 Networks"], otherNames: ["F5 Security Advisory"] },
  citrix: { name: "Citrix", displayTag: null, aliases: ["Citrix", "NetScaler", "ADC", "Gateway", "XenServer"], orgNames: ["Citrix", "Cloud Software Group"], otherNames: ["Citrix Security Bulletin"] },
  paloaltonetworks: { name: "Palo Alto Networks", displayTag: null, aliases: ["Palo Alto Networks", "PAN-OS", "GlobalProtect", "PAN-GP"], orgNames: ["Palo Alto Networks", "Unit 42"], otherNames: ["Palo Alto Networks Security Advisory"] },
  zoho: { name: "Zoho / ManageEngine", displayTag: null, aliases: ["Zoho", "ManageEngine", "Endpoint Central", "ADSelfService Plus"], orgNames: ["Zoho", "ManageEngine"], otherNames: ["ManageEngine Security Advisory"] },
  sap: { name: "SAP", displayTag: null, aliases: ["SAP", "NetWeaver", "Commerce Cloud"], orgNames: ["SAP", "SAP Security Response Team"], otherNames: ["SAP Security Notes"] },
  adobe: { name: "Adobe", displayTag: null, aliases: ["Adobe", "ColdFusion", "Commerce", "Acrobat"], orgNames: ["Adobe", "Adobe Product Security Incident Response Team"], otherNames: ["Adobe Security Bulletin", "APSB"] },
  sonicwall: { name: "SonicWall", displayTag: null, aliases: ["SonicWall", "SMA", "SRA", "SSL VPN"], orgNames: ["SonicWall", "SonicWall PSIRT"], otherNames: ["SonicWall Security Advisory"] },
};

/**
 * 身份词典：摘要和标题里出现的厂商，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "microsoft", name: "Microsoft", patterns: [/microsoft|微软|\bmsrc\b|\bwindows\b|\bexchange\b|\bsharepoint\b|\bazure\b/i] },
  { id: "google", name: "Google", patterns: [/google|谷歌|\bchrome\b|chromium|\bandroid\b/i] },
  { id: "apple", name: "Apple", patterns: [/\bapple\b|苹果|\bios\b|macos|\bsafari\b/i] },
  { id: "apache", name: "Apache", patterns: [/apache|\bhttpd\b|tomcat|struts|log4j/i] },
  { id: "cisco", name: "Cisco", patterns: [/cisco|思科|\bios xe\b|\basa\b|firepower/i] },
  { id: "fortinet", name: "Fortinet", patterns: [/fortinet|fortigate|fortios|fortiweb|fortimanager|飞塔/i] },
  { id: "ivanti", name: "Ivanti", patterns: [/ivanti|pulse secure|\bconnect secure\b|\bpolicy secure\b/i] },
  { id: "vmware", name: "VMware", patterns: [/vmware|vcenter|\besxi\b|broadcom|博通/i] },
  { id: "atlassian", name: "Atlassian", patterns: [/atlassian|confluence|\bjira\b|bitbucket/i] },
  { id: "oracle", name: "Oracle", patterns: [/oracle|甲骨文|weblogic|e-business suite|peoplesoft/i] },
  { id: "wordpress", name: "WordPress", patterns: [/wordpress|\bwoocommerce\b|wordfence|patchstack/i] },
  { id: "jenkins", name: "Jenkins", patterns: [/jenkins/i] },
  { id: "kubernetes", name: "Kubernetes", patterns: [/kubernetes|\bk8s\b|kubelet|kube-apiserver|ingress-nginx/i] },
  { id: "linux-kernel", name: "Linux 内核", patterns: [/linux kernel|linux 内核|kernel\.org|netfilter/i] },
  { id: "github", name: "GitHub", patterns: [/github|\bghsa\b|advisory database/i] },
  { id: "cisa", name: "CISA", patterns: [/\bcisa\b|\bkev\b/i] },
  { id: "openssl", name: "OpenSSL", patterns: [/openssl/i] },
  { id: "nginx", name: "nginx", patterns: [/nginx/i] },
  { id: "mozilla", name: "Mozilla", patterns: [/mozilla|firefox|thunderbird|\bmfsa\b/i] },
  { id: "redhat", name: "Red Hat", patterns: [/red hat|红帽|\brhel\b|\brhsa\b/i] },
  { id: "f5", name: "F5", patterns: [/\bf5\b|big-ip|big-iq/i] },
  { id: "citrix", name: "Citrix", patterns: [/citrix|netscaler|\badc\b|xenserver/i] },
  { id: "paloaltonetworks", name: "Palo Alto Networks", patterns: [/palo alto|pan-os|globalprotect|unit 42/i] },
  { id: "zoho", name: "Zoho / ManageEngine", patterns: [/zoho|manageengine|endpoint central/i] },
  { id: "sap", name: "SAP", patterns: [/\bsap\b|netweaver/i] },
  { id: "adobe", name: "Adobe", patterns: [/adobe|coldfusion|\bapsb\b/i] },
  { id: "sonicwall", name: "SonicWall", patterns: [/sonicwall|\bsma\b|\bsra\b/i] },
];

/** 这些域名上的文章，发布方就是对应的厂商（托管平台如 GitHub、NVD 不算发布方，它们的自有博客除外）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "microsoft", domains: ["msrc.microsoft.com", "microsoft.com", "support.microsoft.com"] },
  { entityId: "google", domains: ["chromereleases.googleblog.com", "security.googleblog.com", "source.android.com", "blog.google"] },
  { entityId: "apple", domains: ["support.apple.com"] },
  { entityId: "apache", domains: ["httpd.apache.org", "tomcat.apache.org", "struts.apache.org", "logging.apache.org", "apache.org"] },
  { entityId: "cisco", domains: ["sec.cloudapps.cisco.com", "tools.cisco.com"] },
  { entityId: "fortinet", domains: ["fortiguard.com", "fortinet.com"] },
  { entityId: "ivanti", domains: ["ivanti.com", "forums.ivanti.com"] },
  { entityId: "vmware", domains: ["vmware.com", "broadcom.com", "support.broadcom.com"] },
  { entityId: "atlassian", domains: ["confluence.atlassian.com", "atlassian.com", "jira.atlassian.com"] },
  { entityId: "oracle", domains: ["oracle.com", "www.oracle.com"] },
  { entityId: "wordpress", domains: ["wordpress.org", "wordfence.com", "patchstack.com"] },
  { entityId: "jenkins", domains: ["jenkins.io", "www.jenkins.io"] },
  { entityId: "kubernetes", domains: ["kubernetes.io", "groups.google.com"] },
  { entityId: "linux-kernel", domains: ["kernel.org", "www.kernel.org"] },
  { entityId: "github", domains: ["github.blog"] },
  { entityId: "cisa", domains: ["cisa.gov", "www.cisa.gov"] },
  { entityId: "openssl", domains: ["openssl-library.org", "openssl.org"] },
  { entityId: "nginx", domains: ["nginx.org"] },
  { entityId: "mozilla", domains: ["mozilla.org", "blog.mozilla.org"] },
  { entityId: "redhat", domains: ["access.redhat.com", "redhat.com"] },
  { entityId: "f5", domains: ["my.f5.com", "f5.com"] },
  { entityId: "citrix", domains: ["support.citrix.com", "citrix.com"] },
  { entityId: "paloaltonetworks", domains: ["security.paloaltonetworks.com", "paloaltonetworks.com"] },
  { entityId: "zoho", domains: ["manageengine.com", "zoho.com"] },
  { entityId: "sap", domains: ["sap.com", "me.sap.com"] },
  { entityId: "adobe", domains: ["helpx.adobe.com", "adobe.com"] },
  { entityId: "sonicwall", domains: ["psirt.global.sonicwall.com", "sonicwall.com"] },
];

/** 原文里的这些写法也算提到了对应厂商。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "microsoft", pattern: /\bMSRC\b/ },
  { entityId: "cisco", pattern: /\bCisco PSIRT\b/i },
  { entityId: "ivanti", pattern: /\bIvanti PSIRT\b/i },
  { entityId: "kubernetes", pattern: /\bKSSC\b/ },
];
