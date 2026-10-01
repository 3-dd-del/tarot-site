# 塔罗牌网站 (tarot-site)

一个关于塔罗牌的主题网站：**在线抽牌工具 + 牌义百科**。抽牌工具负责吸引用户与传播，78 张牌义页负责承接搜索流量，两者共用同一套内容。网站已经建好，可以本地运行，也可以直接部署到公网。

**在线访问**：<https://3-dd-del.github.io/tarot-site/>

## 现在能做什么

- 完整的抽牌主流程：选问题 → 确认 → 选牌阵 → 自己洗牌、逐张抽、逐张翻 → 按牌位解读 → 反思问答（可跳过）→ 个性化解读 → 保存图片
- 三个牌阵：单张牌、时间流（过去 · 现在 · 未来）、处境牌阵（现状 · 阻碍 · 建议）
- 正逆位：洗牌时随机倒转，逆位只加一段解读、不改牌指向的方向，出图同样旋转
- 78 张牌义页：22 张大阿卡纳完整版，56 张小阿卡纳简化版
- 入门路径 7 课、愚者的旅程 22 站
- 内容禁忌硬拦截：生死与自伤终止解读并给出求助渠道，健康、数字、赌博、违法各有对应处理
- 全程零后端：状态存 sessionStorage，出图在客户端 Canvas 完成，问题内容不上传

## 本地运行

```bash
pnpm install
pnpm dev        # 开发预览，默认 http://localhost:4321
pnpm build      # 生成静态站点到 dist/
pnpm preview    # 预览构建产物
```

## 验证与测试

```bash
pnpm test       # 内容与文档校验（Node 内置测试）+ 单元测试（Vitest）
pnpm verify     # 构建 + 冒烟 + 端到端：逐个路由校验内容，再用 jsdom 把抽牌流程从选问题跑到收尾
```

`pnpm test` 覆盖：78 张牌是否齐全、frontmatter 与图片是否一一对应、章节结构是否完整、分场景含义是否覆盖全部一级问题分类、语境层占比是否达标、牌阵定义与牌位、逆位是否逐张接回自己的牌义、状态机迁移、当天重抽限制、禁忌分类与拦截等级、分享出图内容与折行规则。

## 桌面快捷方式

先构建一次，然后运行创建脚本：

```bash
pnpm build
powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1
```

桌面会出现「塔罗牌」图标，双击即可打开网站。入口调用的是 `scripts/serve.ps1`——只用 Windows 自带的 PowerShell 起一个本地静态服务，**不需要安装 Node**。关掉那个命令行窗口，服务就停了。

图标由 `node scripts/make-icon.mjs` 生成（`public/favicon.ico`、`assets/tarot.ico` 等），不依赖任何图像工具。

## 目录结构

```text
├── docs/                      # 产品设计、技术方案、素材来源、参考步骤
├── public/
│   ├── img/cards/             # 78 张牌面 WebP（800×1333）
│   └── sw.js                  # Service Worker，用于「安装此站点为应用」
├── scripts/
│   ├── build-card-images.py   # 牌面转制
│   ├── make-icon.mjs          # 站点图标生成
│   ├── serve.ps1              # 桌面入口用的本地静态服务器
│   ├── create-shortcut.ps1    # 创建桌面与开始菜单快捷方式
│   └── smoke.mjs              # 构建产物的冒烟测试
├── src/
│   ├── content/cards/         # 78 张牌数据（frontmatter + MDX 正文）
│   ├── content/learn/         # 入门路径 7 课
│   ├── lib/                   # 状态机、三层解读、禁忌拦截、随机抽牌、出图
│   ├── pages/                 # 首页 / read / cards / learn / journey / about
│   └── scripts/read-app.ts    # 抽牌岛，唯一的客户端脚本
└── tests/                     # 内容校验、单元测试
```

## 文档

- 产品方向、流程、占卜方法与用户旅程：[docs/product-design.md](docs/product-design.md)
- 技术方案与落地细节：[docs/tech-solution.md](docs/tech-solution.md)
- 牌面素材来源与许可：[docs/image-sources.md](docs/image-sources.md)
- 建站与桌面入口的操作步骤：[docs/reference-steps.md](docs/reference-steps.md)

## 发布与镜像

打一个 `v*` 标签，就会触发 `.github/workflows/release.yml`：跑测试与构建、把 `dist/` 打成 zip 作为 Release 附件、构建容器镜像推到 GitHub Packages，最后建 Release。用的是仓库内置的 `GITHUB_TOKEN`，不需要额外配置 secret。

```bash
git tag v0.3.0
git push origin v0.3.0
```

产物有两份：

- **Release 附件**：`tarot-site-dist.zip`，构建好的静态站点，解压后用任意静态服务器托管
- **容器镜像**：`ghcr.io/3-dd-del/tarot-site:0.3.0` 与 `:latest`

本地打镜像（需要先构建，镜像里只放 `dist/` 的静态文件）：

```bash
pnpm build
docker build -t tarot-site .
docker run --rm -p 8080:80 tarot-site
```

发布说明写在根目录的 `RELEASE_NOTES.md`，每次发版前更新它。

## 部署到 GitHub Pages

推到 `main` 就会触发 `.github/workflows/pages.yml`：跑测试、构建、按子路径改写链接，然后发布到 <https://3-dd-del.github.io/tarot-site/>。第一次需要仓库开启 Pages（Settings → Pages → Source 选 GitHub Actions），之后全自动。

站点源码里的链接都是根路径（`/_astro/…`、`/img/…`、`/data/cards.json`），而 Pages 的项目站点挂在 `/tarot-site/` 这种子路径下，根路径会整站 404。所以构建之后要多跑一步 `scripts/prefix-dist.mjs`，把产物里的根路径统一加上前缀——**只动构建产物，源码、本地构建、Release 附件和容器镜像都不受影响**。

想本地预览子路径版本：

```bash
pnpm build
node scripts/prefix-dist.mjs /tarot-site
# 再用任意静态服务器把 dist/ 挂在 /tarot-site/ 下访问
```

## 还没做的部分

- 自己的域名（Cloudflare Pages 或 Vercel 绑定）——GitHub Pages 已经能访问，想要独立域名时再走这条路
- 分享图的字体子集内嵌（当前用系统字体栈渲染，见技术方案 4.3）
- 二选一（五张）牌阵、凯尔特十字、账号与收藏、大模型个性化解读，均在 MVP 之外
