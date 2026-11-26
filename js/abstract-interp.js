const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let progId = "rot";
let domId = "oct";
let widenDelay = 2;
let hazardOffset = 0;

// Continuous concrete particle trajectories in phase space [-5, 5]^2
let particles = [];
let simTime = 0;

// Abstract fixpoint sequence frames (each step is a convex polygon in world coordinates)
let absSteps = [];
let absPhase = 0; // animates smoothly through Kleene / widening / narrowing stages
let fixTick = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function getProgram() {
    if (progId === "rot") {
        // Matrix slightly contractive rotation with source box init
        const ang = 0.42;
        const r = 0.945;
        return {
            name: "Damped Rotation",
            initBox: [
                { x: 1.4, y: -0.45 },
                { x: 2.2, y: -0.45 },
                { x: 2.2, y: 0.45 },
                { x: 1.4, y: 0.45 },
            ],
            step: (x, y) => [
                r * (Math.cos(ang) * x - Math.sin(ang) * y),
                r * (Math.sin(ang) * x + Math.cos(ang) * y),
            ],
            hazard: { x: 2.02 - hazardOffset * 0.22, y: 1.98 - hazardOffset * 0.22, w: 1.1, h: 1.1 },
        };
    }
    if (progId === "skew") {
        return {
            name: "Skewed Contractor",
            initBox: [
                { x: -1.8, y: 1.1 },
                { x: -0.9, y: 1.1 },
                { x: -0.9, y: 1.9 },
                { x: -1.8, y: 1.9 },
            ],
            step: (x, y) => [0.92 * x + 0.34 * y, -0.26 * x + 0.91 * y],
            hazard: { x: 2.15 - hazardOffset * 0.3, y: -2.1 + hazardOffset * 0.3, w: 1.25, h: 1.1 },
        };
    }
    return {
        name: "Shear Orbit",
        initBox: [
            { x: 0.7, y: 1.5 },
            { x: 1.5, y: 1.5 },
            { x: 1.5, y: 2.2 },
            { x: 0.7, y: 2.2 },
        ],
        step: (x, y) => [0.89 * x - 0.36 * y, 0.32 * x + 0.94 * y],
        hazard: { x: -2.75 + hazardOffset * 0.3, y: -2.35 + hazardOffset * 0.3, w: 1.2, h: 1.2 },
    };
}

// Compute polygon over-approximation according to domain directions
function domainDirections() {
    if (domId === "box") {
        return [
            [1, 0], [0, 1], [-1, 0], [0, -1],
        ];
    }
    if (domId === "oct") {
        const s = Math.SQRT1_2;
        return [
            [1, 0], [s, s], [0, 1], [-s, s], [-1, 0], [-s, -s], [0, -1], [s, -s],
        ];
    }
    const dirs = [];
    for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        dirs.push([Math.cos(a), Math.sin(a)]);
    }
    return dirs;
}

// Given template directions, build halfspace constraints nx*x + ny*y <= b and convert back to sorted hull vertices
function halfspacesToPoly(dirs, bounds) {
    // Intersect half-planes cleanly via dense boundary sampling/clipping
    let poly = [
        { x: -6, y: -6 },
        { x: 6, y: -6 },
        { x: 6, y: 6 },
        { x: -6, y: 6 },
    ];
    for (let i = 0; i < dirs.length; i++) {
        const [nx, ny] = dirs[i];
        const b = bounds[i];
        const next = [];
        for (let j = 0; j < poly.length; j++) {
            const p1 = poly[j];
            const p2 = poly[(j + 1) % poly.length];
            const d1 = nx * p1.x + ny * p1.y - b;
            const d2 = nx * p2.x + ny * p2.y - b;
            if (d1 <= 1e-9) next.push(p1);
            if ((d1 <= 1e-9 && d2 > 1e-9) || (d1 > 1e-9 && d2 <= 1e-9)) {
                const t = d1 / (d1 - d2);
                next.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
            }
        }
        poly = next;
        if (poly.length < 3) break;
    }
    return poly;
}

function supportBounds(pts, dirs) {
    return dirs.map(([nx, ny]) => {
        let m = -Infinity;
        for (const p of pts) {
            const v = nx * p.x + ny * p.y;
            if (v > m) m = v;
        }
        return m;
    });
}

