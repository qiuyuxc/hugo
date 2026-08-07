---
title: 告别手动调 API：我写了一个 Cloudflare Tunnel 可视化管理面板
slug: tunnel-manager
date: 2026-07-11T00:00:00+08:00
description: 通过可视化面板管理 Cloudflare Tunnel，自动完成域名绑定、Ingress 配置与 SaaS 接入。
image: https://cdn.kukie.cn/20260731182517_tcx7vo79.webp
categories:
    - CDN
tags:
    - CDN
    - Cloudflare
    - Tunnel
    - SaaS
---

## 前言

使用 Cloudflare Tunnel 并不困难，真正容易出错的是后续的域名发布流程。

当一个服务需要同时使用 Cloudflare Tunnel、DNS CNAME、Cloudflare for SaaS Custom Hostnames 和优选 CNAME 时，每新增一个域名，往往都要在多个页面之间来回切换：先修改 Tunnel 的 ingress 规则，再创建 DNS 记录，然后配置 Custom Hostname，必要时还要设置 fallback origin。

步骤一多，问题就随之出现：域名填错、记录代理状态选错、回源地址不一致、catch-all 路由位置被破坏，或者只完成了一半配置却没有及时发现。

Tunnel Manager 的目标就是把这套重复操作组合成一个可复用的自动化流程。它是一个单租户、自托管的 Cloudflare Tunnel 管理面板，通过 Web UI 或 Telegram Bot 完成隧道选择、路由管理、域名绑定、DNS 配置和 SaaS 回源设置。

这篇文章不把它当作一个“功能展示项目”，而是从实际问题出发，说明它为什么存在、内部如何工作，以及怎样部署和使用。

## 背景：为什么域名接入 Tunnel 仍然很繁琐

Cloudflare Tunnel 的基本用途，是让 `cloudflared` 主动连接 Cloudflare 网络，从而将局域网或服务器上的应用发布到公网。源站不需要直接开放公网端口，也不必把真实 IP 暴露在 DNS 记录中。

对于单个应用，配置一条 Public Hostname 通常就够了。但在下面这些场景中，配置会迅速复杂起来：

- 一台服务器上运行多个 Web 服务，需要持续增加 ingress 路由；
- 对外访问域名和实际回源域名分离；
- 使用 Cloudflare for SaaS 管理 Custom Hostnames；
- 主域名需要指向自定义优选 CNAME；
- 多组域名分别转发到不同端口或服务；
- 管理员希望在手机上快速完成绑定，而不是登录多个控制台页面。

以绑定一组域名为例，假设：

```text
主域名：app.example.com
辅助域名：origin.example.net
本地服务：http://localhost:3000
优选 CNAME：cdn.example.org
```

手动配置通常需要完成四件事：

1. 向 Tunnel ingress 增加 `app.example.com` 和 `origin.example.net` 两条路由；
2. 将 `origin.example.net` 代理到 `<Tunnel-ID>.cfargotunnel.com`；
3. 将 `app.example.com` 解析到 `cdn.example.org`；
4. 在辅助域名所在 Zone 创建 Custom Hostname，并把 `origin.example.net` 作为自定义源站。

任何一步遗漏，最终表现都可能只是“HTTPS 打不开”，排查时却要逐项检查 Tunnel、DNS、证书和 SaaS 配置。

## 技术原理：主域名、辅助域名和 Tunnel 如何协作

理解 Tunnel Manager 前，需要先区分三个角色。

### Tunnel ingress

Tunnel ingress 决定某个 Hostname 的请求应该转发到哪个本地服务。例如：

```yaml
ingress:
  - hostname: app.example.com
    service: http://localhost:3000
  - hostname: origin.example.net
    service: http://localhost:3000
  - service: http_status:404
```

最后一条不带 Hostname 的规则是兜底规则。Tunnel Manager 更新配置时，会先去掉当前域名已有的规则，再把新规则插入兜底规则之前，避免重复绑定，也避免破坏 catch-all 的顺序。

### DNS CNAME

辅助域名通过开启代理的 CNAME 指向：

```text
<Tunnel-ID>.cfargotunnel.com
```

这样请求能够进入对应的 Cloudflare Tunnel。

主域名则指向用户配置的优选 CNAME，并关闭 Cloudflare 代理。项目默认提供了一个 CNAME 值，但实际部署时更稳妥的做法是改成自己维护和确认可用的域名。

