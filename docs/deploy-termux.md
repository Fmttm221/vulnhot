# 部署到旧手机（Termux）

本文记录本站实际在用的部署方式：一台 Android 旧手机长期挂着，Termux 里跑 PostgreSQL、接口、worker、网页四个进程，靠 Tailscale 组网、靠 Cloudflare Tunnel 发到公网，靠本地 mihomo 走机场出口抓境外信源。它不是官方推荐路径（官方推荐 Docker，见 [deploy.md](deploy.md)），但省一台服务器，代价是要处理 Android 的后台限制和几处和 glibc 平台不同的地方。

实测机型：vivo V2111A，Android 11（SDK 30），aarch64，8 核 / 7.5 GB 内存 / 227 GB 存储，Termux 里 Node 26.4、PostgreSQL 18.6、libvips 8.18.7、cloudflared 2026.10.2、mihomo 1.19.33。

## 拓扑

```
读者 ── 域名 ──> Cloudflare ──tunnel──> cloudflared (手机, 出站连接)
                                           │
                                     web :3000 ──HTTP──> api :3001 ──> PostgreSQL :5432
                                                             ▲
                                        worker（采集·模型·归组·出刊）
                                           │
                    ┌── 直连 ──────> 国内源、GitHub API、多数国际站
            采集与图片出口
                    └─ mihomo:7890 ─> 机场节点（香港 / 日本）──> 被墙与被 Cloudflare 挑战的站
                                           │
                                     llm-gateway :8099 ──> 模型服务
Tailscale 100.x ──────────────────────> web / sshd :8022（运维入口）
```

所有应用进程和数据库都由 runit（`termux-services`）守护；cron 每 10 分钟看一次网页、接口、隧道和代理，每天备份一次数据库。

## 一次性准备

手机上装好 Termux 和 Tailscale 之后，在 Termux 里：

```bash
# 1) 换国内镜像（可选，大陆网络建议做一次）
termux-change-repo

# 2) 装基础包
pkg update -y
pkg install -y openssh nodejs postgresql libvips rsync termux-services cronie pkg-config jq cloudflared

# 3) 让电脑能免密登录（把电脑的公钥贴进来）
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA...你的电脑公钥...' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
sshd            # 8022 端口

# 4) 申请 wake-lock，别让 Android 把它冻结
termux-wake-lock
```

电脑上给手机加一条 SSH 配置，后面所有命令都走它：

```
Host vulnhot-phone
  HostName 100.112.238.97      # tailscale ip
  Port 8022
  User u0_a275                 # Termux 里 whoami 的值
  IdentityFile ~/.ssh/你的手机私钥
```

Android 侧还要手动做三件事，脚本代替不了：

- 设置 → 应用 → Termux → 电池 → **不受限制**（关掉省电优化）。
- 厂商自己的后台管理（vivo「后台高耗电」「自启动管理」、小米「省电策略」）：把 Termux 都放成允许 / 无限制。
- 最近任务里把 Termux 上锁（vivo/小米都支持），避免「一键清理」把它清掉。
- 装 **Termux:Boot** 应用并先打开一次，`~/.termux/boot/` 里的脚本才会在开机时执行。

## PostgreSQL

Termux 仓库现在给的是 PostgreSQL 18（本站文档写的是 16 或 17）。已经用它跑通全部迁移和 1290 条历史数据，没有改动任何 SQL；换版本前先跑一遍 `node scripts/migrate.ts` 确认。

```bash
PGDATA=$PREFIX/var/lib/postgresql
initdb -D "$PGDATA" -U postgres --encoding=UTF8 --locale=C.UTF-8
```

在 `$PGDATA/postgresql.conf` 追加（7.5 GB 内存的机器，留出空间给 Node 和 Android）：

```
listen_addresses = '127.0.0.1'
port = 5432
max_connections = 40
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 8MB
maintenance_work_mem = 96MB
wal_compression = on
max_wal_size = 1GB
min_wal_size = 128MB
unix_socket_directories = '$PREFIX/var/run'
log_min_duration_statement = 2000
```

