const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let sigma = 0.5;
let tMax = 26.0;
let sweeping = true;
let sweepDir = 1;

const ZEROS = [14.134725, 21.02204, 25.010858, 30.424876, 32.935062, 37.586178, 40.918719, 43.327073];

// Precompute Borwein weights for N = 26 terms: fast & accurate in the critical strip
const N_TERMS = 26;
const D_WEIGHTS = (() => {
    const d = new Array(N_TERMS + 1).fill(0);
    // d_k = n * sum_{i=0}^k (n + i - 1)! * 4^i / ((n - i)! * (2i)!)
    for (let k = 0; k <= N_TERMS; k++) {
        let sum = 0;
        let term = 1;
        for (let i = 0; i <= k; i++) {
            if (i > 0) {
                term *= (N_TERMS + i - 1) * (N_TERMS - i + 1) * 4 / ((2 * i - 1) * (2 * i));
            }
            sum += term;
        }
        d[k] = N_TERMS * sum;
    }
    return d;
})();

function zeta(re, im) {
    // Borwein acceleration for Dirichlet eta(s)
    const dn = D_WEIGHTS[N_TERMS];
    let etaRe = 0;
    let etaIm = 0;
    for (let k = 0; k < N_TERMS; k++) {
        const sign = k % 2 === 0 ? 1 : -1;
        const w = sign * (D_WEIGHTS[k] - dn);
        const ln = Math.log(k + 1);
        const mag = Math.exp(-re * ln);
        const ang = -im * ln;
        etaRe += w * mag * Math.cos(ang);
        etaIm += w * mag * Math.sin(ang);
    }
    etaRe /= -dn;
    etaIm /= -dn;

    // zeta(s) = eta(s) / (1 - 2^(1 - s))
    const ln2 = Math.LN2;
    const pMag = Math.exp((1 - re) * ln2);
    const pAng = -im * ln2;
    const denRe = 1 - pMag * Math.cos(pAng);
    const denIm = -pMag * Math.sin(pAng);
    const den2 = denRe * denRe + denIm * denIm || 1e-12;

    return {
        re: (etaRe * denRe + etaIm * denIm) / den2,
        im: (etaIm * denRe - etaRe * denIm) / den2,
    };
}

