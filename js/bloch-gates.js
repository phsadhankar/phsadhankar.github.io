const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const SQRT1_2 = Math.SQRT1_2;
const c = (re, im = 0) => ({ re, im });
const cAdd = (a, b) => c(a.re + b.re, a.im + b.im);
const cMul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cAbs2 = (a) => a.re * a.re + a.im * a.im;

function rotMatrix(nx, ny, nz, theta) {
    const ch = Math.cos(theta / 2);
    const sh = Math.sin(theta / 2);
    return [
        [c(ch, -nz * sh), c(-ny * sh, -nx * sh)],
        [c(ny * sh, -nx * sh), c(ch, nz * sh)],
    ];
}

const GATES = {
    H: [[c(SQRT1_2), c(SQRT1_2)], [c(SQRT1_2), c(-SQRT1_2)]],
    X: [[c(0), c(1)], [c(1), c(0)]],
    Y: [[c(0), c(0, -1)], [c(0, 1), c(0)]],
    Z: [[c(1), c(0)], [c(0), c(-1)]],
    S: [[c(1), c(0)], [c(0), c(0, 1)]],
    T: [[c(1), c(0)], [c(0), c(SQRT1_2, SQRT1_2)]],
    Rx: rotMatrix(1, 0, 0, Math.PI / 4),
    Ry: rotMatrix(0, 1, 0, Math.PI / 4),
};

function applyGate(state, U) {
    return [
        cAdd(cMul(U[0][0], state[0]), cMul(U[0][1], state[1])),
        cAdd(cMul(U[1][0], state[0]), cMul(U[1][1], state[1])),
    ];
}

function stateToBloch(state) {
    const [a, b] = state;
    // x = 2 Re(a* b), y = 2 Im(a* b), z = |a|^2 - |b|^2
    const abRe = a.re * b.re + a.im * b.im;
    const abIm = a.re * b.im - a.im * b.re;
    return { x: 2 * abRe, y: 2 * abIm, z: cAbs2(a) - cAbs2(b) };
}

let circuit = ["H", "T", "H", "S"];
let yaw = 0.55;
let pitch = 0.32;
let dragging = false;
let lastX = 0, lastY = 0;

// Smooth display vector interpolated toward target
let dispVec = { x: 0, y: 0, z: 1 };
let trail = [];

function evaluateCircuit() {
    let st = [c(1, 0), c(0, 0)];
    const pts = [stateToBloch(st)];
    for (const g of circuit) {
        st = applyGate(st, GATES[g]);
        pts.push(stateToBloch(st));
    }
    return { st, pts };
}

function optimizeCircuit() {
    let changed = true;
    let list = [...circuit];
    while (changed) {
        changed = false;
        for (let i = 0; i < list.length - 1; i++) {
            const a = list[i], b = list[i + 1];
            if (a === b && ["H", "X", "Y", "Z"].includes(a)) {
                list.splice(i, 2);
                changed = true;
                break;
            }
            if (a === "S" && b === "S") { list.splice(i, 2, "Z"); changed = true; break; }
            if (a === "T" && b === "T") { list.splice(i, 2, "S"); changed = true; break; }
            if (i + 2 < list.length && a === "H" && list[i + 2] === "H") {
                if (b === "Z") { list.splice(i, 3, "X"); changed = true; break; }
                if (b === "X") { list.splice(i, 3, "Z"); changed = true; break; }
            }
        }
    }
    circuit = list;
    syncHistory();
}

function syncHistory() {
    const { st, pts } = evaluateCircuit();
    trail = pts;
    const target = pts[pts.length - 1];
    dispVec = { ...target };

    const p0 = (cAbs2(st[0]) * 100).toFixed(1);
    const p1 = (cAbs2(st[1]) * 100).toFixed(1);
    const fmt = (z) => `${z.re.toFixed(2)}${z.im >= 0 ? "+" : "−"}${Math.abs(z.im).toFixed(2)}i`;
    document.getElementById("state-out").innerHTML =
        `|ψ⟩ = (${fmt(st[0])})|0⟩ + (${fmt(st[1])})|1⟩<br />P(0) = ${p0}%   P(1) = ${p1}%`;
}

