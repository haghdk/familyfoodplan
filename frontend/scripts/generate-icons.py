#!/usr/bin/env python3
"""Regenerate the Family Food Planner app icons.

The icon is the lucide "cooking-pot" glyph (the same mark used in the site
header) drawn in white on the brand green background.

All raster icons are derived from a single vector definition so the favicon,
the Apple touch icon and the web app manifest icons never drift apart.

Usage (requires `pip install cairosvg pillow`):

    python3 frontend/scripts/generate-icons.py
"""

from __future__ import annotations

import io
from pathlib import Path

import cairosvg
from PIL import Image

BRAND = "#2c7a5b"
BRAND_STRONG = "#226349"
GLYPH = "#ffffff"

# lucide-react "cooking-pot", drawn on a 24x24 grid.
COOKING_POT_PATHS = (
    "M2 12h20",
    "M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8",
    "m4 8 16-4",
    "m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8",
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent
APP_DIR = FRONTEND_DIR / "app"
ICONS_DIR = FRONTEND_DIR / "public" / "icons"


def build_svg(size: int, corner_radius_ratio: float, glyph_ratio: float) -> str:
    """Return an SVG string for one icon variant.

    `corner_radius_ratio` is the rounding of the background as a fraction of
    the canvas (0 keeps the background a full-bleed square, which is what iOS
    and maskable icons expect since the platform applies its own mask).
    `glyph_ratio` is how much of the canvas width the pot glyph occupies.
    """
    radius = size * corner_radius_ratio
    scale = size * glyph_ratio / 24
    center_x = size / 2
    # The glyph's ink sits slightly above the middle of its 24x24 grid, so the
    # optical centre is nudged down a touch.
    center_y = size * 0.512
    stroke_width = 2 if glyph_ratio >= 0.5 else 2.2

    paths = "\n    ".join(f'<path d="{d}" />' for d in COOKING_POT_PATHS)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <defs>
    <linearGradient id="pot-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{BRAND}" />
      <stop offset="1" stop-color="{BRAND_STRONG}" />
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{radius}" ry="{radius}" fill="url(#pot-bg)" />
  <g transform="translate({center_x} {center_y}) scale({scale}) translate(-12 -12)"
     fill="none" stroke="{GLYPH}" stroke-width="{stroke_width}"
     stroke-linecap="round" stroke-linejoin="round">
    {paths}
  </g>
</svg>
"""


def render_png(size: int, corner_radius_ratio: float, glyph_ratio: float) -> bytes:
    svg = build_svg(size, corner_radius_ratio, glyph_ratio)
    return cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        output_width=size,
        output_height=size,
    )


def write_png(path: Path, size: int, corner_radius_ratio: float, glyph_ratio: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(render_png(size, corner_radius_ratio, glyph_ratio))
    print(f"wrote {path.relative_to(FRONTEND_DIR)} ({size}x{size})")


def write_favicon(path: Path) -> None:
    """Write a multi-resolution .ico so desktop browsers stay crisp."""
    source = Image.open(io.BytesIO(render_png(256, 0.22, 0.58))).convert("RGBA")
    source.save(path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {path.relative_to(FRONTEND_DIR)} (16/32/48)")


def main() -> None:
    # Home screen icon for iOS/iPadOS. Full-bleed square: Safari rounds it.
    write_png(APP_DIR / "apple-icon.png", 180, 0.0, 0.58)

    # Android / Chrome web app manifest icons.
    write_png(ICONS_DIR / "icon-192.png", 192, 0.22, 0.58)
    write_png(ICONS_DIR / "icon-512.png", 512, 0.22, 0.58)

    # Maskable icon: keep the glyph inside the 80% safe zone so Android can
    # crop it to any shape without clipping the pot.
    write_png(ICONS_DIR / "icon-maskable-512.png", 512, 0.0, 0.45)

    write_favicon(APP_DIR / "favicon.ico")


if __name__ == "__main__":
    main()