### Cloudflare for SaaS Custom Hostname

Custom Hostname 用于把对外访问域名接入指定 Zone，并配置自定义回源地址。Tunnel Manager 会查询同名 Custom Hostname：存在时更新，不存在时创建，同时使用 HTTP DCV 方式申请证书。

因此，这个项目实现的不是简单的“加一条 DNS”，而是一条完整的数据链路：

```text
用户提交域名
    ↓
Go API 校验请求
    ↓
读取当前 Tunnel 和全局配置
    ↓
查询主域名、辅助域名所属 Zone
    ↓
更新 Tunnel ingress
    ↓
写入两侧 DNS CNAME
    ↓
创建或更新 SaaS Custom Hostname
```

## 传统操作方式的问题

### 配置分散

Tunnel 路由、DNS 和 Custom Hostnames 位于 Cloudflare 的不同模块。管理员需要记住它们之间的依赖关系，而控制台不会替你保证整套配置已经完成。

### 重复劳动多

每组域名的操作结构基本相同，只有 Hostname、源站地址和 CNAME 不同。手动执行没有带来额外价值，却增加了输入错误的概率。

### Tunnel 配置容易被覆盖

Tunnel configuration API 更新的是整份配置。处理不当时，新增规则可能覆盖已有 ingress，或者被放到 catch-all 规则之后而永远无法匹配。

### 不适合移动端快速操作

临时修改转发地址或绑定域名时，完整登录 Cloudflare 控制台并不高效。Tunnel Manager 的 Telegram Bot 与 Web 面板共享配置，可以通过命令完成常见操作。

## Tunnel Manager 的设计思路

项目采用 Vue 3 前端、Go 后端和 Cloudflare API 的三层结构：

```text
Vue 3 + TypeScript + Naive UI
              ↓ HTTP API
Go + chi router
              ↓ REST API
Cloudflare Tunnels / DNS / Custom Hostnames
```

前后端会被构建进同一个 Docker 镜像。Go 服务既提供 `/api` 接口，也负责托管前端静态文件，因此部署时只需运行一个容器。

### 为什么使用 JSON 文件存储

项目保存的数据主要是：

- 当前选定的 Tunnel ID；
- 默认转发地址；
- 全局优选 CNAME；
- 管理员用户名与密码摘要；
- Telegram Bot 配置。

这些数据规模很小，源码使用带读写锁的 JSON 文件存储，并通过 Docker volume 持久化到宿主机 `data` 目录。这种设计减少了部署依赖，适合个人和小团队自托管。

代价也很明确：它不是面向多实例、高并发或多租户的存储方案。

### 域名绑定如何实现幂等更新

后端绑定域名时会执行以下逻辑：

1. 根据 Hostname 查询最长匹配的活动 Zone；
2. 获取当前 Tunnel 配置；
3. 删除同名 ingress，防止重复；
4. 将两条新规则放到最后一条兜底规则之前；
5. 更新 Tunnel configuration；
6. 查询 DNS 记录，存在则更新，不存在则创建；
7. 查询 Custom Hostname，存在则 PATCH，不存在则 POST。

这使得相同域名可以再次提交，用于修改其转发地址，而不必先手动删除旧配置。

### 单组绑定与批量绑定

普通绑定使用全局转发地址和全局优选 CNAME，适合多个域名都指向同一个服务的情况。

批量绑定允许每组独立设置：

- 转发地址；
- 可选的优选 CNAME；
- 主域名；
- 辅助域名。

后端按顺序处理每一组，并分别返回成功或失败结果。一组失败不会阻止后续组继续执行。不过这个批处理不是事务：如果某组执行到中间失败，之前已经写入 Cloudflare 的步骤不会自动回滚。

### Web 面板与 Telegram Bot 共用业务逻辑

REST API 和 Telegram Bot 都调用同一个 DomainService。因此，从 Telegram 执行 `/绑定域名` 与从网页提交表单走的是同一套 Cloudflare 配置流程，不会形成两份独立状态。

Bot 支持长轮询和 Webhook：

- 长轮询不需要公网 HTTPS 地址，适合内网部署；
- Webhook 响应更直接，但面板必须拥有可公开访问的 HTTPS 地址；
- 管理权限通过 Telegram 数字 ID 白名单控制；
- 还可以配置自建 Telegram Bot API 端点。

