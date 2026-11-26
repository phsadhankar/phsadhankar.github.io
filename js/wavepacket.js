const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const N = 260;
const dx = 0.18;
const dt = 0.065;
let v0 = 1.6;
let k0 = 1.5;
let potType = "single";
let running = true;

let psiRe = new Float64Array(N);
let psiIm = new Float64Array(N);
let V = new Float64Array(N);

function buildPotential() {
    V.fill(0);
    if (potType === "single") {
        for (let i = 128; i <= 140; i++) V[i] = v0;
    } else if (potType === "double") {
        for (let i = 118; i <= 125; i++) V[i] = v0;
        for (let i = 142; i <= 149; i++) V[i] = v0;
    } else if (potType === "harmonic") {
        for (let i = 0; i < N; i++) {
            const x = (i - N * 0.5) * dx;
            V[i] = Math.min(4.0, 0.012 * x * x * v0);
        }
    }
}

function launchPacket() {
    buildPotential();
    const x0 = potType === "harmonic" ? N * 0.34 * dx : N * 0.28 * dx;
    const sigma = 2.6;
    let norm = 0;
    for (let i = 0; i < N; i++) {
        if (i === 0 || i === N - 1) {
            psiRe[i] = psiIm[i] = 0;
            continue;
        }
        const x = i * dx;
        const env = Math.exp(-((x - x0) * (x - x0)) / (2 * sigma * sigma));
        psiRe[i] = env * Math.cos(k0 * x);
        psiIm[i] = env * Math.sin(k0 * x);
        norm += psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i];
    }
    const inv = 1 / Math.sqrt(norm);
    for (let i = 0; i < N; i++) {
        psiRe[i] *= inv;
        psiIm[i] *= inv;
    }
}

// Crank-Nicolson: (I + i dt/2 H) psi^{n+1} = (I - i dt/2 H) psi^n
// Tridiagonal Thomas solve in complex numbers
const rhsRe = new Float64Array(N);
const rhsIm = new Float64Array(N);
const cpRe = new Float64Array(N);
const cpIm = new Float64Array(N);
const dpRe = new Float64Array(N);
const dpIm = new Float64Array(N);