建角色和库（角色要和 `.env` 里的 `DATABASE_URL` 一致；用库的属主跑迁移，别用 postgres 建完再让应用连，否则对象属主不对）：

```bash
psql -h 127.0.0.1 -U postgres -d postgres \
  -c "CREATE ROLE vulnhot LOGIN PASSWORD '换成随机串';" \
  -c "CREATE DATABASE vulnhot OWNER vulnhot;"
```

## 取代码

手机上不用 `git clone`（仓库在私有分支上时更麻烦）。在 PC 上打包、传过去、解开：

```bash
tar -czf app.tgz -C . --exclude=node_modules --exclude=.git --exclude=.data --exclude=.env .
scp app.tgz vulnhot-phone:~/ && ssh vulnhot-phone 'mkdir -p ~/vulnhot && tar -xzf ~/app.tgz -C ~/vulnhot'
```

**改配置类文件（`site/site.ts`、`industry/sources.json`）时注意反方向**：在手机上改完要立刻 `git commit` 并推回 `origin`，下一次从 PC 打包前先把手机的最新代码拉回镜像，否则旧 tar 会把手机上的改动覆盖掉。

### web 的构建产物在 PC 上生成

`apps/web/build` 是纯 JS/CSS 产物，和平台无关，在 PC 上 `npm run build -w @aihot/web` 后一起打进 tar 包即可。原因：Termux 里 Node 报的是 `process.platform === 'android'`，Tailwind 4 的 `@tailwindcss/oxide` 没有 android 预编译二进制，在手机上构建 CSS 会失败；不装 devDependencies 也就顺带省下几百 MB 和 playwright 的浏览器。

代价：改了前端要回 PC 重新构建、重新传 `apps/web/build`。

### 手机上的依赖

```bash
cd ~/vulnhot
npm ci --omit=dev --registry https://registry.npmmirror.com
```

### sharp 要自己编译

`sharp` 只有 glibc 的预编译包，Termux 是 bionic，`npm ci` 之后 `import('sharp')` 会报 `Could not load the "sharp" module using the android-arm64 runtime`。用 Termux 的 libvips 现场编译一次：

```bash
export SHARP_FORCE_GLOBAL_LIBVIPS=1
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"
npm install --prefix "$HOME/.sharp-deps" --no-save node-gyp node-addon-api   # sharp 的构建脚本要这两个
export NODE_PATH="$HOME/.sharp-deps/node_modules"
cd ~/vulnhot/node_modules/sharp && npm run build
cd ~/vulnhot && node -e "import('sharp').then(s=>console.log(s.default.versions))"
# { vips: '8.18.7', sharp: '0.35.5' }
```

**每次重跑 `npm ci` 都要重新做这一步**（它会清空 node_modules）。

## 配置

复制 `.env.example` 后，和本机开发不同的几项：

```dotenv
SITE_URL=https://你的域名        # 接 Cloudflare Tunnel 之后；先用 tailscale 地址验证
DATABASE_URL=postgres://vulnhot:上面那个随机串@127.0.0.1:5432/vulnhot
API_BASE_URL=http://127.0.0.1:3001
AIHOT_DATA_DIR=/data/data/com.termux/files/home/vulnhot-data
DATABASE_POOL_MAX=8              # 三个进程合计不超过 max_connections
AIHOT_RELEASE=phone-2026-10-20   # 后台「运行」页和 /api/health 里能看到，升级后据此确认进程换新
TRUST_PROXY=true                 # 前面有 cloudflared
EGRESS_PROXY_URL=http://127.0.0.1:7890   # 抓境外信源用的本地代理，见下文
```

## 进程守护（termux-services / runit）

`deploy/termux/services/` 里是应用的服务定义，`install-services.sh` 会把它们装到 `$PREFIX/var/service/` 并去掉 `down` 标记：

