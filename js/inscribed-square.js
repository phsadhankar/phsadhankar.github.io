const cvs = document.getElementById("curveCanvas");
const ctx = cvs.getContext("2d");

let curvePoints = [];
let isDrawing = false;
let foundSquares = [];
let searchPrecision = 100;

function setupCanvas() {
    const oldW = cvs.width || window.innerWidth;
    const oldH = cvs.height || window.innerHeight;
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
    if (curvePoints.length) {
        const sx = cvs.width / oldW;
        const sy = cvs.height / oldH;
        curvePoints.forEach((p) => {
            p.x *= sx;
            p.y *= sy;
        });
        foundSquares.forEach((sq) =>
            sq.forEach((p) => {
                p.x *= sx;
                p.y *= sy;
            })
        );
        render();
    }
}
setupCanvas();
window.addEventListener("resize", setupCanvas);

cvs.addEventListener("mousedown", (e) => {
    isDrawing = true;
    curvePoints = [];
    foundSquares = [];
    curvePoints.push({ x: e.offsetX, y: e.offsetY });
    updateStatus("Drawing curve...");
});

cvs.addEventListener("mousemove", (e) => {
    if (isDrawing) {
        curvePoints.push({ x: e.offsetX, y: e.offsetY });
        render();
    }
});

cvs.addEventListener("mouseup", () => {
    if (isDrawing && curvePoints.length > 3) {
        curvePoints.push({ ...curvePoints[0] });
        isDrawing = false;
        updateStatus(
            `Curve drawn with ${curvePoints.length} points. Click "Find Squares" to search.`
        );
        render();
    }
});

function distance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function findInscribedSquares() {
    foundSquares = [];
    if (curvePoints.length < 4) {
        updateStatus("Curve too small. Draw a larger curve.");
        return;
    }

    const n = curvePoints.length;
    const step = Math.max(1, Math.floor(n / Math.max(40, searchPrecision)));
    const pts = [];
    for (let i = 0; i < n; i += step) pts.push(curvePoints[i]);

    const candidates = [];
    for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        for (let k = i + 2; k < pts.length; k++) {
            const p3 = pts[k];
            const diag = distance(p1, p3);
            if (diag < 42) continue;

            const mx = (p1.x + p3.x) * 0.5;
            const my = (p1.y + p3.y) * 0.5;
            const hx = (p3.x - p1.x) * 0.5;
            const hy = (p3.y - p1.y) * 0.5;

            // Expected square corners rotated +-90 deg around midpoint
            const q2x = mx - hy;
            const q2y = my + hx;
            const q4x = mx + hy;
            const q4y = my - hx;

            let best2 = null;
            let best2d = diag * 0.045;
            let best4 = null;
            let best4d = diag * 0.045;

            for (let m = 0; m < pts.length; m++) {
                if (m === i || m === k) continue;
                const p = pts[m];
                const d2 = Math.hypot(p.x - q2x, p.y - q2y);
                if (d2 < best2d) {
                    best2d = d2;
                    best2 = p;
                }
                const d4 = Math.hypot(p.x - q4x, p.y - q4y);
                if (d4 < best4d) {
                    best4d = d4;
                    best4 = p;
                }
            }

            if (best2 && best4) {
                const err = (best2d + best4d) / diag;
                candidates.push({ sq: [p1, best2, p3, best4], err, mx, my, diag });
            }
        }
    }

    candidates.sort((a, b) => a.err - b.err);

    // Pick crisp distinct squares
    for (const c of candidates) {
        const duplicate = foundSquares.some((sq) => {
            const cx = (sq[0].x + sq[2].x) * 0.5;
            const cy = (sq[0].y + sq[2].y) * 0.5;
            const cd = distance(sq[0], sq[2]);
            return Math.hypot(c.mx - cx, c.my - cy) < 28 && Math.abs(c.diag - cd) < 35;
        });
        if (!duplicate) {
            foundSquares.push(c.sq);
            if (foundSquares.length >= 4) break;
        }
    }

    if (foundSquares.length > 0) {
        updateStatus(`Found ${foundSquares.length} distinct inscribed square(s) (of ${candidates.length} candidates).`);
    } else {
        updateStatus("No squares found within tolerance. Adjust precision or draw a new curve.");
    }

    render();
}

