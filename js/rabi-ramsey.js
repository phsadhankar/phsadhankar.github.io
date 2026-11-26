const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let omega = 1.8;
let delta = 0.6;
let gamma = 0.08;

let rx = 0, ry = 0, rz = 1;
let simT = 0;
let sphereTrail = [];
let traceP1 = [];

let yaw = 0.62;
let pitch = 0.34;
let dragging = false;
let lastX = 0, lastY = 0;

function resetBloch() {
    rx = 0; ry = 0; rz = 1;
    simT = 0;
    sphereTrail = [{ x: rx, y: ry, z: rz }];
    traceP1 = [{ t: 0, p: 0 }];
}

// RK4 optical Bloch equations: dr/dt = (omega, 0, delta) x r - gamma*(rx, ry, 0) - (gamma*0.35)*(rz - 1)? Wait: pure dephasing T2 damps rx, ry -> 0!
function deriv(x, y, z) {
    // Omega_eff = (omega, 0, delta)
    // Omega x r = (0*z - delta*y, delta*x - omega*z, omega*y - 0*x)
    return [
        -delta * y - gamma * x,
        delta * x - omega * z - gamma * y,
        omega * y - (gamma * 0.25) * (z - 0),
    ];
}

function stepBloch(dt) {
    const k1 = deriv(rx, ry, rz);
    const k2 = deriv(rx + 0.5 * dt * k1[0], ry + 0.5 * dt * k1[1], rz + 0.5 * dt * k1[2]);
    const k3 = deriv(rx + 0.5 * dt * k2[0], ry + 0.5 * dt * k2[1], rz + 0.5 * dt * k2[2]);
    const k4 = deriv(rx + dt * k3[0], ry + dt * k3[1], rz + dt * k3[2]);

    rx += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    ry += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    rz += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    simT += dt;

    sphereTrail.push({ x: rx, y: ry, z: rz });
    if (sphereTrail.length > 260) sphereTrail.shift();

    traceP1.push({ t: simT, p: (1 - rz) * 0.5 });
    if (traceP1.length > 220) traceP1.shift();
}

