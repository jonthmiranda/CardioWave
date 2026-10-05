"""Gera os ícones do CardioWave (PNG) a partir de desenho procedural.

Uso: python3 tools/make-icons.py
Saída: assets/icons/icon-192.png, icon-512.png, icon-maskable-512.png,
       apple-touch-icon.png, favicon-32.png
"""
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
BASE = 1024

NAVY_TOP = (14, 26, 54)
NAVY_BOTTOM = (4, 7, 15)
HEART_TOP = (255, 94, 120)
HEART_BOTTOM = (176, 18, 58)
CYAN = (61, 232, 255)


def vertical_gradient(size, top, bottom):
    gradient = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / (size - 1)
        gradient.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return gradient.resize((size, size))


def heart_points(cx, cy, scale):
    points = []
    for step in range(361):
        t = math.radians(step)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        points.append((cx + x * scale, cy - y * scale))
    return points


def ecg_points(cx, cy, half_width, amplitude):
    unit = half_width / 10.0
    shape = [
        (-10, 0), (-6.5, 0), (-5.5, -0.35), (-4.5, 0), (-3, 0),
        (-2.2, 0.55), (-1, -3.4), (0.4, 2.2), (1.2, 0), (2.5, 0),
        (3.6, -0.7), (5, 0), (10, 0),
    ]
    return [(cx + x * unit, cy + y * amplitude) for x, y in shape]


def glow(layer, radius, strength=1.0):
    blurred = layer.filter(ImageFilter.GaussianBlur(radius))
    if strength != 1.0:
        alpha = blurred.getchannel("A").point(lambda v: min(255, int(v * strength)))
        blurred.putalpha(alpha)
    return blurred


def render(content_scale):
    canvas = vertical_gradient(BASE, NAVY_TOP, NAVY_BOTTOM).convert("RGBA")

    heart_scale = BASE * 0.0235 * content_scale
    cx, cy = BASE / 2, BASE * 0.5 + BASE * 0.01
    mask = Image.new("L", (BASE, BASE), 0)
    ImageDraw.Draw(mask).polygon(heart_points(cx, cy, heart_scale), fill=255)
    heart_fill = vertical_gradient(BASE, HEART_TOP, HEART_BOTTOM).convert("RGBA")
    heart_fill.putalpha(mask)

    heart_glow = Image.new("RGBA", (BASE, BASE), HEART_TOP + (0,))
    heart_glow.putalpha(mask.filter(ImageFilter.GaussianBlur(BASE * 0.04)).point(lambda v: int(v * 0.55)))
    canvas = Image.alpha_composite(canvas, heart_glow)
    canvas = Image.alpha_composite(canvas, heart_fill)

    line = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    points = ecg_points(BASE / 2, BASE * 0.5, BASE * 0.40 * content_scale, BASE * 0.055 * content_scale)
    width = max(6, round(BASE * 0.022 * content_scale))
    draw = ImageDraw.Draw(line)
    draw.line(points, fill=CYAN + (255,), width=width, joint="curve")
    for x, y in (points[0], points[-1]):
        draw.ellipse((x - width / 2, y - width / 2, x + width / 2, y + width / 2), fill=CYAN + (255,))
    canvas = Image.alpha_composite(canvas, glow(line, BASE * 0.02, 1.4))
    canvas = Image.alpha_composite(canvas, line)
    return canvas


def rounded(image, radius_ratio=0.22):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, image.width - 1, image.height - 1), radius=int(image.width * radius_ratio), fill=255
    )
    result = image.copy()
    result.putalpha(ImageChops.multiply(result.getchannel("A"), mask))
    return result


def save(image, name, size):
    OUT.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print(f"gerado {name} ({size}x{size})")


if __name__ == "__main__":
    standard = render(1.0)
    maskable = render(0.78)

    save(rounded(standard), "icon-512.png", 512)
    save(rounded(standard), "icon-192.png", 192)
    save(maskable.convert("RGB"), "icon-maskable-512.png", 512)
    save(standard.convert("RGB"), "apple-touch-icon.png", 180)
    save(rounded(standard), "favicon-32.png", 32)
