# 塔罗牌网站 (tarot-site)

一个关于塔罗牌的主题网站。

## 当前状态

项目刚刚建立，网站尚未开始搭建，牌面素材已就位。

产品方向与流程设计见 [docs/product-design.md](docs/product-design.md)。
技术方案与落地细节见 [docs/tech-solution.md](docs/tech-solution.md)。
牌面素材的来源与许可记录见 [docs/image-sources.md](docs/image-sources.md)。

## 规划中的方向

暂定 MVP 形态为 **「在线抽牌工具 + 牌义百科」**：

- 抽牌工具负责吸引用户与传播
- 牌义页面负责承接搜索流量
- 两者互相导流，同一套内容复用两次

## 待定事项

- [ ] 确定站点主方向（资料站 / 抽牌工具 / 自媒体 / 教学社群）
- [ ] 确定主要面向国内还是海外用户
- [x] 技术选型 —— Astro + Content Collections + MDX + Tailwind，决策见 [产品设计文档第 7 节](docs/product-design.md)，落地细节见 [技术方案](docs/tech-solution.md)
- [ ] 22 张大阿卡纳牌义内容
- [x] 牌面图像素材 —— 采用 1909 年公版韦特扫描件，转制为 `public/img/cards/*.webp`（800×1333）

## 本地开发

```bash
pnpm install
pnpm dev
```

## 素材校验

牌面只需 Node，无需安装依赖即可校验：

```bash
pnpm test
```

校验内容包括：78 张牌是否齐全、文件名是否符合命名规则、是否为有效 WebP、尺寸与体积是否在预算内，以及来源记录文件是否存在。