function loadExampleCurve() {
    curvePoints = [];
    foundSquares = [];

    const centerX = cvs.width / 2;
    const centerY = cvs.height / 2;
    const radius = Math.min(cvs.width, cvs.height) * 0.34;

    for (let i = 0; i <= 140; i++) {
        const angle = (i / 140) * Math.PI * 2;
        const wobble = Math.sin(angle * 3) * (radius * 0.16) + Math.cos(angle * 5) * (radius * 0.1);
        const r = radius + wobble;
        curvePoints.push({
            x: centerX + r * Math.cos(angle),
            y: centerY + r * Math.sin(angle),
        });
    }

    updateStatus(`Loaded curve (${curvePoints.length} samples). Searching...`);
    render();
}

function updateStatus(message) {
    document.getElementById("statusDisplay").textContent = message;
}

function render() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    // Faint origin crosshair
    const cx = cvs.width / 2;
    const cy = cvs.height / 2;
    ctx.strokeStyle = "rgba(20, 32, 43, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy);
    ctx.lineTo(cx + 24, cy);
    ctx.moveTo(cx, cy - 24);
    ctx.lineTo(cx, cy + 24);
    ctx.stroke();

    // Draw the Jordan curve
    if (curvePoints.length > 1) {
        ctx.fillStyle = "rgba(239, 244, 230, 0.45)";
        ctx.beginPath();
        ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
        for (let i = 1; i < curvePoints.length; i++) {
            ctx.lineTo(curvePoints[i].x, curvePoints[i].y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 2.8;
        ctx.stroke();
    }

    // Draw found inscribed squares
    const sqColors = ["#d63a22", "#1d5fa7", "#2c7a4b", "#9a5b13"];
    foundSquares.forEach((square, idx) => {
        const sc = sqColors[idx % sqColors.length];
        ctx.fillStyle = idx === 0 ? "rgba(214, 58, 34, 0.08)" : "rgba(29, 95, 167, 0.06)";
        ctx.beginPath();
        ctx.moveTo(square[0].x, square[0].y);
        ctx.lineTo(square[1].x, square[1].y);
        ctx.lineTo(square[2].x, square[2].y);
        ctx.lineTo(square[3].x, square[3].y);
        ctx.closePath();
        ctx.fill();

        // Diagonals subtle
        ctx.strokeStyle = sc;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(square[0].x, square[0].y);
        ctx.lineTo(square[2].x, square[2].y);
        ctx.moveTo(square[1].x, square[1].y);
        ctx.lineTo(square[3].x, square[3].y);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = sc;
        ctx.lineWidth = idx === 0 ? 3 : 2;
        if (idx > 0) ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(square[0].x, square[0].y);
        ctx.lineTo(square[1].x, square[1].y);
        ctx.lineTo(square[2].x, square[2].y);
        ctx.lineTo(square[3].x, square[3].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        square.forEach((p, vi) => {
            ctx.fillStyle = sc;
            ctx.beginPath();
            ctx.arc(p.x, p.y, idx === 0 ? 5.5 : 4.2, 0, Math.PI * 2);
            ctx.fill();
            if (idx === 0) {
                ctx.fillStyle = "#14202b";
                ctx.font = "600 10.5px 'Martian Mono', monospace";
                ctx.fillText(`P${vi + 1}`, p.x + 8, p.y - 6);
            }
        });
    });
}

document.getElementById("clearBtn").addEventListener("click", () => {
    curvePoints = [];
    foundSquares = [];
    updateStatus("Draw a closed curve to begin...");
    render();
});

document.getElementById("findBtn").addEventListener("click", findInscribedSquares);
document.getElementById("exampleBtn").addEventListener("click", () => {
    loadExampleCurve();
    findInscribedSquares();
});

document.getElementById("precisionSlider").addEventListener("input", (e) => {
    searchPrecision = parseInt(e.target.value);
    document.getElementById("precisionVal").textContent = searchPrecision;
});

loadExampleCurve();
findInscribedSquares();
