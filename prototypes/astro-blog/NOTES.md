# Astro 博客设计预览

问题：原 Hugo 博客改为更轻、更重视阅读的杂志式布局，是否适合继续迁移到 Astro？

本目录提供 Astro 网站前端。根目录构建入口现已接入本项目，保留 Hugo 配置、主题、文章和旧构建脚本；Go 服务端、管理后台和 Android App 的迁移另行处理。评论使用真实 giscus 讨论区，提交评论会写入远端，并非模拟数据。

此预览固定使用 Astro 5.18.2：本机是 Android / Termux，Astro 7 的 Satteri 原生 Markdown 依赖没有对应的 Android 二进制。正式迁移时再按部署环境确认 Astro 版本，不为预览改动全局工具链。

视觉方向：纸白、墨绿、细线条、大字排印与现有动漫图片。桌面采用阅读区和窄侧栏，移动端优先展示内容。不使用音乐播放器、鼠标特效、自动轮播或全屏加载动画。

## 运行

在仓库根目录执行：

```sh
npm --prefix prototypes/astro-blog install
npm --prefix prototypes/astro-blog run dev
```

预览地址：`http://localhost:8085/`。若端口被占用，不应停止其他项目；先确认后再分配端口。

静态预览：

```sh
npm --prefix prototypes/astro-blog run build
npm --prefix prototypes/astro-blog run preview
```

从 `../../content/posts/**/*.md` 读取真实文章，从 `../../static` 读取图片和字体。修改文章后，开发模式会更新；静态预览需要重新构建。设计稿没有数据库，也不请求管理后台 API。

PWA 需要使用 `build` 后的 `preview` 检查，开发模式不注册 Service Worker。安装与离线阅读要求 HTTPS 或 localhost，普通局域网 HTTP 只能预览页面。缓存限于本站阅读页面和静态资源，不缓存公告接口、giscus、登录请求或其他跨域请求。

## 已包含与边界

- 首页、分类筛选、标题/摘要/标签搜索、嵌套路径文章、目录、归档、关于页、友链模板与申请入口、日夜主题。
- Astro 页面过渡、日夜斜切切换、可扩展的“更多”导航、公告弹窗和 PWA 离线阅读。
- 公告沿用 Hugo 配置中的远端数据源：只关闭则刷新再弹，勾选“今日不再弹出”后当天不再自动弹出，站内切页不重复打扰。
- 评论暂用 `qiuyuxc/fuwari-giscus`，配置在 `src/config/comments.ts`，生命周期在 `src/scripts/comments.ts`；每次 `astro:page-load` 挂载，离开前取消请求和监听。保留现有后端 API，尚未接入它的登录和评论。
- 友链申请入口指向本站仓库 `qiuyuxc/hugo` 的新建 Issue 页面，预填标题与 JSON 申请模板；不自动导入 Fuwari 的友链列表。
- 原始 Markdown 和图片不搬动；保留 `/posts/<原文件路径>/` 用于本轮体验，不代表已经核对全部 Hugo 历史 URL。
- 子项目本地预览设置 `noindex`；根目录正式构建允许收录，并生成 canonical、站点地图、RSS 与旧地址跳转。公告只读，评论使用真实第三方服务，管理后台 API 尚未接入。
- 正式迁移前需要单独确认：设计方向、历史 URL/重定向、RSS、sitemap、SEO、搜索索引、评论与公告方案、构建部署及完整内容兼容性。

部署方式：根目录 `pnpm run build` 构建 Astro 到 `public/`；直接运行子项目 build 继续输出至其 `dist/` 供本地验证。上线配置见仓库 README，API 迁移尚未完成。

2026-10-06 菜单收尾：按用户要求移除“更多”中的“更新阅读应用”按钮及其专用前端更新逻辑，继续提供“安装到桌面”。后续安装方式暂定为：移动端选择下载原生 APP 或使用浏览器安装，PC 端直接使用浏览器安装到桌面。该选择框与 APP 下载入口待迁移、接入现有 API 后再处理；本轮只移除更新按钮。

底部“Astro 设计预览”原先未区分运行环境，正式构建也会展示。现按用户要求移除整个浮动标记和对应样式，本地预览与构建产物均不再显示。此调整不代表已把现有 Hugo 部署入口切换到 Astro。

