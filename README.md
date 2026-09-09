# Kukie 的个人笔记

基于 **Hugo + [hugo-theme-aiovtue](https://github.com/AIOVTUE/hugo-theme-aiovtue)**（整站方案）的个人博客，由原 `hugo-theme-stack` 版本迁移而来。

- 线上地址：https://www.kukie.cn/
- 内容语言：简体中文

## 目录结构

| 路径 | 说明 |
|------|------|
| `hugo.toml` | 站点全部配置（标题、Hero、导航、社交、页脚、评论等） |
| `content/posts/` | 文章，每篇一个 Markdown 文件，文件名即 URL slug |
| `content/about.md` | 关于页正文 |
| `content/links.md` + `data/links.yaml` | 友链页壳子与友链数据 |
| `content/archives/` `content/categories/` `content/tags/` `content/search.md` | 归档 / 分类 / 标签 / 搜索页 |
| `static/hero/` | 首页轮播媒体与头像（`avatar.jpg`） |
| `static/favicon.png` / `static/favicon.ico` | 网站图标 |
| `themes/aiovtue/` | 主题本体（随仓库 vendored，非 git submodule） |
| `layouts/partials/head.html` | 站点级 `<head>` 覆盖（已加入 Umami 统计，同步主题更新时留意） |
| `.github/workflows/deploy.yml` | GitHub Pages 自动部署 |

## 本地开发

需要 [Hugo Extended](https://gohugo.io/installation/)（0.146+，含内置 Dart Sass；主题作者使用 0.163）。

```bash
pnpm install        # 首次安装脚本依赖（sharp 等）
pnpm dev            # 启动开发服务器 http://localhost:1313
pnpm build          # 构建到 public/
```

> `pnpm dev` / `pnpm build` 会调用 `scripts/` 下的辅助脚本（补全静态资源、友链 RSS、追番数据）。
> 本项目未启用追番与友链 RSS，相关脚本会自动跳过；也可以只运行 `hugo server` 预览。

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

## 部署

- **GitHub Pages（当前默认）**：推送到 `main` / `master` 分支后由 `.github/workflows/deploy.yml` 自动构建部署。
- **Bing 收录推送（IndexNow，免账号）**：每次 GitHub Pages 部署完成后，`submit-indexnow` 任务自动拉取线上 `sitemap.xml` 并把全部 URL 提交到 `api.indexnow.org`（必应等参与搜索引擎共享），发版即推送。
  - key 文件：`static/92245a642338954199d4b6a48196c5ad.txt`（内容=文件名=32 位 hex，已随站部署；可访问 `https://www.kukie.cn/92245a642338954199d4b6a48196c5ad.txt` 验证）。
  - 手动重推：Actions 里对该工作流点 `Run workflow`，结果看 `submit-indexnow` 任务日志（HTTP 200/202 即成功）。
  - 更换域名或重新生成 key：同步修改 `deploy.yml` 的 `SITE_BASE` / `INDEXNOW_KEY`，并替换 `static/` 下同名 key 文件。
- **Cloudflare Pages / Vercel / Netlify**：仓库已附 `wrangler.toml`、`vercel.json`、`netlify.toml`，构建命令统一为 `pnpm run build`（CF 等平台会自动下载 Hugo Extended 0.163.3），输出目录 `public`。

部署前请确认 `hugo.toml` 中 `baseURL` 与最终访问域名一致。GitHub Pages 工作流会用 Actions 提供的 Pages URL 覆盖构建时的 `baseURL`（与迁移前行为一致）。

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
- 主题内 `friend-link-notice.html` 有个性化修改（如有）