function stepCN() {
    const r = dt / (4 * dx * dx); // hbar=1, m=1 -> 1/2 d^2/dx^2 gives dt/(4 dx^2)

    for (let i = 1; i < N - 1; i++) {
        const diag = 2 * r + 0.5 * dt * V[i];
        // RHS = psi - i dt/2 H psi = (1 - i diag) psi_i + i r (psi_{i+1} + psi_{i-1})
        const sumRe = psiRe[i - 1] + psiRe[i + 1];
        const sumIm = psiIm[i - 1] + psiIm[i + 1];
        rhsRe[i] = psiRe[i] + diag * psiIm[i] - r * sumIm;
        rhsIm[i] = psiIm[i] - diag * psiRe[i] + r * sumRe;
    }

    // Sub/super diagonal: a = c = +i * (-r)? Wait: (I + i dt/2 H) has off-diag -i*r, diag 1 + i*(2r + dt/2*V)
    const offIm = -r;
    for (let i = 1; i < N - 1; i++) {
        const bRe = 1.0;
        const bIm = 2 * r + 0.5 * dt * V[i];
        if (i === 1) {
            const d2 = bRe * bRe + bIm * bIm;
            // c' = (0 + i*offIm) / (bRe + i*bIm)
            cpRe[i] = (offIm * bIm) / d2;
            cpIm[i] = (offIm * bRe) / d2;
            dpRe[i] = (rhsRe[i] * bRe + rhsIm[i] * bIm) / d2;
            dpIm[i] = (rhsIm[i] * bRe - rhsRe[i] * bIm) / d2;
        } else {
            // denom = b - a * c'_{i-1}, a = (0, offIm) -> a * c' = (-offIm*cpIm, offIm*cpRe)
            const denRe = bRe + offIm * cpIm[i - 1];
            const denIm = bIm - offIm * cpRe[i - 1];
            const d2 = denRe * denRe + denIm * denIm;
            cpRe[i] = (offIm * denIm) / d2;
            cpIm[i] = (offIm * denRe) / d2;

            const numRe = rhsRe[i] + offIm * dpIm[i - 1];
            const numIm = rhsIm[i] - offIm * dpRe[i - 1];
            dpRe[i] = (numRe * denRe + numIm * denIm) / d2;
            dpIm[i] = (numIm * denRe - numRe * denIm) / d2;
        }
    }

    psiRe[N - 2] = dpRe[N - 2];
    psiIm[N - 2] = dpIm[N - 2];
    for (let i = N - 3; i >= 1; i--) {
        psiRe[i] = dpRe[i] - (cpRe[i] * psiRe[i + 1] - cpIm[i] * psiIm[i + 1]);
        psiIm[i] = dpIm[i] - (cpRe[i] * psiIm[i + 1] + cpIm[i] * psiRe[i + 1]);
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
launchPacket();
// Advance a bit so packet is already interacting with the barrier
for (let k = 0; k < 55; k++) stepCN();

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;
    const padX = 48;
    const plotW = W - padX * 2;
    const baseY = H * 0.72;
    const scaleY = H * 0.44;

    // Potential barrier V(x)
    ctx.fillStyle = "rgba(20, 32, 43, 0.14)";
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(padX, baseY);
    for (let i = 0; i < N; i++) {
        const px = padX + (i / (N - 1)) * plotW;
        const py = baseY - (V[i] / 3.6) * scaleY;
        ctx.lineTo(px, py);
    }
    ctx.lineTo(padX + plotW, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Baseline
    ctx.strokeStyle = "rgba(20, 32, 43, 0.45)";
    ctx.beginPath();
    ctx.moveTo(padX, baseY);
    ctx.lineTo(padX + plotW, baseY);
    ctx.stroke();

    // Re(psi) wave (cobalt)
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
        const px = padX + (i / (N - 1)) * plotW;
        const py = baseY - psiRe[i] * scaleY * 1.4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "rgba(29, 95, 167, 0.75)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // |psi|^2 probability density (vermilion)
    ctx.beginPath();
    ctx.moveTo(padX, baseY);
    let leftProb = 0, rightProb = 0;
    for (let i = 0; i < N; i++) {
        const p2 = psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i];
        if (i < 134) leftProb += p2;
        else rightProb += p2;
        const px = padX + (i / (N - 1)) * plotW;
        const py = baseY - p2 * scaleY * 14;
        ctx.lineTo(px, py);
    }
    ctx.lineTo(padX + plotW, baseY);
    ctx.closePath();
    ctx.fillStyle = "rgba(214, 58, 34, 0.22)";
    ctx.fill();
    ctx.strokeStyle = "#d63a22";
    ctx.lineWidth = 2.4;
    ctx.stroke();

    const norm = leftProb + rightProb;
    document.getElementById("tr-out").textContent =
        `R = ${(leftProb / norm).toFixed(2)}  T = ${(rightProb / norm).toFixed(2)}  Norm = ${norm.toFixed(4)}`;
}

function animate() {
    if (running) {
        for (let s = 0; s < 3; s++) stepCN();
        // Bounce safely if free packet hits boundary by wrapping/relaunching subtly
    }
    draw();
    requestAnimationFrame(animate);
}

document.getElementById("potential").addEventListener("change", (e) => {
    potType = e.target.value;
    launchPacket();
});
document.getElementById("v0").addEventListener("input", (e) => {
    v0 = parseFloat(e.target.value);
    document.getElementById("v0-val").textContent = v0.toFixed(1);
    buildPotential();
});
document.getElementById("k0").addEventListener("input", (e) => {
    k0 = parseFloat(e.target.value);
    document.getElementById("k0-val").textContent = k0.toFixed(1);
    launchPacket();
});
document.getElementById("launch-btn").addEventListener("click", launchPacket);
document.getElementById("toggle-btn").addEventListener("click", () => {
    running = !running;
    document.getElementById("toggle-btn").textContent = running ? "Pause" : "Resume";
});

animate();
