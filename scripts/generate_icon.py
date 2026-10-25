from __future__ import annotations

import shutil
import subprocess
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_IMAGE = ROOT / "scripts" / "assets" / "icon-source.png"

BUILD_DIR = ROOT / "build"
PUBLIC_DIR = ROOT / "public"
ICONSET_DIR = BUILD_DIR / "icon.iconset"


def build_subject_mask(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    raw_mask = Image.new("L", (width, height), 0)
    mask_pixels = raw_mask.load()

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue

            max_rgb = max(r, g, b)
            min_rgb = min(r, g, b)
            saturation = 0 if max_rgb == 0 else (max_rgb - min_rgb) / max_rgb
            blue_dominant = b > g + 18 and b > r + 18
            vivid = saturation > 0.22 and max_rgb > 70
            dark_blue = b > 70 and g > 40 and r < 80

            if blue_dominant or vivid or dark_blue:
                mask_pixels[x, y] = 255

    component_mask = largest_component(raw_mask)
    component_mask = fill_holes(component_mask)
    component_mask = component_mask.filter(ImageFilter.MaxFilter(11))
    component_mask = component_mask.filter(ImageFilter.GaussianBlur(2))
    return component_mask


def largest_component(mask: Image.Image) -> Image.Image:
    width, height = mask.size
    pixels = mask.load()
    visited = set()
    best_component = []

    for y in range(height):
        for x in range(width):
            if pixels[x, y] == 0 or (x, y) in visited:
                continue

            queue = deque([(x, y)])
            visited.add((x, y))
            component = []

            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if (
                        0 <= nx < width
                        and 0 <= ny < height
                        and pixels[nx, ny] > 0
                        and (nx, ny) not in visited
                    ):
                        visited.add((nx, ny))
                        queue.append((nx, ny))

            if len(component) > len(best_component):
                best_component = component

    result = Image.new("L", (width, height), 0)
    result_pixels = result.load()
    for x, y in best_component:
        result_pixels[x, y] = 255
    return result


def fill_holes(mask: Image.Image) -> Image.Image:
    width, height = mask.size
    pixels = mask.load()
    visited = set()
    queue = deque()

    def enqueue(x: int, y: int) -> None:
        if (x, y) not in visited and pixels[x, y] == 0:
            visited.add((x, y))
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)

    filled = mask.copy()
    filled_pixels = filled.load()
    for y in range(height):
        for x in range(width):
            if pixels[x, y] == 0 and (x, y) not in visited:
                filled_pixels[x, y] = 255
    return filled


def isolate_subject(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    mask = build_subject_mask(rgba)
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("Could not isolate icon subject from source image")

    subject = rgba.copy()
    subject.putalpha(mask)
    subject = subject.crop(bbox)

    target_size = 900
    scale = min(target_size / subject.width, target_size / subject.height)
    resized = subject.resize(
        (max(1, int(subject.width * scale)), max(1, int(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    offset = ((1024 - resized.width) // 2, (1024 - resized.height) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas


def save_pngs(image: Image.Image) -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    final = image.resize((1024, 1024), Image.Resampling.LANCZOS)
    final.save(BUILD_DIR / "icon.png")
    final.save(PUBLIC_DIR / "icon.png")
    final.save(PUBLIC_DIR / "logo.png")

    final.save(
        BUILD_DIR / "icon.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def save_icns() -> None:
    if ICONSET_DIR.exists():
        shutil.rmtree(ICONSET_DIR)
    ICONSET_DIR.mkdir(parents=True, exist_ok=True)

    base_png = BUILD_DIR / "icon.png"
    icon_sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]

    for size, filename in icon_sizes:
        subprocess.run(
            [
                "sips",
                "-z",
                str(size),
                str(size),
                str(base_png),
                "--out",
                str(ICONSET_DIR / filename),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    try:
        subprocess.run(
            ["iconutil", "-c", "icns", str(ICONSET_DIR), "-o", str(BUILD_DIR / "icon.icns")],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    finally:
        shutil.rmtree(ICONSET_DIR, ignore_errors=True)


def main() -> None:
    if not SOURCE_IMAGE.exists():
        raise FileNotFoundError(f"Source image not found: {SOURCE_IMAGE}")

    source = Image.open(SOURCE_IMAGE)
    processed = isolate_subject(source)
    save_pngs(processed)
    save_icns()
    print("Generated autoSSL icon assets:")
    print(f"  - {BUILD_DIR / 'icon.png'}")
    print(f"  - {BUILD_DIR / 'icon.icns'}")
    print(f"  - {BUILD_DIR / 'icon.ico'}")
    print(f"  - {PUBLIC_DIR / 'icon.png'}")
    print(f"  - {PUBLIC_DIR / 'logo.png'}")


if __name__ == "__main__":
    main()