```bash
bash ~/vulnhot/deploy/termux/install-services.sh
sv status $PREFIX/var/service/vulnhot-api $PREFIX/var/service/vulnhot-worker $PREFIX/var/service/vulnhot-web
```

- `vulnhot-api`：3001，只连 127.0.0.1。
- `vulnhot-worker`：采集、模型、归组、出刊。
- `vulnhot-web`：3000，只通过 HTTP 读接口。
- `llm-gateway`：8099，给模型服务补请求头（见下一节）。
- `cloudflared`：出站隧道（本机管理，见「发到公网」）。
- `mihomo`：本地代理出口（见「抓海外信源」）。
- `postgres`、`crond`：Termux 自带的服务定义，`install-services.sh` 会把它们打开。

日志在 `$PREFIX/var/log/sv/<服务名>/`（runit 服务）和 `~/logs/`（cron 脚本），svlogd 自己轮转。runit 的启动顺序不保证，api 和 worker 的 `run` 里用 `pg_isready` 等数据库。

**runsvdir 要带 `LOGDIR` 启动**，否则 Termux 自带服务里的日志脚本会把日志往 `/sv` 写（根目录只读，直接失败）：

```bash
export SVDIR=$PREFIX/var/service LOGDIR=$PREFIX/var/log
nohup env SVDIR="$SVDIR" LOGDIR="$LOGDIR" runsvdir -P "$SVDIR" > ~/logs/runsvdir.log 2>&1 &
```

开机自启靠 `deploy/termux/boot-start.sh`（装到 `~/.termux/boot/vulnhot`）：先 `termux-wake-lock`，等 15 秒让网络就绪，再起 runsvdir 和 sshd。sshd 故意不走 runit——runsvdir 出问题时还得能进来看（所以 `sv status` 里 sshd 显示 `down` 是正常的，`sv restart sshd` 对它无效）。

## 看门狗与备份

cron（`crond` 服务）：

```
10 4 * * *   ~/vulnhot/deploy/termux/backup.sh      >> ~/logs/backup.log 2>&1
*/10 * * * * ~/vulnhot/deploy/termux/healthcheck.sh >> ~/logs/health.log 2>&1
```

- `backup.sh`：`pg_dump` + `~/vulnhot-data` 打包到 `~/backups`，保留 7 天。PC 上再定期拉一份走（`scp vulnhot-phone:~/backups/*.tgz .`），手机丢了才是真的丢了。
- `healthcheck.sh`：四件事——`/api/health` 与首页不通就 `sv restart` 对应服务；**worker 超过 90 分钟没抓过任何信源就重启 worker**；**隧道没有活跃连接（`cloudflared tunnel info` 里查不到连接器）就重启 cloudflared**；**`127.0.0.1:7890` 代理不通就重启 mihomo**。前三类"进程活着但链路断了"的情况 runit 是发现不了的，只有这个脚本能拉回来。

## 发到公网：域名 + Cloudflare Tunnel

手机在移动网络后面，没有公网 IP，端口映射无从谈起。用 Cloudflare Tunnel：cloudflared 从手机**出站**连 Cloudflare，不用开任何入站端口。

### 1. 把 NS 交给 Cloudflare

域名在阿里云注册，把解析权整体交给 Cloudflare 免费套餐：

1. Cloudflare 加站点，记下分配的两个 NS（形如 `ali.ns.cloudflare.com`、`donald.ns.cloudflare.com`）。
2. 阿里云域名控制台 → 该域名 → DNS 管理 → **DNS 修改** → 把 `dns7/dns8.hichina.com` 全换成上面两个。域名必须先通过实名认证。
3. 生效 1–24 小时。Cloudflare 概览页出现「您的域名现已受到 Cloudflare 的保护」即已接管。

**验证要看权威源，别看你本机的解析**——上游递归解析器会缓存旧委派最长 48 小时，`ipconfig /flushdns` 清不掉它：