后续部署修正：用户在 Cloudflare 改为 Astro 预设后仍构建 Hugo，原因是根目录 build 仍调用旧 Hugo 脚本。现将默认入口接到 Astro，输出目录保持 `public/`；旧 Hugo 构建独立保留为 `scripts/build-hugo.mjs`。同时补齐正式页面收录、RSS、站点地图和当前线上旧 URL 的跳转。`_redirects` 使用注入端点生成，因为 Astro 会忽略以下划线开头的页面源文件。

## 本轮验证

2026-10-05：静态构建生成 17 个页面，浏览器检查覆盖 320、375、768、1440px 首页及 375px 主要内页。分类筛选、搜索及空结果、主题切换、字号调整、目录跳转、嵌套文章路径和无 JavaScript 正文阅读通过；未发现页面横向溢出或脚本异常。检查了桌面、深色、手机首页和阅读页截图，修正了封面比例。

本机截图位于仓库 `.local/astro-preview-qa/`，验证脚本位于 `.local/astro-preview-qa.mjs`；这些临时证据不进入源码提交。

2026-10-05 第二轮接管验证：静态构建生成 18 个页面；真实公告获取、刷新重复弹出、当日隐藏与过期恢复、连续跳页和历史前进后退、giscus 挂载与主题同步、友链复制反馈、搜索和字号监听、PWA 注册、已读文章离线访问和未缓存页面回退均通过。未发现页面脚本异常或控制台错误，未执行真实评论发布或账号登录。

截图发现新增的 View Transition 层叠上下文让正文遮挡“更多”菜单。已为页头设置定位与层级，并在 320、375、768、1440px 下同时检查溢出和 `elementFromPoint` 点击命中。另修正了离线测试：仅对页面应用 DevTools 离线模拟时，Service Worker 仍可联网，测试现在同时断开 Worker 网络并验证底层请求失败。

第二轮本机证据位于 `.local/astro-v2-qa/`，回归脚本位于 `.local/astro-v2-qa.mjs`，最近结果位于 `.local/astro-v2-qa-takeover.log`。这些是本机临时验证材料，不属于项目正式测试套件。浏览器安装提示、手机独立应用模式和正式域名部署仍需单独验收。

## 页脚与阅读切换调整

2026-10-05：页脚继续读取 `hugo.toml` 的 `params.footer.serverInfo`，把旧版彩色 Hosted 徽章改为细分隔线与服务提供方名称。保留手动 CDN 优先、响应头识别与可选 ASN 兜底，滚动接近页脚才请求；识别结果在本次页面会话缓存五分钟，离开页面取消尚未完成的请求。localhost 明确显示“本地预览”，跨域响应头不可读时显示“未识别”，不把它误报成离线。旧配置中的评论服务标为“评论 API”，并不意味着当前 giscus 评论已经改回该 API。

切页参考本机 Fuwari 源码的淡出与向上入场节奏，使用 160ms 离场、延迟 140ms 的 280ms 入场，避免新旧内容同时叠加；仍使用 Astro ClientRouter 和原有评论生命周期，不引入第二套路由器。减少动态效果偏好下禁用动画。

刷新位置处理：Astro 在初始化时会读取历史记录中的滚动位置，而该位置通常在 `scrollend` 后更新。专项测试模拟最后一个 `scrollend` 缺失，确认仅在 `pagehide` 修改历史状态仍会恢复旧位置，因为刷新已取得历史快照。现在在离页时把实际位置保存到当前标签页的 `sessionStorage`，并在 ClientRouter 之前仅针对相同 URL、历史索引的刷新恢复它；恢复后立即清除临时数据，不干预新链接的锚点或浏览器前进后退。首屏加载时也不再应用全局平滑滚动，页面就绪后再启用站内锚点平滑滚动。

新增专项回归位于 `.local/astro-footer-scroll-qa.mjs`，结果位于 `.local/astro-footer-scroll-qa.log`，日夜页脚和切换截图位于 `.local/astro-footer-qa/`。覆盖缺失滚动结束事件的顶部刷新、带 `#notes` 的顶部刷新、正文中途刷新、列表返回位置、新文章回顶、CDN 懒加载与路由缓存，以及四种屏幕宽度。CDN 响应头用例与对应截图使用可控的 Tengine 响应，不代表真实远端当时的识别结果。

静态构建通过，原有评论、公告、PWA 与路由回归通过。额外执行 `tsc --noEmit` 时，现有 `src/pages/app-icon-[size].png.ts` 仍报 `node:fs/promises`、`node:path` 类型声明缺失；本轮未调整这项已有依赖配置。