function proj(x, y, z, cx, cy, R) {
    const x1 = x * Math.cos(yaw) - y * Math.sin(yaw);
    const y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
    const z2 = y1 * Math.sin(pitch) + z * Math.cos(pitch);
    return { sx: cx + x1 * R, sy: cy - z2 * R };
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

resetBloch();
// Warmup a bit so the decaying spiral + oscillation trace are vivid immediately
for (let i = 0; i < 130; i++) stepBloch(0.045);

function draw() {
    for (let s = 0; s < 2; s++) stepBloch(0.025);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;
    const embedded = document.documentElement.classList.contains("embed") || document.documentElement.classList.contains("panels-hidden");
    const topY = embedded || H < 680 ? 44 : 244;

    // Left: 3D Bloch precession frame
    const splitX = W * 0.45;
    const cx = splitX * 0.52;
    const cy = topY + (H - topY - 26) * 0.5;
    const R = Math.min(splitX * 0.36, (H - topY - 40) * 0.4);

    ctx.fillStyle = "rgba(239, 244, 230, 0.6)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Equator + prime meridian
    const loop = (fn, col) => {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
            const t = (i / 64) * Math.PI * 2;
            const [x, y, z] = fn(t);
            const p = proj(x, y, z, cx, cy, R);
            if (i === 0) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.stroke();
    };
    loop((t) => [Math.cos(t), Math.sin(t), 0], "rgba(20, 32, 43, 0.3)");
    loop((t) => [Math.cos(t), 0, Math.sin(t)], "rgba(20, 32, 43, 0.18)");

    // Axis |0>, |1>
    const nPole = proj(0, 0, 1, cx, cy, R);
    const sPole = proj(0, 0, -1, cx, cy, R);
    ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(nPole.sx, nPole.sy);
    ctx.lineTo(sPole.sx, sPole.sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#14202b";
    ctx.font = "600 10.5px 'Martian Mono', monospace";
    ctx.fillText("|0⟩", nPole.sx - 10, nPole.sy - 8);
    ctx.fillText("|1⟩", sPole.sx - 10, sPole.sy + 15);

    // Torque vector Omega_eff = (omega, 0, delta)
    const omMag = Math.hypot(omega, delta) || 1;
    const tor = proj(omega / omMag, 0, delta / omMag, cx, cy, R * 0.92);
    ctx.strokeStyle = "#1d5fa7";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tor.sx, tor.sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#1d5fa7";
    ctx.fillText("Ω_eff", tor.sx + 6, tor.sy);

    // Trail on/inside sphere
    if (sphereTrail.length > 1) {
        ctx.beginPath();
        sphereTrail.forEach((pt, idx) => {
            const p = proj(pt.x, pt.y, pt.z, cx, cy, R);
            if (idx === 0) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
        });
        ctx.strokeStyle = "rgba(214, 58, 34, 0.65)";
        ctx.lineWidth = 1.8;
        ctx.stroke();
    }

    // Current Bloch vector
    const cur = proj(rx, ry, rz, cx, cy, R);
    ctx.strokeStyle = "#d63a22";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cur.sx, cur.sy);
    ctx.stroke();
    ctx.fillStyle = "#d63a22";
    ctx.beginPath();
    ctx.arc(cur.sx, cur.sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Right pane: Live Rabi oscillation waveform + Resonance Lorentzian peak
    const rx0 = splitX + 12, ry0 = topY, rw = W - rx0 - 34, rh = H - topY - 28;
    ctx.fillStyle = "rgba(239, 244, 230, 0.8)";
    ctx.fillRect(rx0, ry0, rw, rh);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx0, ry0, rw, rh);

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText("EXCITED STATE POPULATION  P(|1⟩, t)", rx0 + 14, ry0 + 22);

    const gx = rx0 + 38, gy = ry0 + 44, gw = rw - 56, gh = rh * 0.45;
    ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + gh);
    ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();

    // Analytical envelope upper bound Omega^2 / (Omega^2 + Delta^2)
    const maxAmp = (omega * omega) / (omega * omega + delta * delta);
    const ampY = gy + gh * (1 - maxAmp);
    ctx.strokeStyle = "rgba(29, 95, 167, 0.55)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(gx, ampY);
    ctx.lineTo(gx + gw, ampY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (traceP1.length > 1) {
        ctx.beginPath();
        traceP1.forEach((pt, i) => {
            const x = gx + (i / (traceP1.length - 1)) * gw;
            const y = gy + gh * (1 - Math.max(0, Math.min(1, pt.p)));
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "#d63a22";
        ctx.lineWidth = 2.2;
        ctx.stroke();
    }

    // Bottom of right pane: Resonance profile vs Detuning
    const ly = gy + gh + 36, lh = Math.max(40, ry0 + rh - ly - 24);
    ctx.fillStyle = "#14202b";
    ctx.font = "600 10.5px 'Martian Mono', monospace";
    ctx.fillText("RABI RESONANCE MAX AMPLITUDE VS DETUNING Δ", rx0 + 14, ly);

    ctx.beginPath();
    for (let k = 0; k <= 80; k++) {
        const dTest = -2.5 + (k / 80) * 5.0;
        const rAmp = (omega * omega) / (omega * omega + dTest * dTest);
        const x = gx + (k / 80) * gw;
        const y = ly + lh - rAmp * (lh - 22);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#1d5fa7";
    ctx.lineWidth = 2;
    ctx.stroke();

    const curDX = gx + ((delta + 2.5) / 5.0) * gw;
    const curDY = ly + lh - maxAmp * (lh - 22);
    ctx.fillStyle = "#d63a22";
    ctx.beginPath();
    ctx.arc(curDX, curDY, 5, 0, Math.PI * 2);
    ctx.fill();

    const p1 = ((1 - rz) * 0.5).toFixed(3);
    const pur = Math.hypot(rx, ry, rz).toFixed(3);
    document.getElementById("rabi-out").textContent =
        `P(|1⟩) = ${p1} · Purity |r| = ${pur} · Ω_eff = ${omMag.toFixed(2)}`;

    if (!dragging) yaw += 0.0015;
    requestAnimationFrame(draw);
}

canvas.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("mouseup", () => (dragging = false));
canvas.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - lastY) * 0.008));
    lastX = e.clientX; lastY = e.clientY;
});

document.getElementById("omega").addEventListener("input", (e) => {
    omega = parseFloat(e.target.value);
    document.getElementById("om-val").textContent = omega.toFixed(1);
});
document.getElementById("delta").addEventListener("input", (e) => {
    delta = parseFloat(e.target.value);
    document.getElementById("del-val").textContent = delta.toFixed(1);
});
document.getElementById("gamma").addEventListener("input", (e) => {
    gamma = parseFloat(e.target.value);
    document.getElementById("gam-val").textContent = gamma.toFixed(2);
});
document.getElementById("reset-btn").addEventListener("click", resetBloch);
document.getElementById("pi-btn").addEventListener("click", () => {
    delta = 0;
    document.getElementById("delta").value = "0";
    document.getElementById("del-val").textContent = "0.0";
});

draw();