function buildFixpointSequence() {
    const P = getProgram();
    const dirs = domainDirections();
    let bounds = supportBounds(P.initBox, dirs);
    absSteps = [{ label: "Init X₀", poly: halfspacesToPoly(dirs, bounds), bounds: [...bounds], kind: "init" }];

    // Kleene iterations + abstract transformer join
    for (let iter = 1; iter <= 14; iter++) {
        const curPoly = halfspacesToPoly(dirs, bounds);
        const imgPts = curPoly.map((p) => {
            const [nx, ny] = P.step(p.x, p.y);
            return { x: nx, y: ny };
        });
        const imgBounds = supportBounds(imgPts, dirs);
        const joinBounds = bounds.map((b, i) => Math.max(b, imgBounds[i]));

        let nextBounds;
        let kind = "join";
        if (iter > widenDelay && iter <= widenDelay + 3) {
            // Cousot widening operator: unstable bounds jump modestly toward outer guard/horizon (or 3.85 if box unstable)
            kind = "widen";
            nextBounds = bounds.map((b, i) => (joinBounds[i] > b + 0.015 ? Math.min(3.45, joinBounds[i] + 0.35) : b));
        } else {
            nextBounds = joinBounds;
        }
        bounds = nextBounds;
        absSteps.push({
            label: kind === "widen" ? `Widen X_${iter} (▽)` : `Join X_${iter} (⊔)`,
            poly: halfspacesToPoly(dirs, bounds),
            bounds: [...bounds],
            kind,
        });
    }

    // Two narrowing steps intersecting with one-step image U init
    for (let n = 1; n <= 2; n++) {
        const curPoly = halfspacesToPoly(dirs, bounds);
        const imgPts = curPoly.map((p) => {
            const [nx, ny] = P.step(p.x, p.y);
            return { x: nx, y: ny };
        });
        const initB = supportBounds(P.initBox, dirs);
        const postB = supportBounds(imgPts, dirs);
        const tight = bounds.map((b, i) => Math.min(b, Math.max(initB[i], postB[i])));
        bounds = tight;
        absSteps.push({
            label: `Narrow △_${n}`,
            poly: halfspacesToPoly(dirs, bounds),
            bounds: [...bounds],
            kind: "narrow",
        });
    }
    absPhase = 0;
}

function spawnParticles(count = 42, x0 = null, y0 = null) {
    const P = getProgram();
    for (let i = 0; i < count; i++) {
        let sx, sy;
        if (x0 !== null) {
            sx = x0 + (Math.random() - 0.5) * 0.25;
            sy = y0 + (Math.random() - 0.5) * 0.25;
        } else {
            const minX = Math.min(...P.initBox.map((p) => p.x));
            const maxX = Math.max(...P.initBox.map((p) => p.x));
            const minY = Math.min(...P.initBox.map((p) => p.y));
            const maxY = Math.max(...P.initBox.map((p) => p.y));
            sx = minX + Math.random() * (maxX - minX);
            sy = minY + Math.random() * (maxY - minY);
        }
        particles.push({
            x: sx,
            y: sy,
            nx: sx,
            ny: sy,
            t: Math.random(),
            trail: [{ x: sx, y: sy }],
            life: 16 + Math.floor(Math.random() * 20),
        });
    }
}

function resetAll() {
    particles = [];
    buildFixpointSequence();
    spawnParticles(48);
    // Step particles ahead slightly so luminous spiral flow is immediate on paint
    const P = getProgram();
    for (let k = 0; k < 6; k++) {
        particles.forEach((pt) => {
            const [nx, ny] = P.step(pt.nx, pt.ny);
            pt.x = pt.nx; pt.y = pt.ny;
            pt.nx = nx; pt.ny = ny;
            pt.trail.push({ x: nx, y: ny });
            if (pt.trail.length > 18) pt.trail.shift();
        });
    }
}

resetAll();

