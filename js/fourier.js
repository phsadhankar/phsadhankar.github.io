const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let freq1 = 2,
    amp1 = 1;
let freq2 = 5,
    amp2 = 0.5;
let freq3 = 8,
    amp3 = 0.3;
let time = 0;

const N = 512;
const sampleRate = 100;

// FFT Implementation
class FFT {
    constructor(size) {
        this.size = size;
        this.real = new Float64Array(size);
        this.imag = new Float64Array(size);
    }

    forward(input) {
        for (let i = 0; i < this.size; i++) {
            this.real[i] = input[i] || 0;
            this.imag[i] = 0;
        }
        this.transform(false);
    }

    transform(inverse) {
        const n = this.size;
        let j = 0;

        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                let temp = this.real[i];
                this.real[i] = this.real[j];
                this.real[j] = temp;
                temp = this.imag[i];
                this.imag[i] = this.imag[j];
                this.imag[j] = temp;
            }
            let k = n >> 1;
            while (j >= k) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }

        for (let len = 2; len <= n; len <<= 1) {
            const angle = ((inverse ? 2 : -2) * Math.PI) / len;
            const wlen_re = Math.cos(angle);
            const wlen_im = Math.sin(angle);

            for (let i = 0; i < n; i += len) {
                let w_re = 1;
                let w_im = 0;

                for (let j = 0; j < len / 2; j++) {
                    const u_re = this.real[i + j];
                    const u_im = this.imag[i + j];
                    const v_re =
                        this.real[i + j + len / 2] * w_re -
                        this.imag[i + j + len / 2] * w_im;
                    const v_im =
                        this.real[i + j + len / 2] * w_im +
                        this.imag[i + j + len / 2] * w_re;

                    this.real[i + j] = u_re + v_re;
                    this.imag[i + j] = u_im + v_im;
                    this.real[i + j + len / 2] = u_re - v_re;
                    this.imag[i + j + len / 2] = u_im - v_im;

                    const temp_re = w_re * wlen_re - w_im * wlen_im;
                    w_im = w_re * wlen_im + w_im * wlen_re;
                    w_re = temp_re;
                }
            }
        }

        if (inverse) {
            for (let i = 0; i < n; i++) {
                this.real[i] /= n;
                this.imag[i] /= n;
            }
        }
    }

    magnitude() {
        const mag = new Float64Array(this.size);
        for (let i = 0; i < this.size; i++) {
            mag[i] = Math.sqrt(
                this.real[i] * this.real[i] + this.imag[i] * this.imag[i]
            );
        }
        return mag;
    }
}

const fft = new FFT(N);

function generateSignal() {
    const signal = [];
    for (let i = 0; i < N; i++) {
        const t = i / sampleRate;
        signal[i] =
            amp1 * Math.sin(2 * Math.PI * freq1 * t) +
            amp2 * Math.sin(2 * Math.PI * freq2 * t) +
            amp3 * Math.sin(2 * Math.PI * freq3 * t);
    }
    return signal;
}

function drawTimeDomain(signal) {
    const w = canvas.width * 0.7;
    const h = canvas.height * 0.3;
    const x = canvas.width * 0.15;
    const y = canvas.height * 0.1;

    ctx.fillStyle = "rgba(239, 244, 230, 0.78)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.beginPath();
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;

    const step = w / N;
    const scale = h / 6;
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
    ctx.fillText("Time Domain: f(t)", x + 10, y + 20);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("0", x - 15, mid);
    ctx.fillText("t →", x + w - 30, y + h + 20);
}

function drawFrequencyDomain(magnitude) {
    const w = canvas.width * 0.7;
    const h = canvas.height * 0.3;
    const x = canvas.width * 0.15;
    const y = canvas.height * 0.55;

    ctx.fillStyle = "rgba(239, 244, 230, 0.78)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const maxMag = Math.max(...magnitude.slice(0, N / 2));
    const step = w / (N / 2);

    ctx.fillStyle = "rgba(214, 58, 34, 0.78)";
    for (let i = 0; i < N / 2; i++) {
        const barHeight = (magnitude[i] / maxMag) * h * 0.9;
        const px = x + i * step;
        const py = y + h - barHeight;
        ctx.fillRect(px, py, step * 0.8, barHeight);
    }

    ctx.fillStyle = "#14202b";
    ctx.font = "14px 'Martian Mono', monospace";
    ctx.fillText("Frequency Domain: |F(ω)|", x + 10, y + 20);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("0 Hz", x - 10, y + h + 15);
    ctx.fillText(`${sampleRate / 2} Hz`, x + w - 40, y + h + 15);
}

