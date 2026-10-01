# 塔罗牌网站 (tarot-site)

一个关于塔罗牌的主题网站：**在线抽牌工具 + 牌义百科**。抽牌工具负责吸引用户与传播，78 张牌义页负责承接搜索流量，两者共用同一套内容。网站已经建好，可以本地运行，也可以直接部署到公网。

## 现在能做什么

- 完整的抽牌主流程：选问题 → 确认 → 洗牌翻牌 → 核心解读 → 反思问答（可跳过）→ 个性化解读 → 保存图片
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
pnpm verify     # 构建 + 冒烟测试：逐个路由校验内容、数据文件与脚本挂载
```

`pnpm test` 覆盖：78 张牌是否齐全、frontmatter 与图片是否一一对应、章节结构是否完整、分场景含义是否覆盖全部一级问题分类、语境层占比是否达标、状态机迁移、当天重抽限制、禁忌分类与拦截等级、分享出图内容与折行规则。

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

- 产品方向与流程：[docs/product-design.md](docs/product-design.md)
- 技术方案与落地细节：[docs/tech-solution.md](docs/tech-solution.md)
- 牌面素材来源与许可：[docs/image-sources.md](docs/image-sources.md)
- 建站与桌面入口的操作步骤：[docs/reference-steps.md](docs/reference-steps.md)

## 还没做的部分

- 部署到公网（Cloudflare Pages 或 Vercel）——代码已经就绪，只差关联账号
- 分享图的字体子集内嵌（当前用系统字体栈渲染，见技术方案 4.3）
- 逆位、三张牌阵、账号与收藏、大模型个性化解读，均在 MVP 之外