function polyIntersectsRect(poly, r) {
    // Separating-axis quick sample check (exact enough via sampled vertices + edge checks + rect corners inside poly)
    const ptInRect = (p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (poly.some(ptInRect)) return true;
    const corners = [
        { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
        { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
    ];
    for (const c of corners) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            if ((yi > c.y) !== (yj > c.y) && c.x < ((xj - xi) * (c.y - yi)) / (yj - yi + 1e-9) + xi) {
                inside = !inside;
            }
        }
        if (inside) return true;
    }
    return false;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width;
    const H = canvas.height;
    const embedded =
        document.documentElement.classList.contains("embed") ||
        document.documentElement.classList.contains("panels-hidden");
    const topY = embedded || H < 680 ? 20 : 120;

    const cx = W * 0.5;
    const cy = topY + (H - topY) * 0.5;
    const scale = Math.min(W, H - topY * 0.5) / 8.8;
    const toSx = (x) => cx + x * scale;
    const toSy = (y) => cy - y * scale;

    const P = getProgram();

    // Axes + unit rings
    ctx.strokeStyle = "rgba(20, 32, 43, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    ctx.stroke();

    for (let rad = 1; rad <= 3; rad++) {
        ctx.strokeStyle = "rgba(58, 108, 78, 0.18)";
        ctx.beginPath();
        ctx.arc(cx, cy, rad * scale, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Smoothly cycle fixpoint stage + pulse breathing
    fixTick++;
    if (fixTick % 26 === 0) {
        absPhase = (absPhase + 1) % (absSteps.length + 5);
    }
    const curIdx = Math.min(absPhase, absSteps.length - 1);
    const curStep = absSteps[curIdx];

    // Draw ghost previous envelopes for visual trace depth
    for (let k = Math.max(0, curIdx - 3); k < curIdx; k++) {
        const gPoly = absSteps[k].poly;
        if (gPoly.length < 3) continue;
        ctx.beginPath();
        gPoly.forEach((p, idx) => (idx === 0 ? ctx.moveTo(toSx(p.x), toSy(p.y)) : ctx.lineTo(toSx(p.x), toSy(p.y))));
        ctx.closePath();
        ctx.strokeStyle = "rgba(29, 95, 167, 0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw active abstract domain polygon (cobalt fill + crisp border)
    const unsafe = polyIntersectsRect(curStep.poly, P.hazard);
    if (curStep.poly.length >= 3) {
        ctx.beginPath();
        curStep.poly.forEach((p, idx) =>
            idx === 0 ? ctx.moveTo(toSx(p.x), toSy(p.y)) : ctx.lineTo(toSx(p.x), toSy(p.y))
        );
        ctx.closePath();
        ctx.fillStyle = unsafe ? "rgba(214, 58, 34, 0.11)" : "rgba(29, 95, 167, 0.13)";
        ctx.fill();
        ctx.strokeStyle = unsafe ? "#d63a22" : "#1d5fa7";
        ctx.lineWidth = 2.4;
        ctx.stroke();
    }

    // Draw Init set X0 (ink dashed outline)
    ctx.beginPath();
    P.initBox.forEach((p, idx) => (idx === 0 ? ctx.moveTo(toSx(p.x), toSy(p.y)) : ctx.lineTo(toSx(p.x), toSy(p.y))));
    ctx.closePath();
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Hazard / Assertion Violation Region (hatched vermilion slip)
    const hx = toSx(P.hazard.x);
    const hy = toSy(P.hazard.y + P.hazard.h);
    const hw = P.hazard.w * scale;
    const hh = P.hazard.h * scale;
    ctx.fillStyle = "rgba(214, 58, 34, 0.18)";
    ctx.fillRect(hx, hy, hw, hh);
    ctx.strokeStyle = "#d63a22";
    ctx.lineWidth = 2;
    ctx.strokeRect(hx, hy, hw, hh);

    // Diagonal hazard hatching
    ctx.save();
    ctx.beginPath();
    ctx.rect(hx, hy, hw, hh);
    ctx.clip();
    ctx.strokeStyle = "rgba(214, 58, 34, 0.35)";
    ctx.lineWidth = 1.2;
    for (let d = -hh; d < hw + hh; d += 12) {
        ctx.beginPath();
        ctx.moveTo(hx + d, hy);
        ctx.lineTo(hx + d - hh, hy + hh);
        ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "#d63a22";
    ctx.font = "700 10px 'Martian Mono', monospace";
    ctx.fillText("ERR / UNSAFE", hx + 6, hy + 16);

    // Update & render kinetic concrete trajectories
    simTime += 0.032;
    particles.forEach((pt, idx) => {
        pt.t += 0.028;
        if (pt.t >= 1) {
            pt.t -= 1;
            const [nx, ny] = P.step(pt.nx, pt.ny);
            pt.x = pt.nx;
            pt.y = pt.ny;
            pt.nx = nx;
            pt.ny = ny;
            pt.trail.push({ x: nx, y: ny });
            if (pt.trail.length > 22) pt.trail.shift();
            pt.life--;
            if (pt.life <= 0 || Math.hypot(nx, ny) < 0.06) {
                const minX = Math.min(...P.initBox.map((p) => p.x));
                const maxX = Math.max(...P.initBox.map((p) => p.x));
                const minY = Math.min(...P.initBox.map((p) => p.y));
                const maxY = Math.max(...P.initBox.map((p) => p.y));
                const rx = minX + Math.random() * (maxX - minX);
                const ry = minY + Math.random() * (maxY - minY);
                pt.x = rx; pt.y = ry;
                pt.nx = rx; pt.ny = ry;
                pt.trail = [{ x: rx, y: ry }];
                pt.life = 18 + (idx % 12);
            }
        }
        const ix = pt.x + (pt.nx - pt.x) * pt.t;
        const iy = pt.y + (pt.ny - pt.y) * pt.t;

        if (pt.trail.length > 1) {
            ctx.beginPath();
            pt.trail.forEach((tp, k) => (k === 0 ? ctx.moveTo(toSx(tp.x), toSy(tp.y)) : ctx.lineTo(toSx(tp.x), toSy(tp.y))));
            ctx.lineTo(toSx(ix), toSy(iy));
            ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
            ctx.lineWidth = 1.25;
            ctx.stroke();
        }
        ctx.fillStyle = "#14202b";
        ctx.beginPath();
        ctx.arc(toSx(ix), toSy(iy), 2.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Bottom status bar banner right inside canvas for immediate fixpoint readability
    ctx.fillStyle = "rgba(239, 244, 230, 0.9)";
    ctx.fillRect(36, H - 46, Math.min(460, W - 72), 28);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(36, H - 46, Math.min(460, W - 72), 28);
    ctx.fillStyle = unsafe ? "#d63a22" : "#1d5fa7";
    ctx.font = "600 10.5px 'Martian Mono', monospace";
    const verdict = unsafe ? "FALSE ALARM / UNPROVEN (DOMAIN TOO COARSE)" : "INDUCTIVE INVARIANT SAFE (X_∞ ∩ ERR = ∅)";
    ctx.fillText(`${curStep.label}  ·  ${verdict}`, 48, H - 28);

    document.getElementById("abs-out").textContent = `${curStep.label} · ${unsafe ? "INTERSECTS ERR" : "SAFE: X_∞ ∩ ERR = ∅"}`;
    requestAnimationFrame(draw);
}

canvas.addEventListener("mousedown", (e) => {
    const W = canvas.width, H = canvas.height;
    const embedded =
        document.documentElement.classList.contains("embed") ||
        document.documentElement.classList.contains("panels-hidden");
    const topY = embedded || H < 680 ? 20 : 120;
    const cx = W * 0.5, cy = topY + (H - topY) * 0.5;
    const scale = Math.min(W, H - topY * 0.5) / 8.8;
    const wx = (e.clientX - cx) / scale;
    const wy = (cy - e.clientY) / scale;
    spawnParticles(10, wx, wy);
});

document.getElementById("prog-sel").addEventListener("change", (e) => {
    progId = e.target.value;
    resetAll();
});
document.getElementById("dom-sel").addEventListener("change", (e) => {
    domId = e.target.value;
    buildFixpointSequence();
});
document.getElementById("widen-slider").addEventListener("input", (e) => {
    widenDelay = parseInt(e.target.value, 10);
    document.getElementById("widen-val").textContent = String(widenDelay);
    buildFixpointSequence();
});
document.getElementById("replay-btn").addEventListener("click", () => {
    absPhase = 0;
    fixTick = 0;
});
document.getElementById("hazard-btn").addEventListener("click", () => {
    hazardOffset = (hazardOffset + 1) % 3;
    buildFixpointSequence();
});

draw();
