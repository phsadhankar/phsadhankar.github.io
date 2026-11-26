const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let nQubits = 3;
let N = 8;
let target = 5;
let amps = [];
let iter = 0;

function resetState() {
    N = 1 << nQubits;
    if (target >= N) target = N - 1;
    amps = new Array(N).fill(1 / Math.sqrt(N));
    iter = 0;
    updateReadout();
}

function groverStep() {
    // 1. Oracle U_w: flip sign of target
    amps[target] = -amps[target];
    // 2. Diffuser U_s: 2*mean - amp
    const mean = amps.reduce((a, b) => a + b, 0) / N;
    for (let i = 0; i < N; i++) amps[i] = 2 * mean - amps[i];
    iter++;
    updateReadout();
}

function updateReadout() {
    const kOpt = Math.floor((Math.PI / 4) * Math.sqrt(N));
    const pw = (amps[target] * amps[target] * 100).toFixed(1);
    document.getElementById("n-val").textContent = nQubits;
    document.getElementById("N-val").textContent = N;
    document.getElementById("grover-out").textContent =
        `Iter ${iter} / k_opt=${kOpt} · P(|${target.toString(2).padStart(nQubits, "0")}⟩) = ${pw}%`;
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
resetState();
// Start 2 iterations in for 3 qubits so the amplification contrast is clear
groverStep();
groverStep();

let barRegions = [];

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;
    const splitX = W * 0.44;

    // Left: 2D subspace (|s'>, |w>)
    const gx = 32;
    const gy = 54;
    const gw = splitX - 52;
    const gh = H - 108;
    const cx = gx + gw * 0.46;
    const cy = gy + gh * 0.56;
    const R = Math.min(gw, gh) * 0.36;

    ctx.fillStyle = "rgba(239, 244, 230, 0.72)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.strokeStyle = "rgba(20, 32, 43, 0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Axes |s'> horizontal, |w> vertical
    ctx.strokeStyle = "#14202b";
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.15, cy);
    ctx.lineTo(cx + R * 1.15, cy);
    ctx.moveTo(cx, cy + R * 1.15);
    ctx.lineTo(cx, cy - R * 1.15);
    ctx.stroke();

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText("|s'⟩", cx + R * 1.05, cy - 8);
    ctx.fillStyle = "#d63a22";
    ctx.fillText(`|w⟩ = |${target.toString(2).padStart(nQubits, "0")}⟩`, cx + 8, cy - R * 1.05);

    // Compute projection onto (|s'>, |w>)
    const wAmp = amps[target];
    let sPrimeAmp = 0;
    for (let i = 0; i < N; i++) {
        if (i !== target) sPrimeAmp += amps[i];
    }
    sPrimeAmp /= Math.sqrt(N - 1);

    // Initial |s> angle
    const th0 = Math.asin(1 / Math.sqrt(N));
    ctx.strokeStyle = "rgba(29, 95, 167, 0.55)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(th0) * R, cy - Math.sin(th0) * R);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current state vector
    const vx = cx + sPrimeAmp * R;
    const vy = cy - wAmp * R;
    ctx.strokeStyle = "#d63a22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(vx, vy);
    ctx.stroke();

    ctx.fillStyle = "#d63a22";
    ctx.beginPath();
    ctx.arc(vx, vy, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#14202b";
    ctx.fillText("SUBSPACE ROTATION (|s'⟩, |w⟩)", gx + 12, gy + 22);

    // Right: Amplitude bar chart
    const rx = splitX + 10;
    const rw = W - rx - 32;
    const ry = 54;
    const rh = H - 108;

    ctx.fillStyle = "rgba(239, 244, 230, 0.72)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);

    const zeroY = ry + rh * 0.62;
    const ampScale = rh * 0.45;

    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, zeroY);
    ctx.lineTo(rx + rw, zeroY);
    ctx.stroke();

    // Mean line
    const mean = amps.reduce((a, b) => a + b, 0) / N;
    const meanY = zeroY - mean * ampScale;
    ctx.strokeStyle = "#1d5fa7";
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(rx + 12, meanY);
    ctx.lineTo(rx + rw - 12, meanY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#1d5fa7";
    ctx.fillText(`mean = ${mean.toFixed(3)}`, rx + rw - 120, meanY - 6);

    barRegions = [];
    const innerW = rw - 40;
    const slotW = innerW / N;
    const barW = Math.max(10, slotW * 0.64);

    for (let i = 0; i < N; i++) {
        const bx = rx + 20 + i * slotW + (slotW - barW) * 0.5;
        const bh = amps[i] * ampScale;
        const isW = i === target;

        ctx.fillStyle = isW ? "#d63a22" : "rgba(20, 32, 43, 0.82)";
        if (bh >= 0) ctx.fillRect(bx, zeroY - bh, barW, bh);
        else ctx.fillRect(bx, zeroY, barW, -bh);

        barRegions.push({ i, x: rx + 20 + i * slotW, w: slotW, y: ry, h: rh });

        if (N <= 16) {
            ctx.fillStyle = isW ? "#d63a22" : "#14202b";
            ctx.font = "10px 'Martian Mono', monospace";
            const lbl = i.toString(2).padStart(nQubits, "0");
            ctx.fillText(lbl, bx + barW * 0.5 - lbl.length * 3, ry + rh - 14);
        }
    }

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText("STATEVECTOR AMPLITUDES αₓ", rx + 12, ry + 22);
    requestAnimationFrame(draw);
}

canvas.addEventListener("click", (e) => {
    const hit = barRegions.find((r) => e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h);
    if (hit) {
        target = hit.i;
        resetState();
    }
});

document.getElementById("n-slider").addEventListener("input", (e) => {
    nQubits = parseInt(e.target.value);
    resetState();
});
document.getElementById("step-btn").addEventListener("click", groverStep);
document.getElementById("auto-btn").addEventListener("click", () => {
    resetState();
    const kOpt = Math.floor((Math.PI / 4) * Math.sqrt(N));
    for (let i = 0; i < kOpt; i++) groverStep();
});
document.getElementById("reset-btn").addEventListener("click", resetState);

draw();
