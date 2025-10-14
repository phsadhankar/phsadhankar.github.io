
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let centerX = -0.5;
let centerY = 0.0;
let zoom = 1.0;
let maxIter = 100;
let colorScheme = "classic";
let quality = 2;
let juliaMode = false;
let juliaC = { re: -0.7, im: 0.27015 };

let isDragging = false;
let dragStartX, dragStartY;
let dragEndX, dragEndY;

const colorSchemes = {
    classic: (n, maxIter) => {
        if (n === maxIter) return [0, 0, 0];
        const hue = (n / maxIter) * 360;
        return hslToRgb(hue, 100, 50);
    },
    electric: (n, maxIter) => {
        if (n === maxIter) return [0, 0, 0];
        const t = n / maxIter;
        return [0, Math.floor(t * 255), Math.floor(t * 100)];
    },
    fire: (n, maxIter) => {
        if (n === maxIter) return [0, 0, 0];
        const t = n / maxIter;
        return [Math.floor(t * 255), Math.floor(t * t * 255), 0];
    },
    ocean: (n, maxIter) => {
        if (n === maxIter) return [0, 0, 50];
        const t = n / maxIter;
        return [0, Math.floor(t * 150), Math.floor(100 + t * 155)];
    },
    psychedelic: (n, maxIter) => {
        if (n === maxIter) return [0, 0, 0];
        const t = n / maxIter;
        return [
            Math.floor(127 + 127 * Math.sin(t * Math.PI * 4)),
            Math.floor(127 + 127 * Math.sin(t * Math.PI * 4 + 2)),
            Math.floor(127 + 127 * Math.sin(t * Math.PI * 4 + 4)),
        ];
    },
};

function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [
        Math.floor(255 * f(0)),
        Math.floor(255 * f(8)),
        Math.floor(255 * f(4)),
    ];
}

function mandelbrot(cReal, cImag) {
    let zReal = juliaMode ? cReal : 0;
    let zImag = juliaMode ? cImag : 0;
    const cr = juliaMode ? juliaC.re : cReal;
    const ci = juliaMode ? juliaC.im : cImag;

    for (let n = 0; n < maxIter; n++) {
        const zReal2 = zReal * zReal;
        const zImag2 = zImag * zImag;

        if (zReal2 + zImag2 > 4) {
            return n;
        }

        const temp = zReal2 - zImag2 + cr;
        zImag = 2 * zReal * zImag + ci;
        zReal = temp;
    }
    return maxIter;
}

function render() {
    document.getElementById("loading").style.display = "block";

    setTimeout(() => {
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const data = imageData.data;

        const range = 3.0 / zoom;
        const xMin = centerX - range;
        const xMax = centerX + range;
        const yMin = centerY - range * (canvas.height / canvas.width);
        const yMax = centerY + range * (canvas.height / canvas.width);

        document.getElementById("range").textContent = (
            range * 2
        ).toExponential(2);

        for (let py = 0; py < canvas.height; py += quality) {
            for (let px = 0; px < canvas.width; px += quality) {
                const x = xMin + (px / canvas.width) * (xMax - xMin);
                const y = yMax - (py / canvas.height) * (yMax - yMin);

                const n = mandelbrot(x, y);
                const color = colorSchemes[colorScheme](n, maxIter);

                for (let dy = 0; dy < quality; dy++) {
                    for (let dx = 0; dx < quality; dx++) {
                        const idx = ((py + dy) * canvas.width + (px + dx)) * 4;
                        data[idx] = color[0];
                        data[idx + 1] = color[1];
                        data[idx + 2] = color[2];
                        data[idx + 3] = 255;
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);

        if (isDragging) {
            ctx.strokeStyle = "#00ff41";
            ctx.lineWidth = 2;
            ctx.strokeRect(
                dragStartX,
                dragStartY,
                dragEndX - dragStartX,
                dragEndY - dragStartY
            );
        }

        document.getElementById("loading").style.display = "none";
        updateCoords();
    }, 10);
}

function screenToComplex(px, py) {
    const range = 3.0 / zoom;
    const xMin = centerX - range;
    const xMax = centerX + range;
    const yMin = centerY - range * (canvas.height / canvas.width);
    const yMax = centerY + range * (canvas.height / canvas.width);

    return {
        re: xMin + (px / canvas.width) * (xMax - xMin),
        im: yMax - (py / canvas.height) * (yMax - yMin),
    };
}

function updateCoords() {
    document.getElementById("center-real").textContent =
        centerX.toFixed(10);
    document.getElementById("center-imag").textContent =
        centerY.toFixed(10);
    document.getElementById("zoom-level").textContent =
        zoom.toExponential(2);
}

canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragEndX = e.clientX;
        dragEndY = e.clientY;
    }
});

canvas.addEventListener("mousemove", (e) => {
    const complex = screenToComplex(e.clientX, e.clientY);
    document.getElementById("mouse-real").textContent =
        complex.re.toFixed(6);
    document.getElementById("mouse-imag").textContent =
        complex.im.toFixed(6);

    if (isDragging) {
        dragEndX = e.clientX;
        dragEndY = e.clientY;
        render();
    }
});

canvas.addEventListener("mouseup", (e) => {
    if (e.button === 0 && isDragging) {
        isDragging = false;

        const width = Math.abs(dragEndX - dragStartX);
        const height = Math.abs(dragEndY - dragStartY);

        if (width > 10 && height > 10) {
            const center1 = screenToComplex(dragStartX, dragStartY);
            const center2 = screenToComplex(dragEndX, dragEndY);

            centerX = (center1.re + center2.re) / 2;
            centerY = (center1.im + center2.im) / 2;

            const rangeX = Math.abs(center2.re - center1.re);
            zoom *= 3.0 / zoom / rangeX;
        } else {
            const complex = screenToComplex(e.clientX, e.clientY);
            centerX = complex.re;
            centerY = complex.im;
            zoom *= 2;
        }

        render();
    }
});

canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    zoom /= 2;
    render();
});

document.getElementById("iterations").addEventListener("input", (e) => {
    maxIter = parseInt(e.target.value);
    document.getElementById("iter-val").textContent = maxIter;
    render();
});

document
    .getElementById("color-scheme")
    .addEventListener("change", (e) => {
        colorScheme = e.target.value;
        render();
    });

document.getElementById("quality").addEventListener("change", (e) => {
    quality = parseInt(e.target.value);
    render();
});

document.getElementById("reset").addEventListener("click", () => {
    centerX = -0.5;
    centerY = 0.0;
    zoom = 1.0;
    juliaMode = false;
    document.getElementById("julia").textContent = "Julia Set Mode";
    render();
});

document.getElementById("julia").addEventListener("click", () => {
    juliaMode = !juliaMode;
    document.getElementById("julia").textContent = juliaMode
        ? "Mandelbrot Mode"
        : "Julia Set Mode";
    if (juliaMode) {
        centerX = 0;
        centerY = 0;
        zoom = 0.7;
    } else {
        centerX = -0.5;
        centerY = 0;
        zoom = 1.0;
    }
    render();
});

render();