```powershell
# 注册局已经改完了吗（最硬的证据）
nslookup -type=ns 你的域名 a.gtld-servers.net
# 任选两个公共 DNS，绕开本地缓存
Resolve-DnsName 你的域名 -Type NS -Server 223.5.5.5 | Where-Object Type -eq NS | Select-Object -Expand NameHost
```

### 2. 本地管理隧道（不需要 Zero Trust，也不用绑卡）

Cloudflare 面板的 Tunnels 页在 Zero Trust 下，开通时可能要求绑定支付方式。**绕开它**：cloudflared 支持完全用命令行管理隧道——隧道配置放在本地 `config.yml`，DNS 记录用 `route dns` 自动写，全程不碰 `one.dash.cloudflare.com`。

```bash
# ① 拿账户授权（前台阻塞，用 nohup 跑，免得 SSH 断开就没了）
nohup cloudflared tunnel login > ~/logs/cf-login.log 2>&1 &
sleep 5; cat ~/logs/cf-login.log
# 它打印一个 https://dash.cloudflare.com/argotunnel?aud=...&callback=... 的地址，
# 在任意一台电脑的浏览器里打开 —— 选那个域名 —— 点 Authorize。
# 完成后手机上出现 "You have successfully logged in." 并写出 ~/.cloudflared/cert.pem。

# ② 建隧道（UUID 和凭证文件都由本机生成，cloudflared 只把公钥注册出去）
cloudflared tunnel create vulnhot-phone
# → Created tunnel vulnhot-phone with id <UUID>
# → 凭证在 ~/.cloudflared/<UUID>.json（600，别外传，也别贴到聊天里）

# ③ 让 DNS 指向隧道（自动写一条橙色云的 CNAME）
cloudflared tunnel route dns vulnhot-phone 你的域名
```

`~/.cloudflared/config.yml`：

```yaml
tunnel: <UUID>
credentials-file: /data/data/com.termux/files/home/.cloudflared/<UUID>.json
no-autoupdate: true
protocol: http2
ingress:
  - hostname: 你的域名
    service: http://127.0.0.1:3000
  - service: http_status:404
```

`$PREFIX/var/service/cloudflared/run`：

```bash
#!/data/data/com.termux/files/usr/bin/sh
exec cloudflared --no-autoupdate --config /data/data/com.termux/files/home/.cloudflared/config.yml tunnel run 2>&1
```

装服务时记得删掉 `down` 标记（`rm -f $PREFIX/var/service/cloudflared/down`），否则 runit 只在手动 `sv up` 时跑，崩溃和重启都不会自己起来。

### 3. 一定要写 `protocol: http2`

cloudflared 默认走 QUIC（UDP 7844）。**在中国移动网络下 QUIC 会被 QoS 掐断**，现象是：连上 4 分钟，然后四条连接同时报

```
ERR Serve tunnel error error="accept stream error: timeout: no recent network activity"
ERR Failed to dial a quic connection ... connIndex=0
```

接着站点变 1033。启动时的 precheck 会显示 QUIC 可用（`UDP Connectivity ... pass`），别信它——precheck 只验证握手，不验证长期连接。改成 `protocol: http2`（走 TCP 443）之后实测稳定。

### 4. www：占位记录 + 301，不要建第二条 hostname

MCP 有 Host 白名单（只接受 `SITE_URL` 的主机与 localhost），给 `www` 建第二条隧道 hostname 会让 `www.域名/api/mcp` 直接 400。正确做法：

1. DNS 加一条**橙色云**的占位记录：类型 `AAAA`、名称 `www`、地址 `100::`（RFC 6666 丢弃地址）。
2. Rules → Redirect Rules：请求 `www.域名/*` → 动态重定向到 `https://根域名/$1` → 301。

重定向在 Cloudflare 边缘就完成，永远不会打到隧道。

