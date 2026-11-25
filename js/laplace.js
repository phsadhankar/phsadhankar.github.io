
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let alpha = 1.0;
let omega = 2.0;
let selectedFunc = "exp";
let showAnimation = false;
let animationProgress = 0;

const transforms = {
    exp: {
        formula: "1/(s + α)",
        func: (t) => Math.exp(-alpha * t),
        laplace: (sigma, omega) => {
            const denom = (sigma + alpha) * (sigma + alpha) + omega * omega;
            return Math.sqrt(
                ((sigma + alpha) * (sigma + alpha)) / (denom * denom)
            );
        },
    },
    sin: {
        formula: "ω/(s² + ω²)",
        func: (t) => Math.sin(omega * t),
        laplace: (sigma, omega_s) => {
            const denom = sigma * sigma + (omega_s * omega_s - omega * omega);
            return (
                Math.abs(omega) /
                Math.sqrt(denom * denom + 4 * sigma * sigma * omega_s * omega_s)
            );
        },
    },
    cos: {
        formula: "s/(s² + ω²)",
        func: (t) => Math.cos(omega * t),
        laplace: (sigma, omega_s) => {
            const denom = sigma * sigma + (omega_s * omega_s - omega * omega);
            return (
                Math.abs(sigma) /
                Math.sqrt(denom * denom + 4 * sigma * sigma * omega_s * omega_s)
            );
        },
    },
    step: {
        formula: "1/s",
        func: (t) => 1,
        laplace: (sigma, omega_s) => {
            return 1 / Math.sqrt(sigma * sigma + omega_s * omega_s);
        },
    },
    ramp: {
        formula: "1/s²",
        func: (t) => t,
        laplace: (sigma, omega_s) => {
            const mag = sigma * sigma + omega_s * omega_s;
            return 1 / mag;
        },
    },
    pulse: {
        formula: "(1 - e^(-Ts))/s",
        func: (t) => (t % (2 / omega) < 1 / omega ? 1 : 0),
        laplace: (sigma, omega_s) => {
            return 0.5 / Math.sqrt(sigma * sigma + omega_s * omega_s);
        },
    },
    "damped-sin": {
        formula: "ω/((s+α)² + ω²)",
        func: (t) => Math.exp(-alpha * t) * Math.sin(omega * t),
        laplace: (sigma, omega_s) => {
            const s_shifted = sigma + alpha;
            const denom =
                s_shifted * s_shifted + (omega_s * omega_s - omega * omega);
            return (
                Math.abs(omega) /
                Math.sqrt(
                    denom * denom + 4 * s_shifted * s_shifted * omega_s * omega_s
                )
            );
        },
    },
};

