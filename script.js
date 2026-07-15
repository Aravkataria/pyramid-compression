document.addEventListener("DOMContentLoaded", () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Theme Toggling ---
    const themeToggle = document.getElementById('themeToggle');
    const htmlTag = document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    themeToggle.addEventListener('click', () => {
        const currentTheme = htmlTag.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        htmlTag.setAttribute('data-theme', newTheme);
        themeToggle.innerText = newTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', newTheme === 'dark' ? '#0a0a0a' : '#ffffff');
        }
    });

    // --- Mobile Menu ---
    const menuToggle = document.getElementById('menuToggle');
    const mobileMenu = document.getElementById('mobileMenu');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            const isOpen = mobileMenu.classList.toggle('open');
            menuToggle.classList.toggle('open', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('open');
                menuToggle.classList.remove('open');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // --- Scroll-reveal for feature cards ---
    const featureCards = document.querySelectorAll('.feature-card');
    if (featureCards.length && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    setTimeout(() => entry.target.classList.add('in-view'), prefersReducedMotion ? 0 : i * 80);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        featureCards.forEach(card => observer.observe(card));
    } else {
        featureCards.forEach(card => card.classList.add('in-view'));
    }

    // --- UI Elements ---
    const dropZone = document.getElementById('dropZone');
    const dropZoneTitle = document.getElementById('dropZoneTitle');
    const fileInput = document.getElementById('fileInput');
    const uploadView = document.getElementById('uploadView');
    const editorView = document.getElementById('editorView');
    const resetBtn = document.getElementById('resetBtn');
    const workspaceTitle = document.getElementById('workspaceTitle');

    // Touch devices can't drag files from outside the browser in most cases; adjust the hint copy.
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice && dropZoneTitle) {
        dropZoneTitle.innerText = 'Tap to choose your image';
    }

    // --- Control Elements ---
    const modeSelect = document.getElementById('modeSelect');
    const levelsInput = document.getElementById('levelsInput');
    const levelsDisplay = document.getElementById('levelsDisplay');
    const methodSelect = document.getElementById('methodSelect');
    const methodGroup = document.getElementById('methodGroup');
    const outputLabel = document.getElementById('outputLabel');
    const psnrDisplay = document.getElementById('psnrDisplay');

    // --- Canvas Elements ---
    const originalCanvas = document.getElementById('originalCanvas');
    const outputCanvas = document.getElementById('outputCanvas');
    let originalImg = new Image();

    // --- Drag & Drop Flow ---
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload a valid image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImg.onload = () => {
                // Switch UI State with a soft cross-fade
                const swap = () => {
                    uploadView.classList.add('hidden', 'view-hidden');
                    editorView.classList.remove('hidden', 'view-hidden');
                    editorView.classList.add('flex');
                    workspaceTitle.innerText = "Live Editor";
                    processImage();
                    requestAnimationFrame(() => editorView.classList.remove('view-entering'));
                };
                if (prefersReducedMotion) {
                    swap();
                } else {
                    editorView.classList.add('view-entering');
                    uploadView.style.opacity = '0';
                    setTimeout(swap, 150);
                }
            };
            originalImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- Download Buttons ---
    const downloadOriginalBtn = document.getElementById('downloadOriginalBtn');
    const downloadOutputBtn = document.getElementById('downloadOutputBtn');

    function downloadCanvas(canvas, filename) {
        if (!canvas.width || !canvas.height) return;
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    function flashBtn(btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg> saved`;
        btn.classList.add('saved');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('saved'); }, 1400);
    }

    downloadOriginalBtn.addEventListener('click', () => {
        downloadCanvas(originalCanvas, 'original.png');
        flashBtn(downloadOriginalBtn);
    });

    downloadOutputBtn.addEventListener('click', () => {
        const mode = modeSelect.value;
        const levels = levelsInput.value;
        const suffix = mode === 'compress'
            ? `compressed-${levels}lvl`
            : `decompressed-${levels}lvl-${methodSelect.value}`;
        downloadCanvas(outputCanvas, `pyramid-${suffix}.png`);
        flashBtn(downloadOutputBtn);
    });

    // --- Start Over Button ---
    resetBtn.addEventListener('click', () => {
        const swap = () => {
            editorView.classList.add('hidden', 'view-hidden');
            editorView.classList.remove('flex');
            uploadView.classList.remove('hidden', 'view-hidden');
            uploadView.style.opacity = '';
            workspaceTitle.innerText = "Upload Image";
            fileInput.value = '';
            if (psnrDisplay) psnrDisplay.classList.add('hidden');
        };
        if (prefersReducedMotion) {
            swap();
        } else {
            editorView.style.opacity = '0';
            setTimeout(() => { editorView.style.opacity = ''; swap(); }, 150);
        }
    });

    // --- Editor Controls Listeners (debounced via requestAnimationFrame so slider drags stay smooth on mobile) ---
    let pendingFrame = null;
    function scheduleProcess() {
        if (pendingFrame) cancelAnimationFrame(pendingFrame);
        pendingFrame = requestAnimationFrame(() => {
            pendingFrame = null;
            processImage();
        });
    }

    levelsInput.addEventListener('input', () => {
        levelsDisplay.innerText = levelsInput.value;
        if (originalImg.src) scheduleProcess();
    });

    modeSelect.addEventListener('change', () => {
        if (modeSelect.value === 'decompress') {
            methodGroup.classList.remove('hidden');
            methodGroup.classList.add('flex');
            outputLabel.innerText = "Decompressed";
        } else {
            methodGroup.classList.add('hidden');
            methodGroup.classList.remove('flex');
            outputLabel.innerText = "Compressed";
        }
        if (originalImg.src) processImage();
    });

    methodSelect.addEventListener('change', () => {
        if (originalImg.src) processImage();
    });

    // --- Core Image Processing ---
    function processImage() {
        // Render Original Canvas
        const oCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
        originalCanvas.width = originalImg.width;
        originalCanvas.height = originalImg.height;
        oCtx.drawImage(originalImg, 0, 0);
        document.getElementById('originalSize').innerText = `${originalImg.width} × ${originalImg.height} px`;

        let levels = parseInt(levelsInput.value);
        let imgData = oCtx.getImageData(0, 0, originalImg.width, originalImg.height);
        let outData;

        if (modeSelect.value === 'compress') {
            // Compress Mode
            outData = imgData;
            for (let i = 0; i < levels; i++) {
                outData = compressOneLevel(outData);
            }
            outputCanvas.style.imageRendering = 'pixelated'; // Keeps small images crisp
            renderToOutput(outData);

            // PSNR is mathematically undefined for different sizes (compressed image shrinks)
            if (psnrDisplay) psnrDisplay.classList.add('hidden');
        } else {
            // Decompress Mode
            if (methodSelect.value === 'nearest') {
                outputCanvas.style.imageRendering = 'pixelated';
                outData = imgData;
                for (let i = 0; i < levels; i++) {
                    outData = decompressNearest(outData);
                }
                renderToOutput(outData);

                // Calculate and update PSNR (sizes match original dimensions)
                updatePsnrDisplay(imgData, outData);
            } else {
                // Bilinear Method
                outputCanvas.style.imageRendering = 'auto';
                let targetW = originalImg.width * Math.pow(2, levels);
                let targetH = originalImg.height * Math.pow(2, levels);

                outputCanvas.width = targetW;
                outputCanvas.height = targetH;
                let dCtx = outputCanvas.getContext('2d');
                dCtx.imageSmoothingEnabled = true;
                dCtx.imageSmoothingQuality = 'high';
                dCtx.drawImage(originalCanvas, 0, 0, targetW, targetH);

                document.getElementById('outputSize').innerText = `${targetW} × ${targetH} px`;

                // Calculate PSNR for bilinear mode
                const bilinearData = dCtx.getImageData(0, 0, targetW, targetH);
                updatePsnrDisplay(imgData, bilinearData);
            }
        }

        // Tiny fade pulse so re-processing on slider drag reads as an update, not a jump
        if (!prefersReducedMotion) {
            outputCanvas.classList.remove('canvas-updating');
            void outputCanvas.offsetWidth; // restart transition
            outputCanvas.classList.add('canvas-updating');
            requestAnimationFrame(() => outputCanvas.classList.remove('canvas-updating'));
        }
    }

    function renderToOutput(imageData) {
        outputCanvas.width = imageData.width;
        outputCanvas.height = imageData.height;
        outputCanvas.getContext('2d').putImageData(imageData, 0, 0);
        document.getElementById('outputSize').innerText = `${imageData.width} × ${imageData.height} px`;
    }

    // --- PSNR Display Manager ---
    function updatePsnrDisplay(originalData, processedData) {
        if (!psnrDisplay) return;

        const value = calculatePSNR(originalData, processedData);
        if (value === null) {
            psnrDisplay.classList.add('hidden');
        } else if (value === Infinity) {
            psnrDisplay.innerText = "PSNR: Perfect (∞)";
            psnrDisplay.classList.remove('hidden');
        } else {
            psnrDisplay.innerText = `PSNR: ${value.toFixed(2)} dB`;
            psnrDisplay.classList.remove('hidden');
        }
    }

    // --- Mathematical PSNR Logic ---
    function calculatePSNR(imgData1, imgData2) {
        if (imgData1.width !== imgData2.width || imgData1.height !== imgData2.height) {
            return null; // Dimensions must strictly match to compare pixel by pixel
        }

        const data1 = imgData1.data;
        const data2 = imgData2.data;
        let sumSquaredError = 0;
        const totalPixels = imgData1.width * imgData1.height;

        // Loop through RGB channels only (skipping alpha channel at index c + 3)
        for (let i = 0; i < data1.length; i += 4) {
            const rDiff = data1[i] - data2[i];
            const gDiff = data1[i + 1] - data2[i + 1];
            const bDiff = data1[i + 2] - data2[i + 2];

            sumSquaredError += (rDiff * rDiff) + (gDiff * gDiff) + (bDiff * bDiff);
        }

        // Mean Squared Error over 3 color channels
        const mse = sumSquaredError / (totalPixels * 3);

        if (mse === 0) return Infinity;

        // PSNR formula: 10 * log10(MAX^2 / MSE) where MAX value for 8-bit color is 255
        return 10 * Math.log10((255 * 255) / mse);
    }

    // --- Algorithm Ports ---
    function compressOneLevel(imgData) {
        let w = Math.floor(imgData.width / 2);
        let h = Math.floor(imgData.height / 2);
        let out = new ImageData(w, h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let iOut = (y * w + x) * 4;
                let i1 = ((y * 2) * imgData.width + (x * 2)) * 4;
                let i2 = ((y * 2) * imgData.width + (x * 2 + 1)) * 4;
                let i3 = ((y * 2 + 1) * imgData.width + (x * 2)) * 4;
                let i4 = ((y * 2 + 1) * imgData.width + (x * 2 + 1)) * 4;

                for (let c = 0; c < 3; c++) {
                    out.data[iOut + c] = (imgData.data[i1 + c] + imgData.data[i2 + c] + imgData.data[i3 + c] + imgData.data[i4 + c]) / 4;
                }
                out.data[iOut + 3] = 255;
            }
        }
        return out;
    }

    function decompressNearest(imgData) {
        let w = imgData.width * 2;
        let h = imgData.height * 2;
        let out = new ImageData(w, h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let iOut = (y * w + x) * 4;
                let iSrc = (Math.floor(y / 2) * imgData.width + Math.floor(x / 2)) * 4;
                for (let c = 0; c < 3; c++) {
                    out.data[iOut + c] = imgData.data[iSrc + c];
                }
                out.data[iOut + 3] = 255;
            }
        }
        return out;
    }
});