### 5. 面板设置清单（免费套餐）

| 位置 | 设置 | 原因 |
|---|---|---|
| SSL/TLS → Overview | 保持与 `http` 源站兼容的那个模式；**能通就别动** | 改成 Full 后源站是 http 会出现 52x |
| SSL/TLS → Edge Certificates | **Always Use HTTPS 开**、Minimum TLS 1.2 | 不开的话 `http://` 返回 200 明文 |
| Security → Bots | **Bot Fight Mode 关** | 开了会挑战 RSS 订阅者和 MCP 客户端 |
| Speed | **Rocket Loader 关** | 会破坏 React 水合 |
| Caching | **不要开「缓存所有内容」**，别给 HTML 和 `/api/*` 另加缓存 | 站点自带 `Cache-Control` |
| 概览 | 「AI 机器人偏好同步」会改 `robots.txt` | 知道它存在，不想被改就关掉 |

### 6. 验证

本地 DNS 缓存没过期时，用 CF 的 anycast IP 强制访问，不依赖本机解析：

```powershell
Resolve-DnsName 你的域名 -Type CNAME -Server ali.ns.cloudflare.com     # 应出现 xxx.cfargotunnel.com
$ip = (Resolve-DnsName 你的域名 -Type A -Server ali.ns.cloudflare.com | Where-Object Type -eq A).IPAddress
curl.exe -sI --resolve "你的域名:443:$ip" https://你的域名/api/health
```

```bash
# 手机上，走真实公网链路跑整套检查
node scripts/smoke.ts --base https://你的域名
```

其他该核对的：`/feed.xml` 里的绝对链接是 `https://你的域名/`；`og:image` 是绝对地址；用别的 `Host` 请求 `/api/mcp` 返回 403；后台登录限流按 `CF-Connecting-IP` 里的真实访客算（`TRUST_PROXY=true` 才生效）。

## 抓海外信源：mihomo 本地代理出口

### 两类失败，两种解法

从国内手机出发，抓不到的站分两类，**买一样东西解决不了两样**：

| 类型 | 典型站点 | 现象 | 需要的出口 |
|---|---|---|---|
| GFW 丢包 | `security.googleblog.com`、`feeds.feedburner.com`、`r.jina.ai`、`api.telegram.org` | 15 秒超时 / connection reset | 任意非大陆出口 |
| Cloudflare 托管挑战 | `bleepingcomputer.com`、`securityweek.com`、`therecord.media` | 403 + 响应头 `cf-mitigated: challenge`、页面标题 `Just a moment...` | IP 信誉好的出口（住宅 IP 或部分机房的日本/台湾/美国节点） |
| 工作量证明人机页 | `theregister.com` | 200 + 标题 `Are we human?` | 放弃；同题材换 Talos/ZDI/SANS/Krebs 覆盖 |

改 UA 没有用（实测 bot UA 与 Chrome UA 返回一模一样的 403），要换的是出口 IP。

### 装 mihomo（复用桌面上 Clash 的订阅）

Termux 仓库里没有 mihomo/Clash，只有 `sing-box`、`v2ray`、`trojan-go`。复用现成 Clash 订阅最省事的是 mihomo（Clash.Meta）：配置文件格式和 Windows 上的 Clash 一致。

```bash
# PC 上下载（GitHub release 在手机上基本下不动），然后 scp 过去
# https://github.com/MetaCubeX/mihomo/releases → mihomo-android-arm64-v8-v*.gz
scp mihomo vulnhot-phone:/data/data/com.termux/files/home/bin/mihomo
ssh vulnhot-phone 'chmod 700 ~/bin/mihomo && ~/bin/mihomo -v'
```

配置**不要**直接扔 Clash 那份：里面 `redir-port`、`tproxy-port` 在 Android 上要 iptables，`fake-ip` 只有 TUN 模式才需要，还有上千条规则要 geodata。抽取出 `proxies` 段，重写成最小配置（`~/.config/mihomo/config.yaml`，**chmod 600，里面是节点密码**）：

