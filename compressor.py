import os
import sys
import math
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Installing required libraries...")
    os.system("pip install Pillow numpy --break-system-packages -q")
    from PIL import Image
    import numpy as np


def compress_one_level(arr: np.ndarray) -> np.ndarray:
    """Shrink image by half: average every 2x2 block → 1 pixel."""
    h, w = arr.shape[:2]
    arr = arr[: (h // 2) * 2, : (w // 2) * 2]  # Trim odd edges

    tl = arr[0::2, 0::2].astype(np.float32)
    tr = arr[0::2, 1::2].astype(np.float32)
    bl = arr[1::2, 0::2].astype(np.float32)
    br = arr[1::2, 1::2].astype(np.float32)

    averaged = (tl + tr + bl + br) / 4.0
    return np.clip(averaged, 0, 255).astype(np.uint8)


def compress(arr: np.ndarray, levels: int) -> np.ndarray:
    for i in range(levels):
        h, w = arr.shape[:2]
        arr = compress_one_level(arr)
        nh, nw = arr.shape[:2]
        print(f"    Level {i+1}: {w} x {h}  →  {nw} x {nh} px")
    return arr


def file_size(path: str) -> str:
    b = os.path.getsize(path)
    if b >= 1_000_000: return f"{b/1_000_000:.2f} MB"
    if b >= 1_000: return f"{b/1_000:.1f} KB"
    return f"{b} B"


def preview_levels(w: int, h: int, levels: int) -> None:
    print(f"\n  {'Level':<8} {'Width':>8} {'Height':>8} {'Pixels':>14} {'Reduction':>12}")
    print(f"  {'─'*8} {'─'*8} {'─'*8} {'─'*14} {'─'*12}")
    orig_px = w * h
    cw, ch = w, h
    print(f"  {'original':<8} {cw:>8,} {ch:>8,} {cw*ch:>14,} {'—':>12}")
    for i in range(1, levels + 1):
        cw, ch = cw // 2, ch // 2
        px = cw * ch
        red = (1 - px / orig_px) * 100
        print(f"  {i:<8} {cw:>8,} {ch:>8,} {px:>14,} {red:>11.1f}%")


def main() -> None:
    print("\n═══ Pyramid Image Compressor ═══")
    
    # Get File
    while True:
        raw = input("  Image path to compress: ").strip().strip('"').strip("'")
        img_path = Path(raw)
        if img_path.exists() and img_path.is_file():
            break
        print(f"    File not found: {raw}")

    img = Image.open(img_path)
    if img.mode == "P": img = img.convert("RGBA")
    elif img.mode not in ("RGB", "RGBA", "L"): img = img.convert("RGB")

    orig_arr = np.array(img)
    orig_w, orig_h = img.size
    max_lvl = int(math.log2(min(orig_w, orig_h)))

    print(f"\n  Loaded: {img_path.name} ({orig_w}x{orig_h} px | {file_size(str(img_path))})")
    preview_levels(orig_w, orig_h, min(max_lvl, 6))

    # Get Levels
    while True:
        raw_lvl = input(f"\n  How many levels to compress? (1–{max_lvl}) [{min(3, max_lvl)}]: ").strip()
        if not raw_lvl:
            comp_levels = min(3, max_lvl)
            break
        if raw_lvl.isdigit() and 1 <= int(raw_lvl) <= max_lvl:
            comp_levels = int(raw_lvl)
            break
        print(f"    Please enter a number between 1 and {max_lvl}.")

    # Destination Path
    default_out = img_path.parent / f"{img_path.stem}_compressed{img_path.suffix}"
    raw_out = input(f"  Save compressed image to [{default_out.name}]: ").strip()
    comp_out = Path(raw_out) if raw_out else default_out
    if raw_out and not comp_out.suffix:
        comp_out = comp_out.with_suffix(img_path.suffix)

    print(f"\n{'─'*52}\n  Compressing...\n{'─'*52}")
    compressed_arr = compress(orig_arr.copy(), comp_levels)
    
    comp_img = Image.fromarray(compressed_arr)
    comp_img.save(str(comp_out))

    # Save metadata sidecar for decompression
    meta = comp_out.with_suffix(".meta.txt")
    meta.write_text(f"original_size={orig_w}x{orig_h}\nlevels={comp_levels}\nsource={img_path.name}\n")

    print(f"\n  Saved compressed : {comp_out}")
    print(f"  Saved metadata   : {meta.name}")
    print(f"  New File Size    : {file_size(str(comp_out))} (was {file_size(str(img_path))})")
    print("  Done!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  Cancelled.")
        sys.exit(0)
