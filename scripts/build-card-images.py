#!/usr/bin/env python3
"""把公版韦特牌原始扫描件转制为站内使用的 WebP 牌面。

输入目录里应当是 mixvlad/TarotCards 仓库 tarot/rider-waite/full-png
（或 full）的内容，共 78 张牌 + 若干张封面：

    00_Fool.png ... 21_World.png      -> major-00.webp ... major-21.webp
    Cups01.png  ... Cups14.png        -> cups-01.webp  ... cups-14.webp
    Pents01.png ... Pents14.png       -> pentacles-01.webp ...
    Swords01.png ... Swords14.png     -> swords-01.webp ...
    Wands01.png ... Wands14.webp      -> wands-01.webp ...

封面（Cover / Cover_Rare）不参与转制。

用法：
    py scripts/build-card-images.py --src <原始扫描件目录> [--out public/img/cards]

来源与许可记录见 docs/image-sources.md。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image

SUIT_NAMES = {
    "Cups": "cups",
    "Pents": "pentacles",
    "Swords": "swords",
    "Wands": "wands",
}

MAJOR_PATTERN = re.compile(r"^(\d{2})_[A-Za-z_]+$")
MINOR_PATTERN = re.compile(r"^(Cups|Pents|Swords|Wands)(\d{2})$")

EXPECTED_MAJOR = 22
EXPECTED_MINOR = 56


def plan_outputs(src: Path) -> list[tuple[Path, str]]:
    """返回 (源文件, 输出文件名) 列表，按牌序排列。"""
    pairs: list[tuple[Path, str]] = []
    for path in sorted(src.iterdir()):
        if not path.is_file() or path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue
        stem = path.stem

        major = MAJOR_PATTERN.match(stem)
        if major:
            pairs.append((path, f"major-{major.group(1)}.webp"))
            continue

        minor = MINOR_PATTERN.match(stem)
        if minor:
            suit = SUIT_NAMES[minor.group(1)]
            pairs.append((path, f"{suit}-{minor.group(2)}.webp"))

    majors = [p for p in pairs if p[1].startswith("major-")]
    minors = [p for p in pairs if not p[1].startswith("major-")]
    if len(majors) != EXPECTED_MAJOR or len(minors) != EXPECTED_MINOR:
        raise SystemExit(
            f"源目录里的牌数不对：大阿卡纳 {len(majors)}/{EXPECTED_MAJOR}，"
            f"小阿卡纳 {len(minors)}/{EXPECTED_MINOR}。目录：{src}"
        )
    return sorted(majors) + sorted(minors)


def convert(src: Path, out_dir: Path, width: int, quality: int) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    total_before = 0
    total_after = 0
    count = 0

    for source_file, name in plan_outputs(src):
        with Image.open(source_file) as image:
            image = image.convert("RGB")
            if image.width != width:
                height = round(image.height * width / image.width)
                image = image.resize((width, height), Image.LANCZOS)
            target = out_dir / name
            image.save(target, "WEBP", quality=quality, method=6)
            total_before += source_file.stat().st_size
            total_after += target.stat().st_size
            count += 1
            print(f"  {source_file.name:24s} -> {name:20s} {image.width}x{image.height}")

    print(f"\n完成：{count} 张，{total_before / 1048576:.1f} MB -> {total_after / 1048576:.1f} MB")
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", required=True, type=Path, help="原始扫描件目录")
    parser.add_argument("--out", type=Path, default=Path("public/img/cards"), help="输出目录")
    parser.add_argument("--width", type=int, default=800, help="输出宽度，默认 800")
    parser.add_argument("--quality", type=int, default=82, help="WebP 质量，默认 82")
    args = parser.parse_args(argv)

    if not args.src.is_dir():
        parser.error(f"源目录不存在：{args.src}")

    convert(args.src, args.out, args.width, args.quality)
    print(f"输出目录：{args.out.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
