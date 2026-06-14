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
 
 
# ─────────────────────────────────────────────────────────────
#  Core pixel operations
# ─────────────────────────────────────────────────────────────
 
def compress_one_level(arr: np.ndarray) -> np.ndarray:
    """
    Shrink image by half: average every 2x2 block → 1 pixel.
    Works for grayscale (H,W) and colour (H,W,C) arrays.
    Trims 1px from odd-dimensioned edges so blocks are always complete.
    """
    h, w = arr.shape[:2]
    # Trim to even so every 2x2 block is whole
    arr = arr[: (h // 2) * 2, : (w // 2) * 2]
 
    tl = arr[0::2, 0::2].astype(np.float32)
    tr = arr[0::2, 1::2].astype(np.float32)
    bl = arr[1::2, 0::2].astype(np.float32)
    br = arr[1::2, 1::2].astype(np.float32)
 
    averaged = (tl + tr + bl + br) / 4.0
    return np.clip(averaged, 0, 255).astype(np.uint8)
 
 
def decompress_one_level_nearest(arr: np.ndarray) -> np.ndarray:
    """
    Double size: copy each pixel into a 2x2 block.
    Fast. Produces a blocky/pixelated result.
    """
    return np.repeat(np.repeat(arr, 2, axis=0), 2, axis=1)
 
 
def decompress_one_level_bilinear(arr: np.ndarray) -> np.ndarray:
    """
    Double size: interpolate between neighbouring pixels.
    Slower. Produces a smoother (slightly blurry) result.
    """
    h, w = arr.shape[:2]
    img = Image.fromarray(arr)
    img_up = img.resize((w * 2, h * 2), Image.BILINEAR)
    return np.array(img_up)
 
 
# ─────────────────────────────────────────────────────────────
#  Multi-level compress / decompress
# ─────────────────────────────────────────────────────────────
 
def compress(arr: np.ndarray, levels: int) -> np.ndarray:
    for i in range(levels):
        h, w = arr.shape[:2]
        arr = compress_one_level(arr)
        nh, nw = arr.shape[:2]
        print(f"    Level {i+1}: {w} x {h}  →  {nw} x {nh} px")
    return arr
 
 
def decompress(arr: np.ndarray, levels: int, method: str) -> np.ndarray:
    fn = (decompress_one_level_bilinear
          if method == "bilinear"
          else decompress_one_level_nearest)
    for i in range(levels):
        h, w = arr.shape[:2]
        arr = fn(arr)
        nh, nw = arr.shape[:2]
        print(f"    Level {i+1}: {w} x {h}  →  {nw} x {nh} px")
    return arr
 
 
# ─────────────────────────────────────────────────────────────
#  PSNR quality metric
# ─────────────────────────────────────────────────────────────
 
def psnr(original: np.ndarray, reconstructed: np.ndarray) -> float:
    # Resize reconstructed to match original if sizes differ
    if original.shape != reconstructed.shape:
        img = Image.fromarray(reconstructed)
        h, w = original.shape[:2]
        img = img.resize((w, h), Image.BILINEAR)
        reconstructed = np.array(img)
    mse = np.mean((original.astype(np.float64) - reconstructed.astype(np.float64)) ** 2)
    if mse == 0:
        return float("inf")
    return 10 * math.log10((255.0 ** 2) / mse)
 
 
def psnr_label(db: float) -> str:
    if db == float("inf"):
        return "perfect (lossless)"
    if db > 40:
        return "excellent  — barely any visible difference"
    if db > 30:
        return "good       — minor blurring on edges"
    if db > 20:
        return "acceptable — noticeable blurring"
    return "low        — heavy quality loss"
 
 
# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────
 
def file_size(path: str) -> str:
    b = os.path.getsize(path)
    if b >= 1_000_000:
        return f"{b/1_000_000:.2f} MB"
    if b >= 1_000:
        return f"{b/1_000:.1f} KB"
    return f"{b} B"
 
 
def max_levels(w: int, h: int) -> int:
    """Maximum levels before the image shrinks to 1x1."""
    return int(math.log2(min(w, h)))
 
 
def size_after(w: int, h: int, levels: int) -> tuple[int, int]:
    for _ in range(levels):
        w, h = w // 2, h // 2
    return w, h
 
 
def preview_levels(w: int, h: int, levels: int) -> None:
    """Print a preview table of what each level produces."""
    print(f"\n  {'Level':<8} {'Width':>8} {'Height':>8} {'Pixels':>14} {'Reduction':>12}")
    print(f"  {'─'*8} {'─'*8} {'─'*8} {'─'*14} {'─'*12}")
    orig_px = w * h
    cw, ch = w, h
    print(f"  {'original':<8} {cw:>8,} {ch:>8,} {cw*ch:>14,} {'—':>12}")
    for i in range(1, levels + 1):
        cw, ch = cw // 2, ch // 2
        px = cw * ch
        red = (1 - px / orig_px) * 100
        marker = "  ← your choice" if i == levels else ""
        print(f"  {i:<8} {cw:>8,} {ch:>8,} {px:>14,} {red:>11.1f}%{marker}")
 
 
# ─────────────────────────────────────────────────────────────
#  User input helpers
# ─────────────────────────────────────────────────────────────
 
def ask(prompt: str, default: str = "") -> str:
    val = input(prompt).strip()
    return val if val else default
 
 
def ask_int(prompt: str, lo: int, hi: int, default: int | None = None) -> int:
    while True:
        suffix = f" [{default}]" if default is not None else ""
        raw = input(f"{prompt}{suffix}: ").strip()
        if raw == "" and default is not None:
            return default
        if raw.isdigit() and lo <= int(raw) <= hi:
            return int(raw)
        print(f"    Please enter a number between {lo} and {hi}.")
 
 
def ask_choice(prompt: str, choices: list[str], default: str) -> str:
    options = "/".join(
        c.upper() if c == default else c for c in choices
    )
    while True:
        raw = input(f"{prompt} ({options}): ").strip().lower()
        if raw == "":
            return default
        if raw in choices:
            return raw
        print(f"    Please enter one of: {', '.join(choices)}")
 
 
def ask_file(prompt: str) -> Path:
    while True:
        raw = input(prompt).strip().strip('"').strip("'")
        p = Path(raw)
        if p.exists() and p.is_file():
            return p
        print(f"    File not found: {raw}")
 
 
# ─────────────────────────────────────────────────────────────
#  Main interactive flow
# ─────────────────────────────────────────────────────────────
 
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}
 
BANNER = """
╔══════════════════════════════════════════════════╗
║      Pyramid Image Compression Tool             ║
╚══════════════════════════════════════════════════╝
  Each compression level halves the image size by
  averaging every 2x2 block of pixels into one.
  Decompression scales it back up again.
"""
 
def main() -> None:
    print(BANNER)
 
    # ── What do you want to do? ──────────────────────
    print("  What would you like to do?")
    print("    1  Compress an image")
    print("    2  Decompress an image")
    print("    3  Both (compress then decompress)")
    mode = ask_int("  Your choice", 1, 3, default=3)
 
    # ── Load image ───────────────────────────────────
    print()
    img_path = ask_file("  Image path: ")
 
    img = Image.open(img_path)
    # Normalise mode
    if img.mode == "P":
        img = img.convert("RGBA")
    elif img.mode not in ("RGB", "RGBA", "L"):
        img = img.convert("RGB")
 
    orig_arr = np.array(img)
    orig_w, orig_h = img.size
    max_lvl = max_levels(orig_w, orig_h)
 
    print(f"\n  Loaded  : {img_path.name}")
    print(f"  Size    : {orig_w} x {orig_h} px  ({file_size(str(img_path))})")
    print(f"  Mode    : {img.mode}")
    print(f"  Max safe compression levels: {max_lvl}")
 
    # ── Choose compression levels ─────────────────────
    if mode in (1, 3):
        print()
        preview_levels(orig_w, orig_h, min(max_lvl, 6))
        comp_levels = ask_int(
            f"\n  How many levels to compress? (1–{max_lvl})",
            1, max_lvl, default=min(3, max_lvl)
        )
 
        tw, th = size_after(orig_w, orig_h, comp_levels)
        orig_px = orig_w * orig_h
        comp_px = tw * th
        reduction = (1 - comp_px / orig_px) * 100
        print(f"\n  After {comp_levels} level(s): {tw} x {th} px  "
              f"({reduction:.1f}% fewer pixels, {orig_px//comp_px}× smaller)")
 
        # ── Output path for compressed ────────────────
        default_comp = img_path.parent / f"{img_path.stem}_compressed{img_path.suffix}"
        print(f"\n  Where to save the compressed image?")
        raw = ask(f"  Path [{default_comp.name}]: ")
        raw_path = Path(raw) if raw else default_comp
        if raw and not Path(raw).suffix:
            comp_out = Path(raw).with_suffix(img_path.suffix)
        else:
            comp_out = raw_path
 
    # ── Choose decompression settings ─────────────────
    if mode in (2, 3):
        if mode == 2:
            # Decompress only — ask how many levels to expand
            dec_levels = ask_int(
                f"\n  How many levels to decompress? (1–{max_lvl})",
                1, max_lvl, default=min(3, max_lvl)
            )
        else:
            # Both — decompress exactly as many levels as we compressed
            dec_levels = comp_levels
            print(f"\n  Will decompress {dec_levels} level(s) back to "
                  f"{orig_w} x {orig_h} px")
 
        print()
        method = ask_choice(
            "  Decompression method — nearest (blocky/fast) or bilinear (smooth/slower)",
            ["nearest", "bilinear"],
            default="bilinear"
        )
 
        if mode == 2:
            default_dec = img_path.parent / f"{img_path.stem}_decompressed{img_path.suffix}"
        else:
            default_dec = img_path.parent / f"{img_path.stem}_decompressed{img_path.suffix}"
 
        print(f"\n  Where to save the decompressed image?")
        raw = ask(f"  Path [{default_dec.name}]: ")
        raw_path = Path(raw) if raw else default_dec
        # Ensure output keeps source extension
        if raw and not Path(raw).suffix:
            dec_out = Path(raw).with_suffix(img_path.suffix)
        else:
            dec_out = raw_path
 
    # ════════════════════════════════════════════════
    #  Run compression
    # ════════════════════════════════════════════════
    if mode in (1, 3):
        print(f"\n{'─'*52}")
        print(f"  Compressing ({comp_levels} level{'s' if comp_levels > 1 else ''})...")
        print(f"{'─'*52}")
 
        arr = compress(orig_arr.copy(), comp_levels)
        comp_img = Image.fromarray(arr)
        comp_img.save(str(comp_out))
 
        # Save sidecar metadata
        meta = comp_out.with_suffix(".meta.txt")
        meta.write_text(
            f"original_size={orig_w}x{orig_h}\n"
            f"levels={comp_levels}\n"
            f"source={img_path.name}\n"
        )
        print(f"\n  Saved compressed : {comp_out}")
        print(f"  Saved metadata   : {meta.name}")
        print(f"  File size        : {file_size(str(comp_out))}  "
              f"(was {file_size(str(img_path))})")
 
    # ════════════════════════════════════════════════
    #  Run decompression
    # ════════════════════════════════════════════════
    if mode in (2, 3):
        print(f"\n{'─'*52}")
        print(f"  Decompressing ({dec_levels} level{'s' if dec_levels > 1 else ''}, {method})...")
        print(f"{'─'*52}")
 
        # Source array: either just-compressed or freshly loaded
        if mode == 3:
            src_arr = arr          # use result of compress step
        else:
            src_arr = orig_arr     # decompress whatever image was loaded
 
        result_arr = decompress(src_arr.copy(), dec_levels, method)
        dec_img = Image.fromarray(result_arr)
        dec_img.save(str(dec_out))
        print(f"\n  Saved decompressed : {dec_out}")
        print(f"  File size          : {file_size(str(dec_out))}")
 
    # ════════════════════════════════════════════════
    #  Quality report (only when we did both)
    # ════════════════════════════════════════════════
    if mode == 3:
        score = psnr(orig_arr, result_arr)
        cw, ch = comp_img.size
        dw, dh = dec_img.size
 
        print(f"\n{'═'*52}")
        print(f"  Quality report")
        print(f"{'═'*52}")
        print(f"  Original     : {orig_w} x {orig_h} px  |  {file_size(str(img_path))}")
        print(f"  Compressed   : {cw} x {ch} px  |  {file_size(str(comp_out))}")
        print(f"  Decompressed : {dw} x {dh} px  |  {file_size(str(dec_out))}")
        print(f"\n  Compression ratio : {orig_arr.size // result_arr.size}×")
        print(f"  Levels used       : {comp_levels}")
        print(f"  PSNR score        : {score:.1f} dB  →  {psnr_label(score)}")
        print(f"{'═'*52}\n")
 
    print("  Done!")
 
 
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  Cancelled.")
        sys.exit(0)
