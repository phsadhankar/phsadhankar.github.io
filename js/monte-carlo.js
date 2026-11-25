const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = Math.min(canvas.width, canvas.height) * 0.35;

let totalPoints = 0;
let insideCircle = 0;
let pointsPerFrame = 100;
let running = true;
let points = [];

const TRUE_PI = Math.PI;

function drawCircleAndSquare() {
    // Draw square
    ctx.strokeStyle = "#ff7a45";
    ctx.lineWidth = 3;
    ctx.strokeRect(
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2
    );

    // Draw circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw axes
    ctx.strokeStyle = "rgba(255, 122, 69, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();
}

function addPoint() {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    const distance = x * x + y * y;
    const inside = distance <= 1;

    if (inside) insideCircle++;
    totalPoints++;

    const screenX = centerX + x * radius;
    const screenY = centerY + y * radius;

    points.push({ x: screenX, y: screenY, inside: inside });

    // Keep only recent points for visualization
    if (points.length > 5000) {
        points.shift();
    }
}

function calculatePi() {
    if (totalPoints === 0) return 0;
    return 4 * (insideCircle / totalPoints);
}

function updateStats() {
    const piEstimate = calculatePi();
    const error = Math.abs((piEstimate - TRUE_PI) / TRUE_PI) * 100;

    document.getElementById("pi-estimate").textContent =
        piEstimate.toFixed(10);
    document.getElementById("error").textContent = error.toFixed(5) + "%";
    document.getElementById("total").textContent =
        totalPoints.toLocaleString();
    document.getElementById("inside").textContent =
        insideCircle.toLocaleString();
    document.getElementById("outside").textContent = (
        totalPoints - insideCircle
    ).toLocaleString();
    document.getElementById("rate").textContent =
        ((insideCircle / totalPoints) * 100).toFixed(2) + "%";

    const progress = Math.min(100, (totalPoints / 100000) * 100);
    document.getElementById("progress").style.width = progress + "%";
}

function drawPoints() {
    points.forEach((point) => {
        ctx.fillStyle = point.inside
            ? "rgba(255, 122, 69, 0.6)"
            : "rgba(255, 0, 65, 0.6)";
        ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
    });
}

function drawConvergence() {
    const graphX = 50;
    const graphY = canvas.height - 220;
    const graphW = 400;
    const graphH = 160;

    // Background + frame
    ctx.fillStyle = "rgba(255, 122, 69, 0.05)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "rgba(255, 122, 69, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    // Title
    ctx.fillStyle = "#ff7a45";
    ctx.font = "12px 'Martian Mono', monospace";
    ctx.fillText("Convergence Plot", graphX + 10, graphY + 18);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("log₁₀(Relative Error) vs log₁₀(Samples)", graphX + 10, graphY + 34);

    // Axes
    const pad = 40;
    const gx0 = graphX + pad;
    const gy0 = graphY + graphH - pad;
    const gx1 = graphX + graphW - 10;
    const gy1 = graphY + 10;

    ctx.strokeStyle = "rgba(255, 122, 69, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx0, gy0);
    ctx.lineTo(gx1, gy0);
    ctx.lineTo(gx1, gy1);
    ctx.stroke();

    // Skip if too few points
    if (totalPoints < 10) return;

    // Build sampled error data
    const samples = Math.min(200, Math.floor(Math.log10(totalPoints) * 30 + 10));
    const step = Math.max(1, Math.floor(totalPoints / samples));
    const data = [];

    let runningInside = 0;
    for (let i = 1; i <= totalPoints; i++) {
        const inside = i <= insideCircle;
        if (inside) runningInside++;
        if (i % step === 0) {
            const piEst = 4 * (runningInside / i);
            const err = Math.abs((piEst - TRUE_PI) / TRUE_PI);
            data.push({ samples: i, err });
        }
    }

    // Smoothing (rolling average)
    const smooth = data.map((d, i) => {
        const range = 5;
        const subset = data.slice(Math.max(0, i - range), Math.min(data.length, i + range));
        const avg = subset.reduce((s, p) => s + p.err, 0) / subset.length;
        return { samples: d.samples, err: avg };
    });

    // Compute log scales
    const minErr = Math.min(...smooth.map((p) => p.err));
    const maxErr = Math.max(...smooth.map((p) => p.err));

    const minLog = Math.log10(minErr || 1e-6);
    const maxLog = Math.log10(maxErr);

    ctx.strokeStyle = "#00aaff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    smooth.forEach((p, i) => {
        const lx = Math.log10(p.samples);
        const ly = Math.log10(p.err);
        const x = gx0 + ((lx - Math.log10(10)) / (Math.log10(totalPoints) - Math.log10(10))) * (gx1 - gx0);
        const y = gy0 - ((ly - minLog) / (maxLog - minLog)) * (gy0 - gy1);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Axis ticks (log10 scale)
    ctx.fillStyle = "rgba(255, 122, 69,0.7)";
    ctx.font = "10px 'Martian Mono', monospace";

    for (let exp = 1; exp <= Math.ceil(Math.log10(totalPoints)); exp++) {
        const lx = gx0 + ((Math.log10(10 ** exp) - Math.log10(10)) / (Math.log10(totalPoints) - Math.log10(10))) * (gx1 - gx0);
        ctx.beginPath();
        ctx.moveTo(lx, gy0);
        ctx.lineTo(lx, gy0 + 4);
        ctx.stroke();
        ctx.fillText(`1e${exp}`, lx - 10, gy0 + 14);
    }

    for (let exp = Math.ceil(minLog); exp <= Math.floor(maxLog); exp++) {
        const y = gy0 - ((exp - minLog) / (maxLog - minLog)) * (gy0 - gy1);
        ctx.beginPath();
        ctx.moveTo(gx0 - 3, y);
        ctx.lineTo(gx0, y);
        ctx.stroke();
        ctx.fillText(`1e${exp}`, gx0 - 32, y + 4);
    }
}

function animate() {
    ctx.fillStyle = "rgba(14, 22, 32, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawCircleAndSquare();
    drawPoints();
    drawConvergence();

    if (running) {
        for (let i = 0; i < pointsPerFrame; i++) {
            addPoint();
        }
        updateStats();
    }

    requestAnimationFrame(animate);
}

document.getElementById("speed").addEventListener("input", (e) => {
    pointsPerFrame = parseInt(e.target.value);
    document.getElementById("speed-val").textContent = pointsPerFrame;
});

document.getElementById("reset").addEventListener("click", () => {
    totalPoints = 0;
    insideCircle = 0;
    points = [];
    updateStats();
});

document.getElementById("toggle").addEventListener("click", () => {
    running = !running;
    document.getElementById("toggle").textContent = running
        ? "Pause"
        : "Resume";
});

document.getElementById("fast").addEventListener("click", () => {
    for (let i = 0; i < 1000000; i++) {
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;
        const distance = x * x + y * y;
        if (distance <= 1) insideCircle++;
        totalPoints++;
    }
    updateStats();
});

animate();