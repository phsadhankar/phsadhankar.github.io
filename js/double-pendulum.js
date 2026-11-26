const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let g = 9.81;
let l1 = 1.0, l2 = 1.0;
let m1 = 1.0, m2 = 1.0;
let eps = 1e-4;
let running = true;

function makePendulum(t1, t2) {
    return { t1, t2, w1: 0, w2: 0, trail: [], phase: [] };
}

let pA, pB;

function resetPendulums() {
    const base1 = Math.PI * 0.72;
    const base2 = Math.PI * 0.92;
    pA = makePendulum(base1, base2);
    pB = makePendulum(base1 + eps, base2);
}

function deriv(s) {
    const { t1, t2, w1, w2 } = s;
    const d = t1 - t2;
    const den1 = (2 * m1 + m2 - m2 * Math.cos(2 * d));
    const dw1 = (
        -g * (2 * m1 + m2) * Math.sin(t1)
        - m2 * g * Math.sin(t1 - 2 * t2)
        - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))
    ) / (l1 * den1);

    const dw2 = (
        2 * Math.sin(d) * (
            w1 * w1 * l1 * (m1 + m2)
            + g * (m1 + m2) * Math.cos(t1)
            + w2 * w2 * l2 * m2 * Math.cos(d)
        )
    ) / (l2 * den1);

    return { t1: w1, t2: w2, w1: dw1, w2: dw2 };
}

function rk4Step(p, dt) {
    const k1 = deriv(p);
    const s2 = { t1: p.t1 + 0.5 * dt * k1.t1, t2: p.t2 + 0.5 * dt * k1.t2, w1: p.w1 + 0.5 * dt * k1.w1, w2: p.w2 + 0.5 * dt * k1.w2 };
    const k2 = deriv(s2);
    const s3 = { t1: p.t1 + 0.5 * dt * k2.t1, t2: p.t2 + 0.5 * dt * k2.t2, w1: p.w1 + 0.5 * dt * k2.w1, w2: p.w2 + 0.5 * dt * k2.w2 };
    const k3 = deriv(s3);
    const s4 = { t1: p.t1 + dt * k3.t1, t2: p.t2 + dt * k3.t2, w1: p.w1 + dt * k3.w1, w2: p.w2 + dt * k3.w2 };
    const k4 = deriv(s4);

    p.t1 += (dt / 6) * (k1.t1 + 2 * k2.t1 + 2 * k3.t1 + k4.t1);
    p.t2 += (dt / 6) * (k1.t2 + 2 * k2.t2 + 2 * k3.t2 + k4.t2);
    p.w1 += (dt / 6) * (k1.w1 + 2 * k2.w1 + 2 * k3.w1 + k4.w1);
    p.w2 += (dt / 6) * (k1.w2 + 2 * k2.w2 + 2 * k3.w2 + k4.w2);
}

