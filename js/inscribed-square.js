const cvs = document.getElementById("curveCanvas");
const ctx = cvs.getContext("2d");

function setupCanvas() {
    const oldW = cvs.width || window.innerWidth;
    const oldH = cvs.height || window.innerHeight;
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
    if (typeof curvePoints !== "undefined" && curvePoints.length) {
        const sx = cvs.width / oldW;
        const sy = cvs.height / oldH;
        curvePoints.forEach((p) => { p.x *= sx; p.y *= sy; });
        foundSquares.forEach((sq) => sq.forEach((p) => { p.x *= sx; p.y *= sy; }));
        render();
    }
}
setupCanvas();
window.addEventListener("resize", setupCanvas);

let curvePoints = [];
let isDrawing = false;
let foundSquares = [];
let searchPrecision = 100;

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
        // Close the curve
        curvePoints.push(curvePoints[0]);
        isDrawing = false;
        updateStatus(
            `Curve drawn with ${curvePoints.length} points. Click "Find Squares" to search.`
        );
        render();
    }
});

function distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function isSquare(p1, p2, p3, p4) {
    // Check if four points form a square
    const d12 = distance(p1, p2);
    const d23 = distance(p2, p3);
    const d34 = distance(p3, p4);
    const d41 = distance(p4, p1);
    const d13 = distance(p1, p3);
    const d24 = distance(p2, p4);

    // All sides should be equal
    const sides = [d12, d23, d34, d41].sort((a, b) => a - b);
    const diagonals = [d13, d24].sort((a, b) => a - b);

    const sideTolerance = sides[3] * 0.1; // 10% tolerance
    const diagonalTolerance = diagonals[1] * 0.1;

    const sidesEqual = sides[3] - sides[0] < sideTolerance;
    const diagonalsEqual =
        Math.abs(diagonals[1] - diagonals[0]) < diagonalTolerance;
    const diagonalCorrect =
        Math.abs(diagonals[0] - sides[0] * Math.sqrt(2)) < sides[0] * 0.15;

    return sidesEqual && diagonalsEqual && diagonalCorrect && sides[0] > 20;
}

function findInscribedSquares() {
    foundSquares = [];
    updateStatus("Searching for inscribed squares...");

    if (curvePoints.length < 4) {
        updateStatus("Curve too small. Draw a larger curve.");
        return;
    }

    const n = curvePoints.length;
    const step = Math.max(1, Math.floor(n / searchPrecision));

    // Brute force search for square configurations
    for (let i = 0; i < n; i += step) {
        for (let j = i + step; j < n; j += step) {
            for (let k = j + step; k < n; k += step) {
                for (let l = k + step; l < n; l += step) {
                    const p1 = curvePoints[i];
                    const p2 = curvePoints[j];
                    const p3 = curvePoints[k];
                    const p4 = curvePoints[l];

                    if (isSquare(p1, p2, p3, p4)) {
                        foundSquares.push([p1, p2, p3, p4]);
                    }
                }
            }
        }
    }

    if (foundSquares.length > 0) {
        updateStatus(`Found ${foundSquares.length} inscribed square(s)!`);
    } else {
        updateStatus(
            "No squares found. Try adjusting precision or drawing a different curve."
        );
    }

    render();
}

function loadExampleCurve() {
    curvePoints = [];
    foundSquares = [];

    // Create a wavy closed curve
    const centerX = cvs.width / 2;
    const centerY = cvs.height / 2;
    const radius = Math.min(cvs.width, cvs.height) * 0.34;

    for (let i = 0; i <= 100; i++) {
        const angle = (i / 100) * Math.PI * 2;
        const wobble = Math.sin(angle * 3) * 30 + Math.cos(angle * 5) * 20;
        const r = radius + wobble;
        curvePoints.push({
            x: centerX + r * Math.cos(angle),
            y: centerY + r * Math.sin(angle),
        });
    }

    updateStatus(
        `Example curve loaded with ${curvePoints.length} points. Click "Find Squares".`
    );
    render();
}

function updateStatus(message) {
    document.getElementById("statusDisplay").textContent = message;
}

function render() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    // Draw the curve
    if (curvePoints.length > 1) {
        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
        for (let i = 1; i < curvePoints.length; i++) {
            ctx.lineTo(curvePoints[i].x, curvePoints[i].y);
        }
        ctx.stroke();

        // Draw points on curve
        ctx.fillStyle = "rgba(20, 32, 43, 0.45)";
        curvePoints.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Draw found squares
    foundSquares.forEach((square, idx) => {
        const sqColors = ["#d63a22", "#1d5fa7", "#2c7a4b", "#9a5b13"];
        const sc = sqColors[idx % sqColors.length];
        ctx.strokeStyle = sc;
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(square[0].x, square[0].y);
        ctx.lineTo(square[1].x, square[1].y);
        ctx.lineTo(square[2].x, square[2].y);
        ctx.lineTo(square[3].x, square[3].y);
        ctx.closePath();
        ctx.stroke();

        ctx.setLineDash([]);

        // Draw vertices
        square.forEach((p) => {
            ctx.fillStyle = sc;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
    });
}

document.getElementById("clearBtn").addEventListener("click", () => {
    curvePoints = [];
    foundSquares = [];
    updateStatus("Draw a closed curve to begin...");
    render();
});

document
    .getElementById("findBtn")
    .addEventListener("click", findInscribedSquares);
document
    .getElementById("exampleBtn")
    .addEventListener("click", loadExampleCurve);

document
    .getElementById("precisionSlider")
    .addEventListener("input", (e) => {
        searchPrecision = parseInt(e.target.value);
        document.getElementById("precisionVal").textContent = searchPrecision;
    });

render();