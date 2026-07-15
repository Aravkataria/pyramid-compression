// ─── CURSOR TRACKING ───
const cur = document.getElementById('cur'), ring = document.getElementById('curRing');
let mx=0, my=0, rx=0, ry=0;
document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; });
(function tick(){
    cur.style.left = mx+'px'; cur.style.top = my+'px';
    rx += (mx-rx)*0.15; ry += (my-ry)*0.15;
    ring.style.left = rx+'px'; ring.style.top = ry+'px';
    requestAnimationFrame(tick);
})();

document.querySelectorAll('button, a, input, select, .drop-zone').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('btn-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('btn-hover'));
});

// ─── SCROLL REVEAL ───
function checkReveal(){
    const vh = window.innerHeight;
    document.querySelectorAll('.sr').forEach(el => {
        const rect = el.getBoundingClientRect();
        if(rect.top < vh * 0.90 && rect.bottom > 0) { el.classList.add('visible'); el.classList.remove('past'); }
        else if(rect.bottom < 0) { el.classList.remove('visible'); el.classList.add('past'); }
    });
}
window.addEventListener('scroll', checkReveal, {passive:true});
checkReveal();

// ─── THEME TOGGLE ───
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    themeToggle.innerText = isDark ? '🌙 Dark' : '☀️ Light';
});

// ─── IMAGE COMPRESSION LOGIC ───
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadView = document.getElementById('uploadView');
const editorView = document.getElementById('editorView');
const windowTitle = document.getElementById('windowTitle');
const resetBtn = document.getElementById('resetBtn');

const modeSelect = document.getElementById('modeSelect');
const levelsInput = document.getElementById('levelsInput');
const levelsDisplay = document.getElementById('levelsDisplay');
const methodSelect = document.getElementById('methodSelect');
const methodGroup = document.getElementById('methodGroup');
const outputLabel = document.getElementById('outputLabel');

const originalCanvas = document.getElementById('originalCanvas');
const outputCanvas = document.getElementById('outputCanvas');
const originalSizeEl = document.getElementById('originalSize');
const outputSizeEl = document.getElementById('outputSize');
const psnrDisplay = document.getElementById('psnrDisplay');

let originalImg = new Image();

// Drag & Drop
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('active');
    if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => { if(e.target.files.length) handleFile(e.target.files[0]); });

function handleFile(file) {
    if (!file.type.startsWith('image/')) return alert('Please upload a valid image file.');
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImg.onload = () => {
            uploadView.style.display = 'none';
            editorView.style.display = 'flex';
            editorView.classList.add('view-enter');
            windowTitle.innerText = "Live Editor";
            setupOriginalCanvas();
            processImage();
        };
        originalImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function setupOriginalCanvas() {
    const MAX_SIZE = 1200; // Safeguard
    let w = originalImg.width, h = originalImg.height;
    if (w > MAX_SIZE || h > MAX_SIZE) {
        const r = Math.min(MAX_SIZE / w, MAX_SIZE / h);
        w = Math.floor(w * r); h = Math.floor(h * r);
    }
    
    // NEW: Round down to nearest multiple of 64 so math is perfect up to 6 levels
    w = w - (w % 64);
    h = h - (h % 64);

    originalCanvas.width = w; originalCanvas.height = h;
    const ctx = originalCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(originalImg, 0, 0, w, h);
    originalSizeEl.innerText = `${w} × ${h} px`;
}

// Controls
levelsInput.addEventListener('input', () => { levelsDisplay.innerText = levelsInput.value; if(originalImg.src) processImage(); });
modeSelect.addEventListener('change', () => {
    const isDecompress = modeSelect.value === 'decompress';
    methodGroup.style.display = isDecompress ? 'flex' : 'none';
    outputLabel.innerText = isDecompress ? "Decompressed" : "Compressed";
    if(originalImg.src) processImage();
});
methodSelect.addEventListener('change', () => { if(originalImg.src) processImage(); });

resetBtn.addEventListener('click', () => {
    editorView.style.display = 'none';
    editorView.classList.remove('view-enter');
    uploadView.style.display = 'flex';
    windowTitle.innerText = "Upload Image";
    fileInput.value = ''; psnrDisplay.style.display = 'none';
});

// Core Pipeline
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
}

function renderToOutput(data) {
    outputCanvas.width = data.width; outputCanvas.height = data.height;
    outputCanvas.getContext('2d').putImageData(data, 0, 0);
    outputSizeEl.innerText = `${data.width} × ${data.height} px`;
}

// Math Algorithms
function compressOneLevel(imgData) {
    let w = Math.floor(imgData.width / 2), h = Math.floor(imgData.height / 2);
    let out = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let iOut = (y * w + x) * 4;
            let i1 = ((y * 2) * imgData.width + (x * 2)) * 4, i2 = ((y * 2) * imgData.width + (x * 2 + 1)) * 4;
            let i3 = ((y * 2 + 1) * imgData.width + (x * 2)) * 4, i4 = ((y * 2 + 1) * imgData.width + (x * 2 + 1)) * 4;
            for(let c = 0; c < 3; c++) out.data[iOut+c] = (imgData.data[i1+c] + imgData.data[i2+c] + imgData.data[i3+c] + imgData.data[i4+c]) / 4;
            out.data[iOut+3] = 255; 
        }
    }
    return out;
}

function decompressNearest(imgData) {
    let w = imgData.width * 2, h = imgData.height * 2;
    let out = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let iOut = (y * w + x) * 4, iSrc = (Math.floor(y / 2) * imgData.width + Math.floor(x / 2)) * 4;
            for(let c = 0; c < 3; c++) out.data[iOut+c] = imgData.data[iSrc+c];
            out.data[iOut+3] = 255; 
        }
    }
    return out;
}

function updatePsnrDisplay(d1, d2) {
    if (d1.width !== d2.width || d1.height !== d2.height) { psnrDisplay.style.display = 'none'; return; }
    let sse = 0;
    for (let i = 0; i < d1.data.length; i += 4) {
        let rd = d1.data[i] - d2.data[i], gd = d1.data[i+1] - d2.data[i+1], bd = d1.data[i+2] - d2.data[i+2];
        sse += (rd*rd) + (gd*gd) + (bd*bd);
    }
    let mse = sse / (d1.width * d1.height * 3);
    let val = mse === 0 ? Infinity : 10 * Math.log10((255*255)/mse);
    psnrDisplay.innerText = `PSNR: ${val === Infinity ? 'Perfect (∞)' : val.toFixed(2) + ' dB'}`;
    psnrDisplay.style.display = 'inline-block';
}

// Downloader
function dlCanvas(canvas, prefix) {
    if(!canvas.width) return;
    const a = document.createElement('a'); a.download = `${prefix}.png`; a.href = canvas.toDataURL(); a.click();
}
document.getElementById('downloadOriginalBtn').onclick = () => dlCanvas(originalCanvas, 'pyramid-original');
document.getElementById('downloadOutputBtn').onclick = () => dlCanvas(outputCanvas, 'pyramid-processed');