function drawComplexCircle(t) {
    const cx = canvas.width * 0.88;
    const cy = canvas.height * 0.5;
    const r = 80;

    ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = "rgba(20, 32, 43, 0.25)";
    ctx.beginPath();
    ctx.moveTo(cx - r - 10, cy);
    ctx.lineTo(cx + r + 10, cy);
    ctx.moveTo(cx, cy - r - 10);
    ctx.lineTo(cx, cy + r + 10);
    ctx.stroke();

    const angles = [freq1 * t, freq2 * t, freq3 * t];
    const amps = [amp1, amp2, amp3];
    const colors = ["#d63a22", "#1d5fa7", "#9a5b13"];

    for (let i = 0; i < 3; i++) {
        if (amps[i] > 0) {
            const angle = angles[i] * 2 * Math.PI;
            const px = cx + Math.cos(angle) * r * 0.7 * amps[i];
            const py = cy + Math.sin(angle) * r * 0.7 * amps[i];

            ctx.strokeStyle = colors[i];
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(px, py);
            ctx.stroke();

            ctx.fillStyle = colors[i];
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    ctx.fillStyle = "#14202b";
    ctx.font = "12px 'Martian Mono', monospace";
    ctx.fillText("e^(iωt)", cx - 20, cy - r - 20);
}

function updateFrequencyInfo(magnitude) {
    const peaks = [];
    const threshold = Math.max(...magnitude) * 0.1;

    for (let i = 1; i < N / 4; i++) {
        if (
            magnitude[i] > threshold &&
            magnitude[i] > magnitude[i - 1] &&
            magnitude[i] > magnitude[i + 1]
        ) {
            const freq = (i / N) * sampleRate;
            peaks.push({ freq: freq.toFixed(2), mag: magnitude[i].toFixed(2) });
        }
    }

    let info = "Detected Frequencies:<br>";
    peaks.slice(0, 5).forEach((p) => {
        info += `${p.freq} Hz (mag: ${p.mag})<br>`;
    });

    document.getElementById("freq-info").innerHTML = info;
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const signal = generateSignal();
    fft.forward(signal);
    const magnitude = fft.magnitude();

    drawTimeDomain(signal);
    drawFrequencyDomain(magnitude);
    drawComplexCircle(time);
    updateFrequencyInfo(magnitude);

    time += 0.02;
    requestAnimationFrame(animate);
}

// Controls
document.getElementById("freq1").addEventListener("input", (e) => {
    freq1 = parseFloat(e.target.value);
    document.getElementById("freq1-val").textContent = freq1.toFixed(1);
});

document.getElementById("amp1").addEventListener("input", (e) => {
    amp1 = parseFloat(e.target.value);
    document.getElementById("amp1-val").textContent = amp1.toFixed(1);
});

document.getElementById("freq2").addEventListener("input", (e) => {
    freq2 = parseFloat(e.target.value);
    document.getElementById("freq2-val").textContent = freq2.toFixed(1);
});

document.getElementById("amp2").addEventListener("input", (e) => {
    amp2 = parseFloat(e.target.value);
    document.getElementById("amp2-val").textContent = amp2.toFixed(1);
});

document.getElementById("freq3").addEventListener("input", (e) => {
    freq3 = parseFloat(e.target.value);
    document.getElementById("freq3-val").textContent = freq3.toFixed(1);
});

document.getElementById("amp3").addEventListener("input", (e) => {
    amp3 = parseFloat(e.target.value);
    document.getElementById("amp3-val").textContent = amp3.toFixed(1);
});

document.getElementById("preset1").addEventListener("click", () => {
    freq1 = 1;
    amp1 = 1;
    freq2 = 3;
    amp2 = 0.33;
    freq3 = 5;
    amp3 = 0.2;
    updateSliders();
});

document.getElementById("preset2").addEventListener("click", () => {
    freq1 = 2;
    amp1 = 1;
    freq2 = 4;
    amp2 = 0.5;
    freq3 = 6;
    amp3 = 0.33;
    updateSliders();
});

document.getElementById("preset3").addEventListener("click", () => {
    freq1 = Math.random() * 9 + 1;
    amp1 = Math.random() * 1.5;
    freq2 = Math.random() * 9 + 1;
    amp2 = Math.random() * 1.5;
    freq3 = Math.random() * 9 + 1;
    amp3 = Math.random() * 1.5;
    updateSliders();
});

function updateSliders() {
    document.getElementById("freq1").value = freq1;
    document.getElementById("freq1-val").textContent = freq1.toFixed(1);
    document.getElementById("amp1").value = amp1;
    document.getElementById("amp1-val").textContent = amp1.toFixed(1);
    document.getElementById("freq2").value = freq2;
    document.getElementById("freq2-val").textContent = freq2.toFixed(1);
    document.getElementById("amp2").value = amp2;
    document.getElementById("amp2-val").textContent = amp2.toFixed(1);
    document.getElementById("freq3").value = freq3;
    document.getElementById("freq3-val").textContent = freq3.toFixed(1);
    document.getElementById("amp3").value = amp3;
    document.getElementById("amp3-val").textContent = amp3.toFixed(1);
}

animate();