## 2026-10-06 接管验证

重新构建生成 18 个页面，并恢复 `http://localhost:8085/` 静态预览。评论与公告、路由和主题、PWA 离线阅读、页脚 CDN、顶部及正文中途刷新位置两组浏览器回归全部通过；检查了桌面公告、手机菜单和日夜页脚截图，320、375、768、1440px 的布局与菜单点击命中正常。CDN 响应头仍使用专项测试中的可控响应，不代表真实远端探测结果。

补齐独立预览项目的 `@types/node` 和显式 `typescript` 开发依赖，解决上轮图标端点缺少 Node 类型声明的问题。运行 `npm --prefix prototypes/astro-blog run check:types` 可先同步 Astro 类型再检查 TypeScript 文件，当前通过；此命令不替代 `.astro` 模板的专用类型检查。

本次回归日志为 `.local/astro-v2-qa-20261006.log` 和 `.local/astro-footer-scroll-qa-20261006.log`。正式迁移、发布和手机实际安装 PWA 的边界维持不变。

## 公告与页面动效补齐

2026-10-06：公告增加面板及遮罩入场、双层几何图形旋转、正文淡入和关闭退场。几何开场持续 720ms，内容提前占位避免弹窗突然改变尺寸；期间保留关闭按钮，关闭或切页会取消待执行的正文展示。今日隐藏与刷新再次弹出的规则沿用现有逻辑，减少动态效果时直接展示内容并即时关闭。

浏览器事件与动画记录确认：常规路由已有切换动画，缺口是刷新、首次打开和分类/搜索结果更新。共享布局现为首次打开或刷新提供 440ms 入场，路由切换保留 160ms 离场并把入场调整到 360ms；列表更新按行淡入，连续筛选会取消上一轮动画。首次入场标记在切页前清除，避免与路由过渡重复播放。

新增 `tests/motion.mjs`，通过 `npm --prefix prototypes/astro-blog run test:motion` 运行。需要先构建并启动 8085 静态预览，以及端口 9227 的独立 Chromium 调试实例；可用 `PREVIEW_ORIGIN` 和 `CDP_URL` 修改地址。测试会清理预览地址的浏览器存储，应使用专门的测试浏览器配置目录。动效测试拦截公告请求并使用固定内容，真实远端公告由原有生命周期回归验证。

类型检查、静态构建、新增动效回归及原有评论/PWA/滚动位置回归通过。动效用例涵盖八条页面跳转的原生与兼容模式、刷新、筛选、几何开场、提前关闭、开场中切页及减少动态效果；手机与桌面截图位于 `.local/astro-motion-qa/`。日志为 `.local/astro-motion-qa.log`、`.local/astro-motion-lifecycle-qa.log` 和 `.local/astro-motion-scroll-qa.log`。

## 文章点击等待与 Fuwari 对照

2026-10-06：用户再次反馈文章点击后等待、随后突然切换。此前检查只验证动画存在，没有检查请求等待期间的视觉反馈与实际中间帧，因此未覆盖这类问题。