function wrap(a) {
    let r = (a + Math.PI) % (2 * Math.PI);
    if (r < 0) r += 2 * Math.PI;
    return r - Math.PI;
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
resetPendulums();

// Warm up slightly so trails & phase portrait have immediate structure
for (let i = 0; i < 240; i++) {
    rk4Step(pA, 0.004);
    rk4Step(pB, 0.004);
    if (i % 3 === 0) {
        pA.trail.push({ t1: pA.t1, t2: pA.t2 });
        pB.trail.push({ t1: pB.t1, t2: pB.t2 });
        pA.phase.push({ x: wrap(pA.t2), y: pA.w2 });
        pB.phase.push({ x: wrap(pB.t2), y: pB.w2 });
    }
}

function drawPendulum(p, ox, oy, pxScale, color, trailColor) {
    const x1 = ox + l1 * pxScale * Math.sin(p.t1);
    const y1 = oy + l1 * pxScale * Math.cos(p.t1);
    const x2 = x1 + l2 * pxScale * Math.sin(p.t2);
    const y2 = y1 + l2 * pxScale * Math.cos(p.t2);

    if (p.trail.length > 1) {
        ctx.beginPath();
        p.trail.forEach((pt, idx) => {
            const tx = ox + pxScale * (l1 * Math.sin(pt.t1) + l2 * Math.sin(pt.t2));
            const ty = oy + pxScale * (l1 * Math.cos(pt.t1) + l2 * Math.cos(pt.t2));
            if (idx === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
        });
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x1, y1, 5, 0, Math.PI * 2);
    ctx.arc(x2, y2, 6 + m2 * 1.5, 0, Math.PI * 2);
    ctx.fill();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;
    const splitX = W * 0.54;

    // Left: physical space
    const ox = splitX * 0.5;
    const oy = H * 0.42;
    const pxScale = Math.min(splitX, H) * 0.21;

    ctx.fillStyle = "#14202b";
    ctx.beginPath();
    ctx.arc(ox, oy, 4, 0, Math.PI * 2);
    ctx.fill();

    drawPendulum(pB, ox, oy, pxScale, "#d63a22", "rgba(214, 58, 34, 0.35)");
    drawPendulum(pA, ox, oy, pxScale, "#14202b", "rgba(20, 32, 43, 0.4)");

    // Right: Phase portrait (θ₂, ω₂)
    const px = splitX + 16;
    const py = 28;
    const pw = W - px - 28;
    const ph = H - 56;

    ctx.fillStyle = "rgba(239, 244, 230, 0.72)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);

    const cx = px + pw * 0.5;
    const cy = py + ph * 0.5;
    ctx.strokeStyle = "rgba(20, 32, 43, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(px + pw, cy);
    ctx.moveTo(cx, py);
    ctx.lineTo(cx, py + ph);
    ctx.stroke();

    const drawPhase = (pts, col) => {
        ctx.fillStyle = col;
        for (let i = 0; i < pts.length; i++) {
            const x = cx + (pts[i].x / Math.PI) * (pw * 0.46);
            const y = cy - (pts[i].y / 14) * (ph * 0.44);
            if (y >= py && y <= py + ph) ctx.fillRect(x - 1, y - 1, 2.2, 2.2);
        }
    };
    drawPhase(pA.phase, "rgba(20, 32, 43, 0.7)");
    drawPhase(pB.phase, "rgba(214, 58, 34, 0.72)");

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText("PHASE PORTRAIT  (θ₂ mod 2π, ω₂)", px + 12, py + 22);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("■ Primary   ", px + 12, py + ph - 12);
    ctx.fillStyle = "#d63a22";
    ctx.fillText("■ Perturbed (+δθ₁)", px + 98, py + ph - 12);
}

function animate() {
    if (running) {
        for (let s = 0; s < 5; s++) rk4Step(pA, 0.003);
        for (let s = 0; s < 5; s++) rk4Step(pB, 0.003);

        pA.trail.push({ t1: pA.t1, t2: pA.t2 });
        pB.trail.push({ t1: pB.t1, t2: pB.t2 });
        if (pA.trail.length > 260) pA.trail.shift();
        if (pB.trail.length > 260) pB.trail.shift();

        pA.phase.push({ x: wrap(pA.t2), y: pA.w2 });
        pB.phase.push({ x: wrap(pB.t2), y: pB.w2 });
        if (pA.phase.length > 1400) pA.phase.shift();
        if (pB.phase.length > 1400) pB.phase.shift();

        const diff = Math.hypot(pA.t1 - pB.t1, pA.t2 - pB.t2);
        document.getElementById("stats-out").textContent = `|Δθ| = ${diff.toFixed(4)} rad`;
    }
    draw();
    requestAnimationFrame(animate);
}

document.getElementById("eps").addEventListener("input", (e) => {
    const exp = parseInt(e.target.value);
    eps = Math.pow(10, exp);
    document.getElementById("eps-val").textContent = `1e${exp}`;
    resetPendulums();
});

document.getElementById("mass").addEventListener("input", (e) => {
    m2 = parseFloat(e.target.value);
    document.getElementById("mass-val").textContent = m2.toFixed(1);
});

document.getElementById("reset-btn").addEventListener("click", resetPendulums);
document.getElementById("toggle-btn").addEventListener("click", () => {
    running = !running;
    document.getElementById("toggle-btn").textContent = running ? "Pause" : "Resume";
});

animate();