## 部署前准备

部署机器需要具备：

- Linux 服务器或可运行 Docker 的设备；
- Docker；
- Docker Compose V2，或旧版 `docker-compose`；
- Git；
- 一个已配置 Tunnel 的 Cloudflare 账户；
- Cloudflare Account ID；
- 能访问目标 Tunnel、Zone DNS 和 Custom Hostnames 的 API Token。

项目启动时要求 `CF_API_TOKEN` 和 `CF_ACCOUNT_ID` 必须存在。由于它会读写 Tunnel configuration、DNS 和 Custom Hostnames，Token 不能只有只读权限。

权限范围应限制到实际使用的账户和 Zone，不建议直接使用过度授权的全局凭据。

## Docker 部署教程

### 方法一：使用安装脚本

如果已经下载项目源码，进入目录后执行：

```bash
chmod +x install.sh
./install.sh
```

脚本会完成以下工作：

1. 检查 Docker、Compose 和 Git；
2. 询问使用国内镜像还是官方源；
3. 引导输入 Cloudflare Token 和 Account ID；
4. 生成 `.env`；
5. 创建 `data` 持久化目录；
6. 构建镜像并启动服务。

安装时需要填写：

```text
CF_API_TOKEN：Cloudflare API Token
CF_ACCOUNT_ID：Cloudflare Account ID
API_KEY：可选，供外部 API 调用
ADMIN_PASSWORD：可选，留空会随机生成
```

服务默认监听宿主机的 `8080` 端口。部署完成后访问：

```text
http://服务器IP:8080
```

如果没有手动填写管理员密码，可以查看容器日志中的首次启动信息：

```bash
docker compose logs | grep 密码
```

### 方法二：手动配置 Docker Compose

复制环境变量示例：

```bash
cp .env.example .env
```

编辑 `.env`：

```dotenv
CF_API_TOKEN=你的Cloudflare_API_Token
CF_ACCOUNT_ID=你的Cloudflare_Account_ID
API_KEY=可选的外部API密钥
ADMIN_PASSWORD=首次启动管理员密码
```

然后构建并启动：

```bash
docker compose up -d --build
```

检查状态：

```bash
docker compose ps
docker compose logs -f
```

也可以请求健康检查接口：

```bash
curl http://127.0.0.1:8080/api/health
```

正常情况下返回：

```json
{"status":"ok"}
```

### 数据持久化

Compose 会把宿主机的 `./data` 映射到容器内 `/app/data`。管理员凭据摘要、Tunnel ID 和其他配置都保存在这里。

更新或重建容器前不要删除该目录。备份时至少应保存：

```text
.env
data/
```

这两个位置都包含敏感信息，不应提交到公开 Git 仓库。

## 初次使用流程

### 第一步：登录并选择 Tunnel

进入“隧道管理”，面板会通过 Cloudflare API 列出账户中的未删除 Tunnel，并显示名称、ID 和状态。

选择目标 Tunnel 后，Tunnel ID 会写入本地配置。这里的“选择”并不会创建或启动 Tunnel，因此应先确保目标机器上的 `cloudflared` 已经正常连接。

### 第二步：设置转发地址

进入“域名绑定”，填写默认转发地址，例如：

```text
http://localhost:3000
http://192.168.1.20:8080
https://internal-service:8443
```

这个地址会成为 Tunnel ingress 的 `service`。它必须能从运行 `cloudflared` 的环境访问。面板容器能访问该地址，不代表 `cloudflared` 一定能访问，排错时需要明确二者的网络位置。

### 第三步：配置优选 CNAME

填写自己使用的优选 CNAME。它会作为主域名 DNS 记录的目标，并以非代理模式写入 Cloudflare。

如果不使用优选域名方案，应先确认当前 DNS 和 SaaS 架构是否仍适合这套绑定模型，而不是随意填写一个无效域名。

### 第四步：设置 fallback origin

在“全局设置”中输入辅助域名，将它设为对应 Zone 的 SaaS fallback origin。

这是 Zone 级配置，不需要每绑定一个主域名就重复设置。如果不同业务使用不同 Zone，则需要分别处理相应 Zone。

### 第五步：绑定域名

填写主域名和辅助域名：

```text
主域名：app.example.com
辅助域名：origin.example.net
```

