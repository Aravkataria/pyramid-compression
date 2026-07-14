# pyramid-compression

<h1 align="center">
  <a href="https://aravkataria.github.io/pyramid-compression/">pyramid-compression</a>
</h1>

Take an image. Shrink it by blending groups of pixels together. Do it again. And again. That's the whole idea — a recursive compression method called pyramid downsampling, reimagined as an interactive tool you can run from the terminal or open straight in a browser. Which can work on **any ratio of pixal**

No external services. No accounts. Just pixels doing math.

---

<p align="center">
  <img src="https://hitscounter.dev/api/hit?url=https%3A%2F%2Faravkataria.github.io%2Fpyramid-compression%2F&label=Website+Visitors&color=00bfff&style=for-the-badge&v=1" />
  <img src="https://hitscounter.dev/api/hit?url=https%3A%2F%2Fgithub.com%2FAravkataria%2Fpyramid-compression&label=Repo+Visitors&color=00bfff&style=for-the-badge&v=1" />
  <img src="https://img.shields.io/github/stars/Aravkataria/pyramid-compression?style=for-the-badge&color=00bfff" />
  <img src="https://img.shields.io/github/forks/Aravkataria/pyramid-compression?style=for-the-badge&color=00bfff" />
</p>

## Table of Contents

- [Why This Exists](#why-this-exists)
- [How It Works](#how-it-works)
  - [Compression](#compression-explained)
  - [Decompression](#decompression-explained)
  - [What Gets Lost](#what-gets-lost)
  - [Data Security](#Data-Security)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Requirements](#requirements)
  - [Running the Compressor](#running-the-compressor)
  - [Running the Decompressor](#running-the-decompressor)
  - [Running the Full Pipeline](#running-the-full-pipeline)
- [Web App](#web-app)
- [Picking the Right Level](#picking-the-right-level)
- [Nearest vs Bilinear](#nearest-vs-bilinear)
- [Quality — PSNR](#quality--psnr)
- [Compression Levels Reference](#compression-levels-reference)
- [License](#license)

---

## Why This Exists

Most image compression (JPEG, WebP, etc.) is a black box — you hand it a file, it hands back a smaller one, and whatever happened in between is someone else's problem. This project makes the process visible and hands-on. You choose how many times to compress, watch the resolution shrink step by step, and then reconstruct it. It's lossy by design, and the tradeoff between size and quality is right in front of you.

Built as a learning project, but usable as an actual tool.

---

## How It Works

### Compression Explained

Every compression "level" cuts the image in half — both width and height — by averaging groups of 4 pixels:

```math
P_{\text{new}} =
\frac{
P_{(x,y)} + P_{(x+1,y)} + P_{(x,y+1)} + P_{(x+1,y+1)}
}{4}
```

This is applied to every 2×2 block in the image. The result is a new image at half the resolution. Apply it again and it halves again, this can work on **any ratio of pixal**. for example 3 levels on a 1920×1080 photo gives you 240×135.

Each level is roughly a 75% reduction in pixel count, which translates directly to a smaller file.

### Decompression Explained

Decompression runs the other direction — each level doubles the image back up. Since the original pixel data is gone, the tool has to guess what was there. Two methods:

- **Nearest-neighbor** — each pixel becomes a 2×2 block of the same color. Fast. Blocky. Looks intentional if you lean into it.
- **Bilinear** — blends between neighboring pixels when scaling up. Smoother, closer to the original look.

The `.meta.txt` sidecar file saved during compression stores the original dimensions and level count, so the decompressor knows exactly how far to scale back up.

### What Gets Lost

When you average 4 pixels into 1, the detail in those 4 pixels is gone forever. Decompression can smooth things out but it can't recover what wasn't saved. The higher the compression level, the more the reconstructed image becomes an approximation — accurate in broad strokes, blurry or blocky in the fine details.

That's not a bug, it's the point. This isn't trying to compete with JPEG. It's showing you what compression actually does.

### Data Security

Pyramid Compress is built with a strict zero-data-collection architecture. Your personal photos are entirely safe because they never leave your device.

- Web Version (100% Client-Side): The browser app process images directly inside your active browser tab. When you drag and drop a file, it is only loaded into your computer's local memory. No images are ever uploaded to an external server, and no cloud storage is used.
- Python Version (100% Offline): The command-line scripts run entirely on your local machine. They read your original image, process the pixel math using your computer's RAM, and save the new file straight back to your hard drive. It does not require an internet connection to function.

---
## Project Structure
 
```
├── index.html        # Interactive Web Workspace markup structure
├── style.css         # Typography, layout definitions, and dual color themes
├── script.js         # Engine executing downscale/upscale logic via HTML5 Canvas
├── main.py           # Unified local Python terminal orchestration pipeline
├── compressor.py     # Independent image downscaling script
└── decompressor.py   # Independent image reconstruction script (uses metadata sidecars)
```

---

## Getting Started

### Requirements

Python 3.8+ with two libraries:

```bash
pip install Pillow numpy
```

Both install automatically on first run if they're missing, so you can also just run the script and let it handle it.

Supported formats: JPG, PNG, WEBP, BMP — anything Pillow can open.

---

### Running the Compressor

```bash
python compressor.py

```

You'll be walked through three prompts:

1. **Image path** — drag the file into the terminal or type the path
2. **Levels** — how many times to halve it. The script shows a preview table before you decide
3. **Output path** — press Enter to use the default (`filename_compressed.ext`)

A `.meta.txt` sidecar file is saved next to the output automatically. Keep it — the decompressor uses it to restore the right dimensions without you having to remember anything.

**Example session:**

```
═══ Pyramid Image Compressor ═══
  Image path to compress: photo.jpg

  Loaded: photo.jpg (1920x1080 px | 2.3 MB)

  Level    Width   Height          Pixels    Reduction
  ──────── ─────── ─────── ────────────── ────────────
  original   1,920   1,080      2,073,600            —
  1            960     540        518,400        75.0%
  2            480     270        129,600        93.8%
  3            240     135         32,400        98.4%

  How many levels to compress? (1–10) [3]: 3
  Save compressed image to [photo_compressed.jpg]:

  Compressing...
    Level 1: 1920 x 1080  →  960 x 540 px
    Level 2: 960 x 540  →  480 x 270 px
    Level 3: 480 x 270  →  240 x 135 px

  Saved compressed : photo_compressed.jpg
  Saved metadata   : photo_compressed.meta.txt
  New File Size    : 12.4 KB (was 2.3 MB)
```

---

### Running the Decompressor

```bash
python decompressor.py
```

Point it at a compressed image. If the `.meta.txt` sidecar is in the same folder, levels and original size are read automatically. Otherwise you'll choose manually.

You'll also pick an upscaling method — `nearest` for a blocky look, `bilinear` for smooth.

**Example session:**

```
═══ Pyramid Image Decompressor ═══
  Compressed image path: photo_compressed.jpg

  Found metadata! Auto-restoring 3 levels.
  Method — nearest (blocky) or bilinear (smooth) [bilinear]: bilinear
  Save decompressed image to [photo_decompressed.jpg]:

  Decompressing...
    Level 1: 240 x 135  →  480 x 270 px
    Level 2: 480 x 270  →  960 x 540 px
    Level 3: 960 x 540  →  1920 x 1080 px

  Saved decompressed : photo_decompressed.jpg
  Final File Size    : 1.8 MB
```

---

### Running the Full Pipeline

[main.py](main.py) is a single entry point that lets you compress, decompress, or run both back-to-back in one go — useful if you want to immediately see the round-trip result:

```bash
python main.py
```

---

## Web App

[index.html](index.html) — open it in any browser. Nothing to install, no server running, no internet required after the page loads.

**What it does:**
- Drag and drop an image (or click to browse)
- Toggle between compress and decompress mode
- Slide a level selector from 1–6 and see the result update live
- Switch between nearest and bilinear reconstruction
- Side-by-side original vs output comparison
- Download either image as PNG
- Light and dark theme

The same averaging algorithm from the Python version is ported into vanilla JS using the Canvas API. Processing happens entirely in your browser — your image never leaves your machine.

---

## Picking the Right Level

The right number of levels depends on what you're using the image for:

| Goal | Suggested Levels |
|---|---|
| Slight size reduction, minimal quality loss | 1–2 |
| Thumbnail or preview image | 3–4 |
| Heavily compressed, artistic/experimental | 5+ |
| Just seeing what happens | Go wild |

Beyond level 5 on most images, the output is more of an impression of the original than a reproduction. Which can look intentional and interesting, or terrible — depends on the image.

---

## Nearest vs Bilinear

When decompressing, both methods get you back to the original dimensions. The difference is in how they fill in the gaps:

**Nearest-neighbor** copies each pixel exactly into a 2×2 block. Nothing is blended. Edges stay hard, patterns stay sharp but chunky. Good for: pixel art, icons, anything where you want that blocky retro aesthetic.

**Bilinear** calculates intermediate values between neighboring pixels. The result looks smoother and more "photographic." Closer to what standard image resizing tools produce. Good for: photos, illustrations, anything where you want the output to look natural.

Neither is strictly better — it depends on what you're going for.

---

## Quality — PSNR

PSNR (Peak Signal-to-Noise Ratio) is a standard way to measure how much quality was lost after compressing and decompressing. The Python tools print this automatically so you can compare settings.

```math
\text{MSE} =
\frac{1}{3HW}
\sum_{c=1}^{3}
\sum_{y=1}^{H}
\sum_{x=1}^{W}
\left(I_{\text{orig}}(x,y,c)-I_{\text{recon}}(x,y,c)\right)^2
```

```math
\text{PSNR} =
10 \cdot \log_{10}
\left(
\frac{255^2}{\text{MSE}}
\right)
```

Higher = better. A difference of a few dB is often visible; 10+ dB is very noticeable.

| PSNR | Quality |
|---|---|
| > 40 dB | Excellent — hard to tell from the original |
| 30–40 dB | Good — minor softness or artifacts |
| 20–30 dB | Acceptable — clearly degraded but recognizable |
| < 20 dB | Heavy loss — significant blur or blockiness |

---

## Compression Levels Reference

Starting from a 1920×1080 image:

| Level | Resolution | Pixels | Reduction |
|---|---|---|---|
| 0 — original | 1920 × 1080 | 2,073,600 | — |
| 1 | 960 × 540 | 518,400 | 75% |
| 2 | 480 × 270 | 129,600 | 93.8% |
| 3 | 240 × 135 | 32,400 | 98.4% |
| 4 | 120 × 67 | 8,040 | 99.6% |
| 5 | 60 × 33 | 1,980 | 99.9% |

Every level is a 75% reduction from the one before it. The file size drop follows a similar curve, though the exact savings depend on format and image content.

---

## License

MIT — use it, fork it, build on it.

Built by [Arav Kataria](https://github.com/Aravkataria) · [GitHub Repository](https://github.com/Aravkataria/pyramid-compression)
