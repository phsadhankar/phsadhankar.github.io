
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let waveletType = "morlet";
let signalType = "chirp";
let numScales = 32;
let centralFreq = 5.0;

const N = 512;
const t = Array.from({ length: N }, (_, i) => i / 50);

// Mother wavelets
const wavelets = {
    morlet: (t, scale) => {
        const sigma = scale / 5;
        return (
            Math.exp((-t * t) / (2 * sigma * sigma)) *
            Math.cos((2 * Math.PI * t) / scale)
        );
    },
    "mexican-hat": (t, scale) => {
        const sigma = scale / 2;
        const norm = t / sigma;
        return (
            (2 / (Math.sqrt(3 * sigma) * Math.pow(Math.PI, 0.25))) *
            (1 - norm * norm) *
            Math.exp((-norm * norm) / 2)
        );
    },
    haar: (t, scale) => {
        const tNorm = t / scale;
        if (tNorm >= 0 && tNorm < 0.5) return 1;
        if (tNorm >= 0.5 && tNorm < 1) return -1;
        return 0;
    },
    daubechies: (t, scale) => {
        // Simplified Daubechies-4
        const tNorm = t / scale;
        const h = [0.6830127, 1.1830127, 0.3169873, -0.1830127];
        let sum = 0;
        for (let k = 0; k < h.length; k++) {
            if (tNorm >= k && tNorm < k + 1) {
                sum += h[k];
            }
        }
        return sum;
    },
};

// Signal generators
function generateSignal() {
    const signal = new Array(N);

    switch (signalType) {
        case "chirp":
            for (let i = 0; i < N; i++) {
                const freq = 1 + (i / N) * 9;
                signal[i] = Math.sin(2 * Math.PI * freq * t[i]);
            }
            break;

        case "multi-tone":
            for (let i = 0; i < N; i++) {
                signal[i] =
                    Math.sin(2 * Math.PI * 2 * t[i]) +
                    0.5 * Math.sin(2 * Math.PI * 5 * t[i]) +
                    0.3 * Math.sin(2 * Math.PI * 8 * t[i]);
            }
            break;

        case "transient":
            for (let i = 0; i < N; i++) {
                signal[i] = Math.sin(2 * Math.PI * 3 * t[i]);
                if (i > N / 4 && i < N / 4 + 50) {
                    signal[i] += 2 * Math.sin(2 * Math.PI * 10 * t[i]);
                }
                if (i > (3 * N) / 4 && i < (3 * N) / 4 + 30) {
                    signal[i] += 1.5 * Math.sin(2 * Math.PI * 15 * t[i]);
                }
            }
            break;

        case "noisy":
            for (let i = 0; i < N; i++) {
                signal[i] =
                    Math.sin(2 * Math.PI * centralFreq * t[i]) +
                    0.3 * Math.sin(2 * Math.PI * (centralFreq * 2) * t[i]) +
                    (Math.random() - 0.5) * 0.5;
            }
            break;
    }

    return signal;
}

function cwt(signal, scales) {
    const wavelet = wavelets[waveletType];
    const coeffs = Array(scales.length)
        .fill()
        .map(() => Array(N).fill(0));

    for (let s = 0; s < scales.length; s++) {
        const scale = scales[s];
        for (let i = 0; i < N; i++) {
            let sum = 0;
            for (let j = 0; j < N; j++) {
                const tau = t[j] - t[i];
                sum += signal[j] * wavelet(tau, scale);
            }
            coeffs[s][i] = sum / Math.sqrt(scale);
        }
    }

    return coeffs;
}