提交后，后端会依次更新 Tunnel、DNS 和 Custom Hostname。成功信息表示 Cloudflare API 已接受配置，但 DNS 生效、证书签发和边缘同步仍可能需要等待。

### 第六步：验证结果

建议按以下顺序验证：

```bash
# 检查主域名解析
nslookup app.example.com

# 检查辅助域名解析
nslookup origin.example.net

# 检查 HTTPS
curl -I https://app.example.com
```

如果 HTTPS 暂时失败，可以先在 Cloudflare 控制台检查 Custom Hostname 的证书状态，再确认 Tunnel 是否健康。

## 如何批量绑定多个服务

进入“域名绑定”页面后选择“批量绑定”。每个绑定组都可以填写自己的转发地址，例如：

```text
组 1
转发地址：http://localhost:3000
主域名：blog.example.com
辅助域名：blog-origin.example.net

组 2
转发地址：http://localhost:8080
主域名：api.example.com
辅助域名：api-origin.example.net
```

优选 CNAME 留空时使用全局配置，填写后则只覆盖当前组。

批量操作完成后，页面会显示每组的独立结果。发现部分失败时，不要直接重复提交全部内容，先确认成功组已产生的 ingress、DNS 和 Custom Hostname，避免把问题判断成“全部未执行”。

## 使用 Telegram 远程管理

在“TG 机器人设置”中完成以下配置：

1. 通过 `@BotFather` 创建 Bot 并取得 Token；
2. 获取自己的 Telegram 数字 ID；
3. 将一个或多个管理员 ID 用英文逗号分隔；
4. 优先选择长轮询模式；
5. 启用 Bot 并保存；
6. 发送测试消息确认连通性。

常用命令包括：

```text
/当前配置
/列出隧道
/选择隧道 <Tunnel-ID>
/转发 <服务地址>
/全局优选 <CNAME>
/设置回退源 <辅助域名>
/绑定域名 <主域名> <辅助域名>
/help
```

只有白名单中的 Telegram 用户 ID 能执行命令。Bot Token 仍然属于敏感凭据，应保护配置文件和数据目录，并限制面板本身的访问范围。

## API 自动化调用

除了浏览器登录会话，后端还支持通过 `X-API-Key` 调用受保护接口。设置 `.env` 中的 `API_KEY` 后，可以将它用于脚本集成。

例如查询 Tunnel：

```bash
curl \
  -H 'X-API-Key: YOUR_API_KEY' \
  http://127.0.0.1:8080/api/tunnels
```

绑定域名：

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: YOUR_API_KEY' \
  -d '{"main_domain":"app.example.com","aux_domain":"origin.example.net"}' \
  http://127.0.0.1:8080/api/domain/bind
