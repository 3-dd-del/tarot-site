# 牌面素材来源与许可记录

本文件记录站内牌面图片的来源、版权状态与转制方式。牌面素材属于「容易被忽略但一旦出问题就很麻烦」的部分，任何新增素材都要在这里留一行记录。

## 当前使用：1909 年韦特牌公版扫描件

| 项目 | 内容 |
|---|---|
| 牌组 | Rider-Waite-Smith tarot（韦特体系） |
| 原出版方 | Rider & Company，英国，1909 年 |
| 原画师 | Pamela Colman Smith（1878–1951） |
| 构思与文字 | Arthur Edward Waite |
| 扫描版本 | 1909 年 "Pam-A" 印刷版的第三方扫描件，由 Steve P. 清理修复 |
| 原始来源 | https://steve-p.org/cards/RWSa.html |
| 获取途径 | `github.com/mixvlad/TarotCards` 仓库 `tarot/rider-waite/full-png/`（无损 PNG，1086×1810） |
| 许可 | 公有领域（Public Domain） |
| 站内文件 | `public/img/cards/*.webp`，800×1333，WebP 质量 82 |
| 转制脚本 | `scripts/build-card-images.py` |

### 版权状态

- **美国**：1909 年出版，早于 1930 年，已进入公有领域。
- **中国**：作者 Pamela Colman Smith 于 1951 年去世，著作权保护期为作者终生加死后 50 年，2001 年起已届满。
- 因此原版画作可以自由复制、修改、商用，无需付费，也无需强制署名。

### 必须注意的两点

1. **不要使用 1971 年美国游戏公司（U.S. Games Systems）的重新上色版本。** 那一版有独立的版权主张，不属于公有领域。判断特征：颜色更鲜艳饱和、线条有数字化修复痕迹。本项目使用的 1909 年扫描件颜色偏柔和、带纸张质感。
2. **「Rider-Waite」「Rider-Waite-Smith」是美国游戏公司的注册商标。** 图片可以自由使用，但不要在站名、产品名或品牌标识中使用这两个词。站内统一使用「韦特体系」「经典塔罗」「公版韦特」这类描述性说法。

### 署名建议

公有领域素材不强制署名，但建议在「关于」页面保留一行：

> 牌面为 1909 年 Rider & Company 出版、Pamela Colman Smith 绘制的韦特塔罗，已进入公有领域。扫描与修复：Steve P.（steve-p.org）。

## 文件命名规则

文件名与第 5 节的牌数据 `id` 一一对应：

| 范围 | 文件名 | 说明 |
|---|---|---|
| 大阿卡纳 0–21 | `major-00.webp` … `major-21.webp` | 22 张 |
| 权杖 | `wands-01.webp` … `wands-14.webp` | 01–10 为数字牌，11–14 依次为侍从、骑士、王后、国王 |
| 圣杯 | `cups-01.webp` … `cups-14.webp` | 同上 |
| 宝剑 | `swords-01.webp` … `swords-14.webp` | 同上 |
| 星币 | `pentacles-01.webp` … `pentacles-14.webp` | 同上 |

逆位不单独准备图片，前端旋转 180° 即可。

## 备选素材（未采用，仅作记录）

| 来源 | 分辨率 | 未采用原因 |
|---|---|---|
| `github.com/searge/tarot` | 350×600 | 分辨率过低，移动端高分屏会糊 |
| Wikimedia Commons `Category:Rider-Waite tarot deck` | 视文件而定 | 来源最权威，但当前网络环境下无法直连下载 |

## 更新流程

1. 从上述来源取回原始扫描件，确认是 1909 年版本而非 1971 年翻新版
2. 运行 `py scripts/build-card-images.py --src <原始目录> --out public/img/cards`
3. 运行 `npm test`，确认 78 张牌齐全、尺寸与体积符合预期
4. 在本文件中补上新的来源与许可信息