function drawTimeDomain() {
    const w = canvas.width * 0.45;
    const h = canvas.height * 0.35;
    const x = 30;
    const y = 30;

    ctx.fillStyle = "rgba(14, 22, 32, 0.3)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ff7a45";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.beginPath();
    ctx.strokeStyle = "#ff7a45";
    ctx.lineWidth = 2;

    const func = transforms[selectedFunc].func;
    const tMax = 5;
    const samples = 500;

    for (let i = 0; i < samples; i++) {
        const t = (i / samples) * tMax;
        const val = func(t);
        const px = x + (i / samples) * w;
        const py = y + h / 2 - val * h * 0.3;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = "#ff7a45";
    ctx.font = "14px 'Martian Mono', monospace";
    ctx.fillText("f(t) - Time Domain", x + 10, y + 20);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("t →", x + w - 30, y + h + 20);
}

function drawMagnitudeSpectrum() {
    const w = canvas.width * 0.45;
    const h = canvas.height * 0.35;
    const x = canvas.width - w - 30;
    const y = 30;

    ctx.fillStyle = "rgba(14, 22, 32, 0.3)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ff7a45";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const laplace = transforms[selectedFunc].laplace;
    const sigma = 0.1;
    const samples = 300;
    const omegaMax = 15;

    let maxMag = 0;
    const magnitudes = [];
    for (let i = 0; i < samples; i++) {
        const omega_s = (i / samples) * omegaMax;
        const mag = laplace(sigma, omega_s);
        magnitudes.push(mag);
        maxMag = Math.max(maxMag, mag);
    }

    ctx.fillStyle = "rgba(255, 122, 69, 0.6)";
    for (let i = 0; i < samples; i++) {
        const barHeight = (magnitudes[i] / maxMag) * h * 0.8;
        const px = x + (i / samples) * w;
        const py = y + h - barHeight;
        const barWidth = w / samples;
        ctx.fillRect(px, py, barWidth, barHeight);
    }

    ctx.fillStyle = "#ff7a45";
    ctx.font = "14px 'Martian Mono', monospace";
    ctx.fillText("|F(s)| - Magnitude", x + 10, y + 20);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("ω →", x + w - 30, y + h + 20);
}

function drawComplexPlane() {
    const w = canvas.width - 60;
    const h = canvas.height * 0.5;
    const x = 30;
    const y = canvas.height - h - 30;

    ctx.fillStyle = "rgba(14, 22, 32, 0.3)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ff7a45";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.strokeStyle = "rgba(255, 122, 69, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + w, cy);
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y + h);
    ctx.stroke();

    const laplace = transforms[selectedFunc].laplace;
    const sigmaRange = 5;
    const omegaRange = 10;
    const resolution = 100;

    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const sigma = (i / resolution - 0.5) * sigmaRange * 2;
            const omega_s = (j / resolution - 0.5) * omegaRange * 2;

            const mag = laplace(sigma, omega_s);
            const color = Math.min(255, mag * 100);

            const px = cx + sigma * (w / (sigmaRange * 2));
            const py = cy - omega_s * (h / (omegaRange * 2));

            ctx.fillStyle = `rgba(0, ${color}, ${color * 0.5}, 0.8)`;
            ctx.fillRect(px, py, w / resolution, h / resolution);
        }
    }

    if (showAnimation) {
        const t = animationProgress * 5;
        const func = transforms[selectedFunc].func;
        const val = func(t);

        const sigmas = [-2, -1, 0, 1, 2];
        sigmas.forEach((sigma) => {
            const omega_s = omega;
            const weight = Math.exp(-sigma * t);

            const px = cx + sigma * (w / (sigmaRange * 2));
            const py = cy - omega_s * (h / (omegaRange * 2));

            ctx.strokeStyle = "#ffaa00";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(px, py, 5 + weight * 10, 0, 2 * Math.PI);
            ctx.stroke();
        });
    }

    ctx.fillStyle = "#ff7a45";
    ctx.font = "14px 'Martian Mono', monospace";
    ctx.fillText("s-plane: σ + iω", x + 10, y + 20);
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText("σ (real) →", cx + 10, cy - 10);
    ctx.save();
    ctx.translate(cx - 50, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("iω (imag) →", 0, 0);
    ctx.restore();
}

function updateTransformInfo() {
    const formula = transforms[selectedFunc].formula;
    document.getElementById("transform-result").innerHTML =
        `<strong>F(s) = ${formula}</strong><br>` +
        `α = ${alpha.toFixed(2)}, ω = ${omega.toFixed(2)}`;
}

function animate() {
    ctx.fillStyle = "#0e1620";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTimeDomain();
    drawMagnitudeSpectrum();
    drawComplexPlane();

    if (showAnimation) {
        animationProgress += 0.01;
        if (animationProgress > 1) {
            animationProgress = 0;
        }
    }

    requestAnimationFrame(animate);
}

document
    .getElementById("function-select")
    .addEventListener("change", (e) => {
        selectedFunc = e.target.value;
        updateTransformInfo();
    });

document.getElementById("alpha").addEventListener("input", (e) => {
    alpha = parseFloat(e.target.value);
    document.getElementById("alpha-val").textContent = alpha.toFixed(1);
    updateTransformInfo();
});

document.getElementById("omega").addEventListener("input", (e) => {
    omega = parseFloat(e.target.value);
    document.getElementById("omega-val").textContent = omega.toFixed(1);
    updateTransformInfo();
});

document
    .getElementById("animate-toggle")
    .addEventListener("click", () => {
        showAnimation = !showAnimation;
        document.getElementById("animate-toggle").textContent = showAnimation
            ? "Hide Transform Process"
            : "Show Transform Process";
        animationProgress = 0;
    });

updateTransformInfo();
animate();