```

API Key 也支持通过查询参数传递，但 URL 可能进入浏览器历史、反向代理日志和监控记录，实际使用应优先选择请求头。

## 常见问题与排错方法

### 启动时报缺少 CF_API_TOKEN 或 CF_ACCOUNT_ID

后端会在启动阶段检查这两个环境变量。检查 `.env` 是否存在、变量名是否正确，以及 Compose 是否读取到了文件：

```bash
docker compose config
docker compose logs
```

修改 `.env` 后重新创建容器：

```bash
docker compose up -d --force-recreate
```

### 面板中没有 Tunnel

先确认：

- API Token 是否拥有读取 Cloudflare Tunnel 的权限；
- Account ID 是否属于该 Tunnel 所在账户；
- Tunnel 是否已被删除；
- Cloudflare API 是否能从服务器正常访问。

项目只列出 `is_deleted=false` 的 Tunnel。

### 提示找不到域名对应的 Zone

后端会列出当前 Token 可访问的活动 Zone，并根据 Hostname 做最长后缀匹配。

例如 `app.dev.example.com` 可以匹配 `example.com`，但前提是：

- `example.com` 已经在 Cloudflare 中处于 active 状态；
- API Token 对该 Zone 可见；
- 输入的是完整主机名，而不是 URL。

应填写：

```text
app.example.com
```

不要填写：

```text
https://app.example.com/path
```

### DNS 创建成功，但网站仍打不开

依次检查：

1. Tunnel 状态是否为 healthy；
2. ingress 中 Hostname 是否位于 catch-all 之前；
3. `cloudflared` 是否能访问配置的 service URL；
4. 辅助域名是否代理到正确的 `cfargotunnel.com`；
5. 主域名是否指向有效优选 CNAME；
6. Custom Hostname 是否已经完成证书验证；
7. fallback origin 是否设置在正确 Zone。

不要只看浏览器错误页面。Cloudflare Tunnel 日志、DNS 查询和 Custom Hostname 状态通常能更快定位问题。

### 修改配置后登录状态失效

项目的 Web 登录会话保存在 Go 进程内存中。容器重启后，已有登录 Token 会失效，需要重新登录。这不会删除持久化配置。

### 忘记管理员密码

随机生成新密码：

```bash
docker compose exec tunnel-manager ./tunnel-manager --reset-password
```

设置指定密码：

```bash
docker compose exec tunnel-manager ./tunnel-manager --set-password='新的强密码'
```

### Telegram Bot 无法启动

检查：

- Bot Token 是否正确；
- 管理员 TG ID 是否填写；
- 服务器能否访问 Telegram API；
- 自定义 API 端点是否包含正确协议；
- Webhook 模式是否提供了公网 HTTPS 地址。

内网服务器通常应先使用长轮询，排除网络和 Token 问题后再考虑 Webhook。

### 批量绑定出现部分成功

批量接口逐组执行，不提供整体回滚。应根据每组返回结果检查 Cloudflare 当前状态，再单独重试失败组。

另外，单组绑定内部也由多个 Cloudflare API 请求组成。如果最后一步失败，前面的 ingress 或 DNS 可能已经生效，需要手动核对，不能假设整组操作具有数据库事务语义。

## 与其他管理方式相比，它适合什么场景

直接使用 Cloudflare Dashboard 的优点是功能完整、无需维护额外服务，适合偶尔配置一个域名。

使用 Terraform 的优点是声明式、可审查、适合团队和基础设施版本管理，但引入成本更高，临时调整也需要遵循代码发布流程。

Tunnel Manager 位于两者之间：

- 比手动控制台更适合重复绑定；
- 比 Terraform 更强调即时操作和低部署门槛；
- 提供 Web 和 Telegram 两种入口；
- 只覆盖当前项目需要的 Tunnel、DNS 与 SaaS 工作流。

它适合：

- 个人站长和家庭实验室；
- 管理少量服务器与多个域名的开发者；
- 已有 Cloudflare Tunnel，需要减少重复配置的人；
- 可以接受单实例、JSON 文件存储的小团队。

它不适合：

- 多客户、多 Cloudflare Account 的托管平台；
- 需要角色权限、审计日志和审批流程的企业；
- 要求数据库高可用和多实例部署的环境；
- 希望完整替代 Cloudflare Dashboard 的用户。

## 使用前需要了解的安全边界

这个项目会持有能够修改 Tunnel 和 DNS 的 Cloudflare API Token，因此应把它视为运维管理系统，而不是普通公开网站。

实际部署建议：

- 使用最小权限 API Token；
- 只授权必要 Account 和 Zone；
- 不直接把 8080 端口暴露给所有公网来源；
- 在反向代理或防火墙层增加 HTTPS 和访问限制；
- 设置强管理员密码和 API Key；
- 保护 `.env` 与 `data/config.json`；
- 定期备份数据目录；
- 对重要 Zone 的批量操作先用测试域名验证。

源码当前使用单管理员模型，Web 会话保存在内存，配置保存在本地 JSON 文件中。它的优势是简单，但不能替代企业级身份系统和审计平台。

## 总结

Tunnel Manager 解决的是一个具体而重复的问题：把 Cloudflare Tunnel ingress、DNS CNAME、优选域名、Custom Hostname 和 fallback origin 串成一条可操作的域名发布流程。

它最有价值的地方并不是“有一个管理面板”，而是把多个 Cloudflare 模块之间容易遗漏的依赖关系固化在后端逻辑里。对个人开发者和小团队来说，这能显著减少频繁绑定域名时的机械操作和配置差错。

如果只是偶尔新增一个域名，Cloudflare Dashboard 已经足够；如果基础设施必须声明式管理并接受严格审查，Terraform 更合适；如果你正在维护多个 Tunnel 域名，希望用一个轻量、自托管的 Web 面板或 Telegram Bot 快速完成发布，这类工具才真正体现价值。