function drawSignal(signal) {
    const w = canvas.width * 0.8;
    const h = canvas.height * 0.2;
    const x = canvas.width * 0.1;
    const y = 30;

    ctx.fillStyle = "rgba(239, 244, 230, 0.78)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.beginPath();
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;

    const step = w / N;
    const scale = h / 8;
    const mid = y + h / 2;

    for (let i = 0; i < N; i++) {
        const px = x + i * step;
        const py = mid - signal[i] * scale;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = "#14202b";
    ctx.font = "14px 'Martian Mono', monospace";
    ctx.fillText("Signal: f(t)", x + 10, y + 20);
}

function drawScalogram(coeffs, scales) {
    const w = canvas.width * 0.8;
    const h = canvas.height * 0.35;
    const x = canvas.width * 0.1;
    const y = canvas.height * 0.25 + 30;

    ctx.fillStyle = "rgba(239, 244, 230, 0.78)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Find max coefficient for normalization
    let maxCoeff = 0;
    coeffs.forEach((row) => {
        row.forEach((val) => {
            maxCoeff = Math.max(maxCoeff, Math.abs(val));
        });
    });

    const pixelWidth = w / N;
    const pixelHeight = h / scales.length;

    for (let s = 0; s < scales.length; s++) {
        for (let i = 0; i < N; i++) {
            const intensity = Math.abs(coeffs[s][i]) / maxCoeff;
            const color = Math.floor(intensity * 255);

            ctx.fillStyle = `rgba(214, 58, 34, ${Math.min(0.9, (color / 255) * 0.92)})`;
            ctx.fillRect(
                x + i * pixelWidth,
                y + s * pixelHeight,
                pixelWidth + 1,
                pixelHeight + 1
            );
        }
    }

    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#14202b";
    ctx.font = "14px 'Martian Mono', monospace";
    ctx.fillText("Scalogram: |W(a,b)|", x + 10, y + 20);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("Time →", x + w - 50, y + h + 15);
    ctx.fillText("Scale", x - 40, y + h / 2);
}

function drawDecomposition(coeffs, scales) {
    const w = canvas.width * 0.8;
    const h = canvas.height * 0.25;
    const x = canvas.width * 0.1;
    const y = canvas.height * 0.68 + 30;

    ctx.fillStyle = "rgba(239, 244, 230, 0.78)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Draw specific scales
    const indicesToDraw = [
        Math.floor(scales.length * 0.2),
        Math.floor(scales.length * 0.5),
        Math.floor(scales.length * 0.8),
    ];

    const colors = ["#d63a22", "#1d5fa7", "#9a5b13"];
    const subH = h / indicesToDraw.length;

    indicesToDraw.forEach((scaleIdx, idx) => {
        const offsetY = y + idx * subH;
        const coeffsRow = coeffs[scaleIdx];
        const maxVal = Math.max(...coeffsRow.map(Math.abs));

        ctx.beginPath();
        ctx.strokeStyle = colors[idx];
        ctx.lineWidth = 1.5;

        for (let i = 0; i < N; i++) {
            const px = x + (i / N) * w;
            const py =
                offsetY + subH / 2 - (coeffsRow[i] / maxVal) * (subH * 0.4);

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.fillStyle = colors[idx];
        ctx.font = "10px 'Martian Mono', monospace";
        ctx.fillText(
            `Scale ${scales[scaleIdx].toFixed(2)}`,
            x + 5,
            offsetY + 15
        );
    });

    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#14202b";
    ctx.font = "14px 'Martian Mono', monospace";
    ctx.fillText("Decomposition Levels", x + 10, y - 10);
}

function analyze() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const signal = generateSignal();
    const scales = Array.from(
        { length: numScales },
        (_, i) => 0.5 + (i / numScales) * 10
    );
    const coeffs = cwt(signal, scales);

    drawSignal(signal);
    drawScalogram(coeffs, scales);
    drawDecomposition(coeffs, scales);
}

document
    .getElementById("wavelet-type")
    .addEventListener("change", (e) => {
        waveletType = e.target.value;
        analyze();
    });

document.getElementById("signal-type").addEventListener("change", (e) => {
    signalType = e.target.value;
    analyze();
});

document.getElementById("scales").addEventListener("input", (e) => {
    numScales = parseInt(e.target.value);
    document.getElementById("scales-val").textContent = numScales;
});

document.getElementById("freq").addEventListener("input", (e) => {
    centralFreq = parseFloat(e.target.value);
    document.getElementById("freq-val").textContent =
        centralFreq.toFixed(1);
});

document.getElementById("analyze").addEventListener("click", analyze);

analyze();