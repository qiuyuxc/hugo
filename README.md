# Kukie 的个人笔记

网站前端使用 **Astro**，源码位于 `prototypes/astro-blog/`，继续读取仓库中的 Markdown、静态资源与部分 Hugo 配置。旧 Hugo 主题和构建脚本保留供维护使用；API、控制台和原生 App 的迁移另行进行。

- 线上地址：https://www.kukie.cn/
- 内容语言：简体中文

## 目录结构

| 路径 | 说明 |
|------|------|
| `prototypes/astro-blog/` | Astro 前端、独立开发命令与页面测试 |
| `hugo.toml` | 保留的 Hugo 配置，Astro 复用其中公告与页脚配置 |
| `content/posts/` | 文章，每篇一个 Markdown 文件，文件名即 URL slug |
| `content/about.md` | 关于页正文 |
| `content/links.md` + `data/links.yaml` | 友链页壳子与友链数据 |
| `content/archives/` `content/categories/` `content/tags/` `content/search.md` | 归档 / 分类 / 标签 / 搜索页 |
| `static/hero/` | 首页轮播媒体与头像（`avatar.jpg`） |
| `static/favicon.png` / `static/favicon.ico` | 网站图标 |
| `themes/aiovtue/` | 主题本体（随仓库 vendored，非 git submodule） |
| `layouts/partials/head.html` | 站点级 `<head>` 覆盖（已加入 Umami 统计，同步主题更新时留意） |
| `assets/css/site-banner.css` `assets/js/site-banner.js` `layouts/partials/site-banner.html` | 站点顶栏公告（动态，见下文） |
| `.github/workflows/indexnow.yml` | 向 IndexNow 提交网站 URL |

## 本地开发

使用 Node.js 22（仓库 `.node-version` 固定为 22.20.0）和 pnpm 10.11.1（`packageManager` 固定版本）。

```bash
npm --prefix prototypes/astro-blog ci
npm --prefix prototypes/astro-blog run dev  # http://localhost:8085/
pnpm run build                            # Astro 正式构建到 public/
```

根目录 `build` / `build:cf` 均进入 `scripts/build.mjs`，安装 Astro 子项目的锁定依赖并构建。直接在子项目运行 `build` 则输出至其 `dist/`，供本地验证，默认禁止搜索引擎收录。原 Hugo 版本仍可用 `pnpm dev` 或 `node scripts/build-hugo.mjs` 维护，需要 Hugo Extended。

下方旧主题、Twikoo 等配置说明仅适用于保留的 Hugo 版本。Astro 的当前功能与验证方式见 [前端说明](prototypes/astro-blog/NOTES.md)。

## 写文章

在 `content/posts/` 新建 `my-post.md`：

```markdown
---
title: "文章标题"
description: "摘要，用于 SEO 与分享卡片"
date: 2026-01-01
cover: "https://example.com/cover.jpg"   # 头图，支持本地路径与视频
categories:
  - 分类
tags:
  - 标签
weight: 1           # 可选，越小越靠前（置顶）
comment: false      # 可选，关闭单篇评论
---

正文使用 Markdown 书写。
```

常用自定义：