```yaml
mixed-port: 7890          # HTTP + SOCKS5 同一个口，后端只认 HTTP
allow-lan: false
mode: rule
external-controller: 127.0.0.1:9090   # 换节点/看流量用
unified-delay: true
tcp-concurrent: true
dns:
  enable: true
  ipv6: false
  enhanced-mode: normal
  default-nameserver: [223.5.5.5]
  nameserver: [223.5.5.5, 119.29.29.29]
proxies:
  # 原订阅的 39 条 trojan / vmess 原样贴上
proxy-groups:
  - name: PROXY            # 默认出口：自动挑最快
    type: url-test
    url: https://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
    lazy: false
    proxies: [候选节点...]
  - name: PIN              # 个别站点的钉子，默认第一条
    type: select
    proxies: [日本01, 香港01|HKT家宽, 台湾04|Hinet家宽, 美国LA01, 新加坡01]
rules:
  - DOMAIN-SUFFIX,therecord.media,PIN
  - MATCH,PROXY
```

`$PREFIX/var/service/mihomo/run`：

```bash
#!/data/data/com.termux/files/usr/bin/sh
exec /data/data/com.termux/files/home/bin/mihomo -d /data/data/com.termux/files/home/.config/mihomo 2>&1
```

`log/run` 照抄其它服务的写法（`svlogd -tt "$LOGDIR/sv/$name"`）。**Termux 没有 `/tmp`**，写临时文件一律用 `$HOME`，否则脚本静默失败（踩过一次：把 healthcheck.sh 清空了）。

换节点不用改配置：

```bash
curl -s -X PUT -H 'Content-Type: application/json' \
  -d '{"name":"[Lv3·1.8x] 香港01|HKT家宽"}' http://127.0.0.1:9090/proxies/PIN
```

### 双通道：直连名单 + 代理

`EGRESS_PROXY_URL` 是全局开关，但路由是按域名决定的（`packages/backend/src/lib/http-fetch.ts` 的 `proxied()`）：IP 字面量、`.cn`、`.local`、`PRIVATE_FEED_HOSTS` 和 `site/site.ts` 的 `DEPLOYMENT.directFetchHosts` 一律直连，其余走代理；每次跳转按目标域名重算，直连仍做内网地址检查。

所以做法是：**把已经实测能直连的主机全部写进 `directFetchHosts`**，只有真正需要出境的请求才走机场。好处有三个：机场流量只花在必须的地方；共享出口 IP 被限流不影响主站；新加的境外源默认就走代理，不用改代码。

名单可以从库里生成（已在用），加新源后重跑一次再提交：

```bash
# 输出每个启用信源的主机名（.cn 会自动直连，不用列）
psql -h 127.0.0.1 -U vulnhot -d vulnhot -At -c "
select distinct regexp_replace(coalesce(config->>'feedUrl', config->>'url',''), '^https?://([^/]+).*$', '\1')
from sources where enabled and coalesce(config->>'feedUrl', config->>'url','') <> '' order by 1"
```

两条反向的坑，都是实测出来的：

- **`api.github.com` 必须直连**：走机场会被 GitHub 按共享 IP 限流，直接 403；直连 200。
- **国内源必须直连**：`api.anquanke.com` 走机场直接连不上（000）。

### 实测结论（香港 / 日本住宅与机房节点）

| 站点 | 直连 | 走代理 |
|---|---|---|
| `feeds.feedburner.com/TheHackersNews` | 超时 | 200，有效 RSS |
| `security.googleblog.com` | 超时 | 200（302 → feedburner） |
| `bleepingcomputer.com/feed` | 403 挑战 | **200** |
| `securityweek.com/feed` | 403 挑战 | **200** |
| `therecord.media/feed` | 403 挑战 | 香港节点 403，**日本/台湾/美国/新加坡 200**（已钉 PIN） |
| `theregister.com/security/headlines.atom` | PoW 页 | 仍是 PoW 页，放弃 |
| `r.jina.ai` | connection reset | 401（可达，但要 `JINA_API_KEY`） |

