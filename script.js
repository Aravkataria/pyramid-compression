// Theme Setup
const themeToggle = document.getElementById('themeToggle');
let currentTheme = 'dark';

themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.innerText = currentTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// UI Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadView = document.getElementById('uploadView');
const editorView = document.getElementById('editorView');
const resetBtn = document.getElementById('resetBtn');

// Control Elements
const modeSelect = document.getElementById('modeSelect');
const levelSlider = document.getElementById('levelSlider');
const levelDisplay = document.getElementById('levelDisplay');
const methodSelect = document.getElementById('methodSelect');
const methodGroup = document.getElementById('methodGroup');
const outputLabel = document.getElementById('outputLabel');

// Canvas Elements
const originalCanvas = document.getElementById('originalCanvas');
const outputCanvas = document.getElementById('outputCanvas');
let originalImg = new Image();

// --- Drag & Drop Event Listeners ---
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) return alert('Please upload an image file.');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImg.onload = () => {
            // Switch views
            uploadView.classList.remove('active');
            editorView.classList.add('active');
            processImage();
        };
        originalImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Back to Upload
resetBtn.addEventListener('click', () => {
    editorView.classList.remove('active');
    uploadView.classList.add('active');
    fileInput.value = ''; 
});

// --- Control Listeners ---
levelSlider.addEventListener('input', () => {
    levelDisplay.innerText = levelSlider.value;
    processImage();
});

modeSelect.addEventListener('change', () => {
    if (modeSelect.value === 'decompress') {
        methodGroup.style.display = 'flex';
        outputLabel.innerText = "Decompressed Output";
    } else {
        methodGroup.style.display = 'none';
        outputLabel.innerText = "Compressed Output";
    }
    processImage();
});

methodSelect.addEventListener('change', processImage);

// --- Core Image Processing Logic ---
function processImage() {
    const oCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    originalCanvas.width = originalImg.width;
    originalCanvas.height = originalImg.height;
    oCtx.drawImage(originalImg, 0, 0);
    document.getElementById('originalSize').innerText = `${originalImg.width} × ${originalImg.height} px`;

    let levels = parseInt(levelSlider.value);
    let imgData = oCtx.getImageData(0, 0, originalImg.width, originalImg.height);
    let outData;

    if (modeSelect.value === 'compress') {
        // Compress Mode
        outData = imgData;
        for (let i = 0; i < levels; i++) {
            outData = compressOneLevel(outData);
        }
        outputCanvas.style.imageRendering = 'auto';
        renderToOutput(outData);
    } else {
        // Decompress Mode
        if (methodSelect.value === 'nearest') {
            outputCanvas.style.imageRendering = 'pixelated';
            outData = imgData;
            for (let i = 0; i < levels; i++) {
                outData = decompressNearest(outData);
            }
            renderToOutput(outData);
        } else {
            // Bilinear Method (Using Canvas Scaling)
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
        }
    }
}

function renderToOutput(imageData) {
    outputCanvas.width = imageData.width;
    outputCanvas.height = imageData.height;
    outputCanvas.getContext('2d').putImageData(imageData, 0, 0);
    document.getElementById('outputSize').innerText = `${imageData.width} × ${imageData.height} px`;
}

// --- Algorithm Ports from Python ---
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
            
            for(let c = 0; c < 3; c++) { 
                out.data[iOut+c] = (imgData.data[i1+c] + imgData.data[i2+c] + imgData.data[i3+c] + imgData.data[i4+c]) / 4;
            }
            out.data[iOut+3] = 255; 
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
            for(let c = 0; c < 3; c++) {
                out.data[iOut+c] = imgData.data[iSrc+c];
            }
            out.data[iOut+3] = 255; 
        }
    }
    return out;
}