- 换头像：替换 `static/hero/avatar.jpg`
- 换图标：替换 `static/favicon.png` 与 `static/favicon.ico`
- 首页 Hero 背景：默认接入你自己的 [Static_RandomPicAPI](https://github.com/qiuyuxc/Static_RandomPicAPI) 随机图（引用方案：仅加载 `random.js`，不克隆仓库、不维护副本）
  - 地址在 `hugo.toml` → `[params.hero]` → `randomPicApi`（当前 `https://pic.kukie.cn/random.js`；需把该仓库 `node build.js` 生成的 `dist/` 产物部署到 `pic.kukie.cn`，新加图后重跑构建即可生效）
  - 桌面端取横屏 `getRandomPicH()`，移动端（≤768px）取竖屏 `getRandomPicV()`；同一会话内固定、预加载防闪变；`random.js` 加载失败会自动回退 `urls` 静态轮播（随机图模式下自动隐藏左右切换箭头）
  - 想恢复原来的静态轮播：把 `randomPicApi` 留空即可
- 主题演示自带的 Hero 图/视频为上游示例素材，可按需替换或删除

## 评论

AIOVTUE 主题支持 **Twikoo / Waline**（原站点使用的 Giscus 不被支持，迁移时评论数据无法直接保留）。

当前使用 **Twikoo 自部署**，服务地址 `tw.kukie.cn`，已在 `hugo.toml` 的 `[params.twikoo]` `envId` 填入：

```toml
[params.comment]
provider = 'twikoo'

[params.twikoo]
envId = 'https://tw.kukie.cn/'
visitorEnable = false   # 需要文章阅读量时改为 true
```

如需切换 Waline，把 `provider` 改为 `waline` 并填写 `[params.waline] serverURL` 即可。

## 统计

- **Umami**：纯埋点统计（`layouts/partials/head.html` 站点级覆盖，脚本位于 `um.kukie.cn`），与页面显示的数字无关。
- 页脚「今日访客 / 今日访问 / 本站访客 / 本站访问」由主题内置的第三方 **不蒜子 busuanzi**（`cdn.busuanzi.cc`）提供，按用户要求保留原样。

## 站点公告（动态）

站点顶部有一条公告栏，**内容在页面加载后从后端拉取**，因此：

- **改公告内容不需要走构建** —— 更新那个 JSON 文件即可，刷新页面就生效；
- 只有改配置（端点、开关）才需要重新构建一次。

配置在 `hugo.toml` 的 `[params.siteBanner]`：

```toml
[params.siteBanner]
  enable = true
  endpoint = 'https://cloud.kukie.cn/d/M/notice.json?sign=...'
  timeoutMs = 5000
```

**端点建议用环境变量覆盖，不必改仓库**（CF Pages → Settings → Environment Variables）：

```
HUGO_PARAMS_SITEBANNER_ENDPOINT=https://...
```

Hugo 会自动用它覆盖 `hugo.toml` 里的值；改完在 Pages 上 Retry deployment 即可。

JSON 字段（`text` 之外都可选）：

| 字段 | 说明 |
|------|------|
| `enabled` | `false` 时不显示（相当于下线公告） |
| `level` | `info` / `warn` / `ok`，三种配色 |
| `badge` | 左侧标签文字，默认「公告」 |
| `text` | 正文；超过两行折叠，右侧出现「展开」 |
| `link` | 有值时正文可点击 |
| `external` | `true` 则新窗口打开 |
| `updated` | 版本号；未填写时自动用响应的 `Last-Modified` |

行为：拉取失败 / 超时（5 秒）/ 字段缺失一律**静默不显示**，不影响页面；点 ✕ 关闭后按版本号记忆，**同一条不再打扰，内容更新会重新出现**。

实现：`assets/js/site-banner.js`（拉取与渲染）、`assets/css/site-banner.css`（样式，取自主题 CSS 变量，自动适配暗色）、`layouts/partials/site-banner.html`（输出 meta 并引入资源）。

## 部署

- **Cloudflare Pages（当前网站部署）**：根目录留空，构建命令 `pnpm run build`，输出目录 `public`；框架预设可选 Astro。只改预设不会改写仓库的构建脚本，实际入口与输出路径见 `scripts/build.mjs` 和 `wrangler.toml`。
- **Bing 收录推送（IndexNow，免账号）**：`.github/workflows/indexnow.yml` 推送线上 URL；网站构建由 Cloudflare Pages 负责，仓库未启用 GitHub Pages。
  - key 文件：`static/92245a642338954199d4b6a48196c5ad.txt`（内容=文件名=32 位 hex，已随站部署；可访问 `https://www.kukie.cn/92245a642338954199d4b6a48196c5ad.txt` 验证）。
  - 手动重推：Actions 里对该工作流点 `Run workflow`，结果看 `submit-indexnow` 任务日志（HTTP 200/202 即成功）。
  - 更换域名或重新生成 key：同步修改 `indexnow.yml` 的 `SITE_BASE` / `INDEXNOW_KEY`，并替换 `static/` 下同名 key 文件。
- **Vercel / Netlify**：保留根目录构建入口与 `public` 输出，使用同一套 Astro 构建。Cloudflare / Netlify 可直接读取产物中的 `_redirects`；其他托管平台需配置等效的旧地址跳转规则。

Astro 正式构建生成 canonical、`robots.txt`、`sitemap.xml`、`index.xml` 和旧文章/分类/标签的跳转规则；正式域名在 `prototypes/astro-blog/astro.config.mjs` 与 `src/config/site.ts` 中维护。根构建将 `PUBLIC_SITE_RELEASE` 设为正式模式，Cloudflare 非 master 分支、Netlify 非 production context 和 Vercel 非 production 环境使用禁止收录的预览模式。API 和原生 App 不在此构建流程中。

## 迁移记录（2026-09-09）

- 由 `hugo-theme-stack` v4 迁移至 `hugo-theme-aiovtue` 整站方案
- 4 篇文章迁入 `content/posts/`，`image` → `cover`，并保留旧地址 `/p/<slug>/` 的跳转别名
- 保留站点身份：站名「Kukie的个人笔记」、头像、favicon、`www.kukie.cn`、Umami 统计
- 移除上游演示内容（示例文章、动态、相册、追番、留言页及收款码等个人素材）
- 未启用：音乐播放器、Live2D、鼠标指针、赞助（在 `hugo.toml` 中一键开关）
- 评论系统需按上文配置 Waline / Twikoo 后启用

## 更新主题

主题以目录形式 vendored 在 `themes/aiovtue/`。升级时对比上游仓库同名文件即可；本仓库对主题做了如下本地修改，合并时勿整体覆盖：

- `layouts/partials/head.html`（站点级覆盖：Umami 埋点）
- `themes/aiovtue/layouts/partials/scripts.html`（加载 Hero 随机图 `random.js`）
- `themes/aiovtue/assets/js/hero.js`（Hero 支持随机图：桌面横屏 / 移动竖屏，随机模式隐藏切换箭头）
- `themes/aiovtue/assets/css/main.scss`（随机图模式的箭头隐藏样式）
- `themes/aiovtue/layouts/partials/` 下 5 个文件（`links-preview` / `footer-links-prepare` / `post-sidebar-links` / `links-rss-spotlight` / `bangumi-board`）：`hugo.Data.*` → `site.Data.*`，兼容 Cloudflare Pages 默认 Hugo 0.147 构建
- 主题内 `friend-link-notice.html` 有个性化修改（如有）