### 流量与稳定性

机场节点标着倍率（1.8x–2.0x），按 GB 计费。文本量很小——RSS 走条件请求（`packages/backend/src/sources/rss.ts` 存 ETag/Last-Modified），多数是 304。**图床才是大头**：`packages/backend/src/media/images.ts` 的取图走同一条 egress 路由，访客每张图都会穿透一次代理。上线后给它设个上限兜底：

```dotenv
IMGPROXY_UPSTREAM_GB_PER_DAY=1
```

节点会掉线、机场会限速，所以 `healthcheck.sh` 每 10 分钟探一次 `127.0.0.1:7890`；`url-test` 会自动换节点，掉到没有可用节点时看门狗重启进程。

## 模型服务的请求头：llm-gateway

opencode.ai 的 zen/go 网关要求 `x-opencode-session` 头，而后端只发 `content-type` 和 `authorization`（`packages/backend/src/providers/llm.ts`），直接配 `LLM_BASE_URL=https://opencode.ai/zen/go/v1` 会收到 `HTTP 400 MissingSessionID`。

`deploy/termux/llm-gateway.mjs` 在手机上做一层转发：补上这个头，并把同时向上的请求限制在 2 个、遇到 429/5xx 退避重试。站点这边只需要：

```dotenv
LLM_BASE_URL=http://127.0.0.1:8099/v1
```

换成不需要额外头的服务商（DeepSeek 官方、百炼、智谱……）时，把 `LLM_BASE_URL` 指回去，然后 `sv down llm-gateway` 就行；后端代码一行没改。

## 升级

```bash
# PC：先把手机上的最新代码同步回镜像（手机 commit 过的东西不能丢），再重新打包
npm run build -w @aihot/web
tar -czf app.tgz -C . --exclude=node_modules --exclude=.git --exclude=.data --exclude=.env .
scp app.tgz vulnhot-phone:~

# 手机：停服务 → 解包 → 装依赖 → 重编 sharp → 迁移 → 起服务
ssh vulnhot-phone
sv down $PREFIX/var/service/vulnhot-api $PREFIX/var/service/vulnhot-worker
cd ~/vulnhot && tar -xzf ~/app.tgz        # 覆盖，不删 node_modules
npm ci --omit=dev --registry https://registry.npmmirror.com
# ……重编 sharp（见上）……
node --env-file=.env scripts/migrate.ts
sv up $PREFIX/var/service/vulnhot-api $PREFIX/var/service/vulnhot-worker
```

升级前先跑一次 `~/vulnhot/deploy/termux/backup.sh`。

## 已知限制

- **Android 随时可能冻结或杀掉 Termux**。wake-lock + 电池白名单 + 任务锁能解决大部分情况，看门狗兜底；但要接受「偶尔断几分钟」。
- **没有 swap（除 zram）**：Docker 镜像构建那种内存峰值跑不动，所以依赖和构建都放在 PC 上做。
- **PostgreSQL 是 Termux 的 18.x**，和官方文档写的 16/17 不同源；升大版本要重新 `pg_dump`/`pg_restore`（跨版本不能用同一个数据目录）。
- **公网访问完全依赖手机**：手机断网，站点就是 1033/502。这是 Cloudflare Tunnel 的固有代价。
- **境外信源依赖本地代理**：机场挂了之后，被墙和被挑战的那几个源会失败（其余走直连不受影响）；The Register 这类人机验证站点不做破解。
- **电池**：长期插电 + 满电会顶电池。能设充电上限就设，或者每周放一次电。
- 手机上的 `.git` 不要靠 `git pull` 更新（tar 覆盖更省事），也别忘了 `.env` 和 `~/backups` 不在包里。
