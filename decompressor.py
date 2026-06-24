import os
import sys
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Installing required libraries...")
    os.system("pip install Pillow numpy --break-system-packages -q")
    from PIL import Image
    import numpy as np


def decompress_one_level_nearest(arr: np.ndarray) -> np.ndarray:
    return np.repeat(np.repeat(arr, 2, axis=0), 2, axis=1)


def decompress_one_level_bilinear(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    img = Image.fromarray(arr)
    img_up = img.resize((w * 2, h * 2), Image.BILINEAR)
    return np.array(img_up)


def decompress(arr: np.ndarray, levels: int, method: str) -> np.ndarray:
    fn = decompress_one_level_bilinear if method == "bilinear" else decompress_one_level_nearest
    for i in range(levels):
        h, w = arr.shape[:2]
        arr = fn(arr)
        nh, nw = arr.shape[:2]
        print(f"    Level {i+1}: {w} x {h}  →  {nw} x {nh} px")
    return arr


def file_size(path: str) -> str:
    b = os.path.getsize(path)
    if b >= 1_000_000: return f"{b/1_000_000:.2f} MB"
    if b >= 1_000: return f"{b/1_000:.1f} KB"
    return f"{b} B"


def main() -> None:
    print("\n═══ Pyramid Image Decompressor ═══")

    # Get File
    while True:
        raw = input("  Compressed image path: ").strip().strip('"').strip("'")
        img_path = Path(raw)
        if img_path.exists() and img_path.is_file():
            break
        print(f"    File not found: {raw}")

    img = Image.open(img_path)
    src_arr = np.array(img)
    w, h = img.size

    # Check for metadata companion
    meta_path = img_path.with_suffix(".meta.txt")
    dec_levels = 1
    
    if meta_path.exists():
        try:
            meta_lines = meta_path.read_text().splitlines()
            meta_dict = dict(line.split("=") for line in meta_lines if "=" in line)
            dec_levels = int(meta_dict.get("levels", 1))
            print(f"\n  Found metadata! Auto-restoring {dec_levels} levels.")
        except Exception:
            print("\n  Metadata file corrupted. Falling back to manual configuration.")
            meta_path = Path("")

    if not meta_path.exists():
        while True:
            raw_lvl = input("\n  How many levels to decompress up? (1-10) [3]: ").strip()
            if not raw_lvl:
                dec_levels = 3
                break
            if raw_lvl.isdigit() and 1 <= int(raw_lvl) <= 10:
                dec_levels = int(raw_lvl)
                break
            print("    Please enter a number between 1 and 10.")

    # Choose Upscaling Method
    while True:
        method = input("  Method — nearest (blocky) or bilinear (smooth) [bilinear]: ").strip().lower()
        if not method:
            method = "bilinear"
            break
        if method in ["nearest", "bilinear"]:
            break
        print("    Please type 'nearest' or 'bilinear'.")

    # Destination Path
    default_out = img_path.parent / f"{img_path.stem.replace('_compressed', '')}_decompressed{img_path.suffix}"
    raw_out = input(f"  Save decompressed image to [{default_out.name}]: ").strip()
    dec_out = Path(raw_out) if raw_out else default_out
    if raw_out and not dec_out.suffix:
        dec_out = dec_out.with_suffix(img_path.suffix)

    print(f"\n{'─'*52}\n  Decompressing...\n{'─'*52}")
    result_arr = decompress(src_arr.copy(), dec_levels, method)

    # Force strict dimensions if metadata exists (remedies any odd pixel trims)
    if meta_path.exists() and "original_size" in meta_dict:
        try:
            orig_w, orig_h = map(int, meta_dict["original_size"].split("x"))
            dec_img = Image.fromarray(result_arr).resize((orig_w, orig_h), Image.BILINEAR)
        except Exception:
            dec_img = Image.fromarray(result_arr)
    else:
        dec_img = Image.fromarray(result_arr)

    dec_img.save(str(dec_out))
    print(f"\n  Saved decompressed : {dec_out}")
    print(f"  Final File Size    : {file_size(str(dec_out))}")
    print("  Done!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  Cancelled.")
        sys.exit(0)
