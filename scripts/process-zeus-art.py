"""Knock out black grounds and composite Zeus inside the circular spin button."""

from __future__ import annotations

import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(r"c:\Users\ilkse\muta\assets\zeus")


def luma(p: tuple[int, int, int]) -> float:
    r, g, b = p
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def chroma(p: tuple[int, int, int]) -> int:
    return max(p) - min(p)


def flood_knockout(
    im: Image.Image,
    luma_cut: float = 24,
    chroma_cut: int = 18,
) -> Image.Image:
    rgb = im.convert("RGB")
    w, h = rgb.size
    pix = rgb.load()
    bg = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def is_bg(x: int, y: int) -> bool:
        p = pix[x, y]
        return luma(p) < luma_cut and chroma(p) < chroma_cut

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y):
                bg[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not bg[y][x] and is_bg(x, y):
                bg[y][x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and is_bg(nx, ny):
                bg[ny][nx] = True
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        row = bg[y]
        for x in range(w):
            r, g, b = pix[x, y]
            if row[x]:
                op[x, y] = (r, g, b, 0)
                continue
            lv = luma((r, g, b))
            ch = chroma((r, g, b))
            near = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and bg[ny][nx]:
                    near = True
                    break
            if near and lv < 48 and ch < 28:
                a = int(max(0, min(255, (lv - 8) * 8)))
                op[x, y] = (r, g, b, a)
            else:
                op[x, y] = (r, g, b, 255)
    return out


def alpha_bbox(im: Image.Image, pad_ratio: float = 0.02) -> Image.Image:
    a = im.getchannel("A")
    bbox = a.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    w, h = im.size
    pad = int(max(w, h) * pad_ratio)
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(w, r + pad)
    b = min(h, b + pad)
    return im.crop((l, t, r, b))


def square_pad(im: Image.Image, fill: tuple[int, int, int, int] = (0, 0, 0, 0)) -> Image.Image:
    w, h = im.size
    s = max(w, h)
    canvas = Image.new("RGBA", (s, s), fill)
    canvas.paste(im, ((s - w) // 2, (s - h) // 2), im)
    return canvas


def process_cutout(path: Path, luma_cut: float = 24, chroma_cut: int = 18, size: int = 1024) -> None:
    raw = Image.open(path)
    cut = flood_knockout(raw, luma_cut=luma_cut, chroma_cut=chroma_cut)
    cut = alpha_bbox(cut, 0.018)
    cut = square_pad(cut)
    cut = cut.resize((size, size), Image.Resampling.LANCZOS)
    cut.save(path, "PNG", optimize=True)
    a = cut.getchannel("A")
    print(f"  cutout {path.name:28} alpha={a.getextrema()} size={cut.size}")


def circular_mask(size: int, inner: float, outer: float, feather: float = 0.012) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    px = mask.load()
    cx = cy = (size - 1) / 2
    max_r = size / 2
    inner_r = inner * max_r
    outer_r = outer * max_r
    feat = feather * max_r
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d < inner_r - feat:
                a = 0
            elif d < inner_r:
                a = int(255 * (d - (inner_r - feat)) / max(feat, 0.001))
            elif d <= outer_r:
                a = 255
            elif d < outer_r + feat:
                a = int(255 * (1 - (d - outer_r) / max(feat, 0.001)))
            else:
                a = 0
            px[x, y] = max(0, min(255, a))
    return mask


def cover_into(src: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    bw = box[2] - box[0]
    bh = box[3] - box[1]
    sw, sh = src.size
    scale = max(bw / sw, bh / sh)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    cx = (nw - bw) // 2
    # Bias toward the head for portraits.
    cy = max(0, int((nh - bh) * 0.12))
    cropped = resized.crop((cx, cy, cx + bw, cy + bh))
    return cropped


def composite_spin() -> None:
    spin_path = ROOT / "ui" / "spin_button.png"
    zeus_path = ROOT / "character" / "zeus_idle.png"

    spin_raw = Image.open(spin_path).convert("RGB")
    w, h = spin_raw.size
    frame = flood_knockout(spin_raw, luma_cut=16, chroma_cut=14)
    frame_a = circular_mask(w, inner=0.0, outer=0.86, feather=0.01)
    frame.putalpha(Image.composite(frame.getchannel("A"), Image.new("L", (w, h), 0), frame_a))

    # Keep only the ornate gold rim so Zeus fills the inside.
    rim = circular_mask(w, inner=0.455, outer=0.86, feather=0.018)
    rim_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rim_img.paste(frame, (0, 0), Image.composite(frame.getchannel("A"), Image.new("L", (w, h), 0), rim))

    zeus = flood_knockout(Image.open(zeus_path), luma_cut=20, chroma_cut=16)
    zeus = alpha_bbox(zeus, 0.0)
    zw, zh = zeus.size
    # Head + torso for a circular bust.
    bust = zeus.crop((0, 0, zw, int(zh * 0.62)))
    bust = square_pad(bust)

    size = 1024
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner_box = (int(size * 0.08), int(size * 0.08), int(size * 0.92), int(size * 0.92))
    portrait = cover_into(bust, inner_box)

    circle = Image.new("L", (size, size), 0)
    cp = circle.load()
    cx = cy = (size - 1) / 2
    rad = size * 0.42
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d <= rad - 3:
                cp[x, y] = 255
            elif d < rad:
                cp[x, y] = int(255 * (rad - d) / 3)

    portrait_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    portrait_layer.paste(portrait, inner_box[:2], portrait)
    portrait_layer.putalpha(Image.composite(portrait_layer.getchannel("A"), Image.new("L", (size, size), 0), circle))

    # Warm fill behind Zeus so no holes read as black.
    fill = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fp = fill.load()
    for y in range(size):
        for x in range(size):
            a = cp[x, y]
            if a:
                # Deep gold-navy, not black.
                fp[x, y] = (42, 24, 8, int(a * 0.92))

    canvas = Image.alpha_composite(canvas, fill)
    canvas = Image.alpha_composite(canvas, portrait_layer)

    rim_scaled = rim_img.resize((size, size), Image.Resampling.LANCZOS)
    canvas = Image.alpha_composite(canvas, rim_scaled)
    canvas = canvas.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))
    canvas = alpha_bbox(canvas, 0.004)
    canvas = square_pad(canvas).resize((size, size), Image.Resampling.LANCZOS)
    canvas.save(spin_path, "PNG", optimize=True)
    print(f"  spin   {spin_path.name:28} alpha={canvas.getchannel('A').getextrema()}")


def main() -> None:
    print("Processing Zeus cutouts…")
    for p in sorted((ROOT / "symbols").glob("*.png")):
        process_cutout(p, luma_cut=22, chroma_cut=16, size=768)
    process_cutout(ROOT / "effects" / "coin.png", luma_cut=20, chroma_cut=14, size=768)
    process_cutout(ROOT / "character" / "zeus_idle.png", luma_cut=18, chroma_cut=15, size=1024)
    print("Compositing Zeus into spin button…")
    composite_spin()
    print("done")


if __name__ == "__main__":
    main()