function proj(x, y, z, cx, cy, R) {
    // Rotate around Z (yaw), then X (pitch); Bloch +Z is up on screen
    const x1 = x * Math.cos(yaw) - y * Math.sin(yaw);
    const y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
    const z1 = z;

    const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);

    return { sx: cx + x1 * R, sy: cy - z2 * R, depth: y2 };
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
syncHistory();

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;
    const cx = W * 0.48;
    const cy = H * 0.46;
    const R = Math.min(W, H) * 0.27;

    // Outer circle
    ctx.fillStyle = "rgba(239, 244, 230, 0.55)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Wireframe meridians & equator
    ctx.lineWidth = 1;
    const drawLoop = (fn, style) => {
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
            const t = (i / 72) * Math.PI * 2;
            const [x, y, z] = fn(t);
            const p = proj(x, y, z, cx, cy, R);
            if (i === 0) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
        }
        ctx.strokeStyle = style;
        ctx.stroke();
    };
    drawLoop((t) => [Math.cos(t), Math.sin(t), 0], "rgba(20, 32, 43, 0.35)");
    drawLoop((t) => [Math.cos(t), 0, Math.sin(t)], "rgba(20, 32, 43, 0.2)");
    drawLoop((t) => [0, Math.cos(t), Math.sin(t)], "rgba(20, 32, 43, 0.2)");

    // Axes & basis labels
    const axes = [
        [[0, 0, 1], "|0⟩"],
        [[0, 0, -1], "|1⟩"],
        [[1, 0, 0], "|+⟩"],
        [[-1, 0, 0], "|−⟩"],
        [[0, 1, 0], "|i⟩"],
        [[0, -1, 0], "|−i⟩"],
    ];
    ctx.font = "600 11px 'Martian Mono', monospace";
    for (let i = 0; i < 6; i += 2) {
        const a = proj(...axes[i][0], cx, cy, R);
        const b = proj(...axes[i + 1][0], cx, cy, R);
        ctx.strokeStyle = "rgba(20, 32, 43, 0.45)";
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    axes.forEach(([v, lbl]) => {
        const p = proj(v[0] * 1.13, v[1] * 1.13, v[2] * 1.13, cx, cy, R);
        ctx.fillStyle = "#14202b";
        ctx.fillText(lbl, p.sx - 10, p.sy + 4);
    });

    // Trail along geodesic segments between gate steps
    if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
            const A = trail[i - 1], B = trail[i];
            ctx.beginPath();
            for (let k = 0; k <= 18; k++) {
                const f = k / 18;
                let vx = A.x * (1 - f) + B.x * f;
                let vy = A.y * (1 - f) + B.y * f;
                let vz = A.z * (1 - f) + B.z * f;
                const n = Math.hypot(vx, vy, vz) || 1;
                const p = proj(vx / n, vy / n, vz / n, cx, cy, R);
                if (k === 0) ctx.moveTo(p.sx, p.sy);
                else ctx.lineTo(p.sx, p.sy);
            }
            ctx.strokeStyle = "#1d5fa7";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // Current state vector
    const { st } = evaluateCircuit();
    const target = stateToBloch(st);
    dispVec.x += (target.x - dispVec.x) * 0.2;
    dispVec.y += (target.y - dispVec.y) * 0.2;
    dispVec.z += (target.z - dispVec.z) * 0.2;

    const tip = proj(dispVec.x, dispVec.y, dispVec.z, cx, cy, R);
    ctx.strokeStyle = "#d63a22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tip.sx, tip.sy);
    ctx.stroke();

    ctx.fillStyle = "#d63a22";
    ctx.beginPath();
    ctx.arc(tip.sx, tip.sy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Circuit tape along bottom
    const tapeY = H - 58;
    const tapeX0 = Math.max(40, cx - 260);
    const tapeW = Math.min(W - 80, 520);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tapeX0, tapeY);
    ctx.lineTo(tapeX0 + tapeW, tapeY);
    ctx.stroke();

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText("|0⟩", tapeX0 - 28, tapeY + 4);

    circuit.forEach((g, idx) => {
        const gx = tapeX0 + 26 + idx * 42;
        if (gx + 26 > tapeX0 + tapeW) return;
        ctx.fillStyle = "#eff4e6";
        ctx.fillRect(gx - 15, tapeY - 15, 30, 30);
        ctx.strokeStyle = idx === circuit.length - 1 ? "#d63a22" : "#14202b";
        ctx.lineWidth = idx === circuit.length - 1 ? 2 : 1.3;
        ctx.strokeRect(gx - 15, tapeY - 15, 30, 30);
        ctx.fillStyle = "#14202b";
        ctx.fillText(g, gx - g.length * 3.5, tapeY + 4);
    });

    if (!dragging) yaw += 0.002;
    requestAnimationFrame(draw);
}

canvas.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("mouseup", () => (dragging = false));
canvas.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - lastY) * 0.008));
    lastX = e.clientX;
    lastY = e.clientY;
});

document.querySelectorAll(".gate-btn").forEach((b) => {
    b.addEventListener("click", () => {
        if (circuit.length >= 11) circuit.shift();
        circuit.push(b.dataset.gate);
        syncHistory();
    });
});
document.getElementById("opt-btn").addEventListener("click", optimizeCircuit);
document.getElementById("undo-btn").addEventListener("click", () => { circuit.pop(); syncHistory(); });
document.getElementById("reset-btn").addEventListener("click", () => { circuit = []; syncHistory(); });

draw();