重新读取 GitHub 上 Fuwari 的 [Swup 配置](https://github.com/qiuyuxc/fuwari/blob/main/astro.config.mjs)、[动画样式](https://github.com/qiuyuxc/fuwari/blob/main/src/styles/transition.css) 和 [页面钩子](https://github.com/qiuyuxc/fuwari/blob/main/src/layouts/Layout.astro)。它启用缓存与预加载，旧内容采用 200ms 淡出与 16px 下移，新内容采用 300ms、32px 上移淡入，点击时清除额外的内容延迟。

本项目此前在 Astro 完成页面准备后才启动截图过渡。阻塞文章 HTML 请求时，旧页面透明度一直为 1；CPU 降速记录还显示页面排版占用较长任务。现在 `src/scripts/page-transitions.ts` 在 `astro:before-preparation` 中同时开始请求与 200ms 退场，替换内容时跳过路由截图动画，在页面钩子及布局处理后，对实际正文播放 300ms 入场。Astro 继续负责导航、历史记录和现有页面生命周期。刷新入场与公告动画继续保留，日夜扫光在路由动效结束后可用。

取消或被后续导航替代时会清理动画、待执行帧、内容隐藏状态和忙碌标记，避免旧请求再次改变页面。主动跳过截图过渡的 `ready` Promise 拒绝由本模块处理。

新增 `npm --prefix prototypes/astro-blog run test:navigation`，沿用上述独立预览及 Chromium 调试环境。该用例在旧实现上因“文章请求仍阻塞时没有退场反馈”失败；覆盖阻塞请求、4 倍 CPU 降速下的入场中间帧、连续跳转取消、日夜切换互斥及减少动态效果。此次日志位于 `.local/astro-navigation-qa.log`，路由动效、原有生命周期与滚动回归分别记录于 `.local/astro-navigation-motion-qa.log`、`.local/astro-navigation-lifecycle-qa.log` 和 `.local/astro-navigation-scroll-qa.log`。性能记录为本机测试证据，不代表真实设备上的固定耗时。

## 立体几何加载动画

2026-10-06：站内切页开始时显示双层半透明线框立方体，以相反方向旋转，并显示“正在翻开下一页”。加载指示覆盖请求、页面替换和布局等待阶段，正文开始入场时用 160ms 淡出；不增加额外的最短加载时长。公告保留原有几何开场。加载动画提供等待反馈，不代表页面布局耗时已消除。

`PageLoader.astro` 通过 Astro 的 `transition:persist` 保留节点。浏览器验证发现，跨 body 移动仍会重启 CSS 动画；页面过渡脚本现在在替换前记录动画起始时间，替换后恢复，使旋转和出现动画保持进度。取消、失败或离页时清理加载状态，连续导航取消上一轮淡出；减少动态效果时显示静态几何图形，并在内容就绪后立即隐藏。

类型检查与 18 页静态构建通过。导航测试覆盖阻塞请求时的旋转、跨页面替换的节点和动画时间线保留、正文入场后的隐藏、取消与减少动态效果；动效、评论/公告/PWA 生命周期及滚动位置回归全部通过。日志为 `.local/astro-loader-navigation-qa.log`、`.local/astro-loader-motion-qa.log`、`.local/astro-loader-lifecycle-qa.log` 和 `.local/astro-loader-scroll-qa.log`。手机浅色与桌面深色截图位于 `.local/astro-navigation-qa/request-pending.png` 和 `.local/astro-navigation-qa/request-pending-dark-desktop.png`。

## 首页刷新位置规则

2026-10-06：用户反馈“打开文章、返回首页、刷新”会再次落在文章列表。浏览器记录确认，旧逻辑把返回时的列表位置写入刷新恢复状态，Astro 初始化后直接恢复到该位置。现在首页刷新统一从顶部开始，在 ClientRouter 初始化之前将恢复位置归零，并清除遗留的 `#notes`，保留历史索引、查询参数及其他锚点。直接打开锚点链接、点击“翻开我的笔记”、浏览器前进后退和其他页面的刷新恢复继续沿用原有行为；首页归零不依赖 sessionStorage 是否可用。

专项测试为 `npm --prefix prototypes/astro-blog run test:scroll`，使用与导航测试相同的独立 8085 预览和 9227 Chromium 环境。覆盖桌面/手机打开文章再返回并刷新、首次恢复直接位于顶部、带 `#notes` 和分类参数的首页、历史前进后退，以及存储不可用和历史状态缺失。桌面文章中途刷新也检查了原有位置恢复。修复前的失败证据位于 `.local/astro-home-refresh-before.log`，修复后与原有滚动回归分别记录于 `.local/astro-home-refresh-after.log`、`.local/astro-home-refresh-regression.log`。

用户进一步指出返回后地址仍是 `/#notes`。上一轮测试只验证回顶，并要求保留锚点；现改为从实际“翻开我的笔记”按钮进入列表，再打开文章、返回和连续刷新，检查首页位置与地址同时恢复，历史索引不变，分类查询参数继续保留。文章的“回到笔记”和“继续翻翻”同样指向 `/#notes`，也分别验证了返回后刷新。锚点修复前失败日志为 `.local/astro-notes-anchor-before.log`，修复后为 `.local/astro-notes-anchor-after.log`。

额外观察：手机文章刷新时，初始恢复目标与保存值一致，但后续页面布局可能再次改变滚动位置（本次记录为 1800px → 1590px）。此处没有修改文章布局；专项测试的文章像素位置断言仅覆盖桌面，不据此宣称手机文章刷新位置已完整验证。