// Riemann-Siegel theta approximation for Hardy Z(t) on the critical line
function riemannTheta(t) {
    if (t <= 0.1) return 0;
    return (t / 2) * Math.log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8 + 1 / (48 * t);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;
    const splitX = W * 0.52;

    // Left frame: complex zeta(sigma + iu) plane
    const pad = 28;
    const cx = splitX * 0.5;
    const cy = H * 0.52;
    const scale = Math.min(splitX - 2 * pad, H - 120) / 7.2;

    ctx.fillStyle = "rgba(239, 244, 230, 0.72)";
    ctx.fillRect(pad, 60, splitX - pad * 1.5, H - 100);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, 60, splitX - pad * 1.5, H - 100);

    // Axes in zeta-plane
    ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, cy);
    ctx.lineTo(splitX - pad * 0.5, cy);
    ctx.moveTo(cx, 60);
    ctx.lineTo(cx, H - 40);
    ctx.stroke();

    // Origin marker (0 + 0i)
    ctx.strokeStyle = "#d63a22";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Trace u from 0.8 to tMax
    const samples = Math.max(120, Math.floor(tMax * 22));
    ctx.beginPath();
    let lastZ = { re: 0, im: 0 };
    for (let i = 0; i <= samples; i++) {
        const u = 0.8 + (i / samples) * (tMax - 0.8);
        const z = zeta(sigma, u);
        lastZ = z;
        const px = cx + z.re * scale;
        const py = cy - z.im * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#1d5fa7";
    ctx.lineWidth = 1.9;
    ctx.stroke();

    // Current point ζ(σ + i tMax)
    const tipX = cx + lastZ.re * scale;
    const tipY = cy - lastZ.im * scale;
    ctx.fillStyle = "#d63a22";
    ctx.beginPath();
    ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#14202b";
    ctx.font = "600 12px 'Martian Mono', monospace";
    ctx.fillText(`ζ(${sigma.toFixed(2)} + it)  [0.8 ≤ t ≤ ${tMax.toFixed(2)}]`, pad + 12, 82);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("origin (0,0)", cx + 10, cy - 8);

    // Right frame: Hardy Z(t) / |ζ(σ+it)| strip plot
    const rx = splitX + 10;
    const rw = W - rx - pad;
    const ry = 60;
    const rh = H - 100;

    ctx.fillStyle = "rgba(239, 244, 230, 0.72)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);

    const midY = ry + rh * 0.55;
    ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, midY);
    ctx.lineTo(rx + rw, midY);
    ctx.stroke();

    const tWindow = 46;
    ctx.beginPath();
    for (let px = 0; px <= rw; px += 2) {
        const t = (px / rw) * tWindow;
        if (t < 0.8) continue;
        const z = zeta(sigma, t);
        let val;
        if (Math.abs(sigma - 0.5) < 0.005) {
            const th = riemannTheta(t);
            val = z.re * Math.cos(th) - z.im * Math.sin(th);
        } else {
            val = Math.hypot(z.re, z.im);
        }
        const py = midY - Math.max(-3.6, Math.min(3.6, val)) * (rh * 0.11);
        if (px < 10) ctx.moveTo(rx + px, py);
        else ctx.lineTo(rx + px, py);
    }
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Zero markers on the t-axis
    ctx.font = "10px 'Martian Mono', monospace";
    ZEROS.forEach((g, idx) => {
        const gx = rx + (g / tWindow) * rw;
        ctx.strokeStyle = "rgba(214, 58, 34, 0.45)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(gx, ry + 32);
        ctx.lineTo(gx, ry + rh - 18);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#d63a22";
        ctx.beginPath();
        ctx.arc(gx, midY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`γ${idx + 1}`, gx - 8, ry + rh - 6);
    });

    // Cursor line at tMax
    const curX = rx + (tMax / tWindow) * rw;
    ctx.strokeStyle = "#d63a22";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(curX, ry + 26);
    ctx.lineTo(curX, ry + rh);
    ctx.stroke();

    ctx.fillStyle = "#14202b";
    ctx.font = "600 12px 'Martian Mono', monospace";
    ctx.fillText(
        Math.abs(sigma - 0.5) < 0.005 ? "Hardy Z(t) on Critical Line σ = ½" : `|ζ(${sigma.toFixed(2)} + it)|`,
        rx + 12,
        ry + 22
    );

    const signIm = lastZ.im >= 0 ? "+" : "−";
    document.getElementById("zeta-readout").textContent =
        `ζ(${sigma.toFixed(2)} + ${tMax.toFixed(2)}i) = ${lastZ.re.toFixed(3)} ${signIm} ${Math.abs(lastZ.im).toFixed(3)}i  (|ζ|=${Math.hypot(lastZ.re, lastZ.im).toFixed(3)})`;
}

function tick() {
    if (sweeping) {
        tMax += 0.035 * sweepDir;
        if (tMax >= 44) { tMax = 44; sweepDir = -1; }
        if (tMax <= 2) { tMax = 2; sweepDir = 1; }
        document.getElementById("t-slider").value = tMax.toFixed(2);
        document.getElementById("t-val").textContent = tMax.toFixed(2);
    }
    draw();
    requestAnimationFrame(tick);
}

document.getElementById("sigma").addEventListener("input", (e) => {
    sigma = parseFloat(e.target.value);
    document.getElementById("sigma-val").textContent = sigma.toFixed(2);
});

document.getElementById("t-slider").addEventListener("input", (e) => {
    sweeping = false;
    document.getElementById("sweep-btn").textContent = "Play Sweep";
    tMax = parseFloat(e.target.value);
    document.getElementById("t-val").textContent = tMax.toFixed(2);
});

document.getElementById("critical-btn").addEventListener("click", () => {
    sigma = 0.5;
    document.getElementById("sigma").value = "0.50";
    document.getElementById("sigma-val").textContent = "0.50";
});

document.getElementById("sweep-btn").addEventListener("click", () => {
    sweeping = !sweeping;
    document.getElementById("sweep-btn").textContent = sweeping ? "Pause Sweep" : "Play Sweep";
});

document.querySelectorAll(".zero-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        sweeping = false;
        document.getElementById("sweep-btn").textContent = "Play Sweep";
        sigma = 0.5;
        tMax = parseFloat(btn.dataset.t);
        document.getElementById("sigma").value = "0.50";
        document.getElementById("sigma-val").textContent = "0.50";
        document.getElementById("t-slider").value = tMax;
        document.getElementById("t-val").textContent = tMax.toFixed(2);
    });
});

tick();
