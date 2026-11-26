const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let customHandle = { u: 0.42, v: 0.85 }; // normalized handle inside box
let dragging = false;
let tautochrone = false;
let simTime = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// Solve R*(thetaEnd - sin(thetaEnd)) / (R*(1 - cos(thetaEnd))) = W/H
// For a clean 1.75:1 aspect descent, thetaEnd ≈ 2.412 rad
const THETA_END = 2.412;

function getBox() {
    const padX = Math.max(70, canvas.width * 0.14);
    const padY = Math.max(85, canvas.height * 0.18);
    const h = canvas.height - padY * 2;
    const ratio = (THETA_END - Math.sin(THETA_END)) / (1 - Math.cos(THETA_END));
    const w = Math.min(canvas.width - padX * 2, h * ratio);
    const x0 = (canvas.width - w) * 0.5;
    const y0 = padY;
    return { x0, y0, w, h };
}

function buildCurve(pointsFn, steps = 240) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        pts.push(pointsFn(i / steps));
    }
    // Precompute arc-length & cumulative travel time assuming v = sqrt(2 * g * dy)
    const g = 9.81;
    let totalT = 0;
    const table = [{ s: 0, t: 0, x: pts[0].x, y: pts[0].y }];
    for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x;
        const dy = pts[i].y - pts[i - 1].y;
        const ds = Math.hypot(dx, dy);
        const yMid = Math.max(1e-4, ((pts[i].y + pts[i - 1].y) * 0.5 - pts[0].y) / 180);
        const v = Math.sqrt(2 * g * yMid);
        totalT += (ds / 180) / Math.max(0.05, v);
        table.push({ s: i, t: totalT, x: pts[i].x, y: pts[i].y });
    }
    return { pts, table, totalT };
}

function sampleAtTime(curve, t) {
    if (t >= curve.totalT) return curve.pts[curve.pts.length - 1];
    for (let i = 1; i < curve.table.length; i++) {
        if (curve.table[i].t >= t) {
            const a = curve.table[i - 1];
            const b = curve.table[i];
            const f = (t - a.t) / (b.t - a.t || 1);
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }
    }
    return curve.pts[0];
}

function getCurves() {
    const { x0, y0, w, h } = getBox();
    const R = h / (1 - Math.cos(THETA_END));

    const cycloid = buildCurve((u) => {
        const th = u * THETA_END;
        return { x: x0 + R * (th - Math.sin(th)), y: y0 + R * (1 - Math.cos(th)) };
    });

    const line = buildCurve((u) => ({
        x: x0 + u * w,
        y: y0 + u * h,
    }));

    const parabola = buildCurve((u) => ({
        x: x0 + u * w,
        y: y0 + h * (2 * u - u * u),
    }));

    const hx = x0 + customHandle.u * w;
    const hy = y0 + customHandle.v * h;
    const custom = buildCurve((u) => ({
        x: (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * hx + u * u * (x0 + w),
        y: (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * hy + u * u * (y0 + h),
    }));

    return { cycloid, line, parabola, custom, hx, hy, x0, y0, w, h };
}

function replay() {
    simTime = 0;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { cycloid, line, parabola, custom, hx, hy, x0, y0, w, h } = getCurves();

    const drawPath = (pts, color, width, dash = []) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
        ctx.setLineDash([]);
    };

    if (!tautochrone) {
        drawPath(line.pts, "rgba(20, 32, 43, 0.45)", 1.8, [6, 4]);
        drawPath(parabola.pts, "#1d5fa7", 2.2);
        drawPath(custom.pts, "#9a5b13", 2.2);
        drawPath(cycloid.pts, "#d63a22", 3);

        // Draggable handle
        ctx.strokeStyle = "rgba(154, 91, 19, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(hx, hy);
        ctx.lineTo(x0 + w, y0 + h);
        ctx.stroke();

        ctx.fillStyle = "#eff4e6";
        ctx.strokeStyle = "#9a5b13";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const maxT = Math.max(line.totalT, parabola.totalT, custom.totalT, cycloid.totalT);
        const t = simTime % (maxT + 0.8);

        const entries = [
            ["Cycloid", cycloid, "#d63a22"],
            ["Parabola", parabola, "#1d5fa7"],
            ["Custom", custom, "#9a5b13"],
            ["Straight", line, "#14202b"],
        ];

        entries.forEach(([, c, col]) => {
            const pos = sampleAtTime(c, t);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#eff4e6";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        document.getElementById("times-out").innerHTML = entries
            .map(([name, c]) => `${name.padEnd(9, " ")}: ${c.totalT.toFixed(3)} s`)
            .join("<br />");
    } else {
        // Full half-cycloid to the lowest point theta = pi -> tautochrone!
        const R = h / 2;
        const pts = [];
        for (let i = 0; i <= 200; i++) {
            const th = (i / 200) * Math.PI;
            pts.push({ x: x0 + R * (th - Math.sin(th)), y: y0 + R * (1 - Math.cos(th)) });
        }
        drawPath(pts, "#d63a22", 3);

        // Simple harmonic motion in theta along a cycloid gives identical period T = pi * sqrt(R / g)
        const omega = Math.sqrt(9.81 / (R / 180));
        const period = Math.PI / (2 * omega);
        const t = Math.min(period, simTime % (period + 0.7));

        [0.08, 0.35, 0.68, 1.05].forEach((th0, idx) => {
            // Parameterize along cycloid: cos(th/2) = cos(th0/2) * cos(omega*t / sqrt(...) ) -> exact SHM in s = 4R cos(th/2)!
            const s = Math.cos(th0 / 2) * Math.cos(0.5 * omega * t);
            const th = 2 * Math.acos(Math.max(-1, Math.min(1, s)));
            const bx = x0 + R * (th - Math.sin(th));
            const by = y0 + R * (1 - Math.cos(th));
            const cols = ["#d63a22", "#1d5fa7", "#9a5b13", "#14202b"];
            ctx.fillStyle = cols[idx];
            ctx.beginPath();
            ctx.arc(bx, by, 7, 0, Math.PI * 2);
            ctx.fill();
        });

        document.getElementById("times-out").innerHTML =
            `Tautochrone: all 4 heights<br />reach bottom at t = ${(Math.PI / omega).toFixed(3)} s`;
    }

    // Endpoints A and B
    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText("A", x0 - 16, y0 + 4);
    ctx.fillText("B", x0 + w + 8, y0 + h + 4);
}

let last = performance.now();
function animate(now) {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    simTime += dt;
    draw();
    requestAnimationFrame(animate);
}

canvas.addEventListener("mousedown", (e) => {
    if (tautochrone) return;
    const { hx, hy } = getCurves();
    if (Math.hypot(e.clientX - hx, e.clientY - hy) < 22) dragging = true;
});
canvas.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const { x0, y0, w, h } = getBox();
    customHandle.u = Math.max(0.05, Math.min(0.95, (e.clientX - x0) / w));
    customHandle.v = Math.max(0.05, Math.min(1.25, (e.clientY - y0) / h));
});
window.addEventListener("mouseup", () => (dragging = false));

document.getElementById("race-btn").addEventListener("click", replay);
document.getElementById("taut-btn").addEventListener("click", () => {
    tautochrone = !tautochrone;
    document.getElementById("taut-btn").textContent = tautochrone ? "Brachistochrone Mode" : "Tautochrone Mode";
    replay();
});

requestAnimationFrame(animate);
