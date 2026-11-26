const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const HALF = 80;
const SITES = HALF * 2 + 1;

const SHOTS = 48;
let aRe = new Float64Array(SITES * SHOTS);
let aIm = new Float64Array(SITES * SHOTS);
let bRe = new Float64Array(SITES * SHOTS);
let bIm = new Float64Array(SITES * SHOTS);
let tmpARe = new Float64Array(SITES * SHOTS);
let tmpAIm = new Float64Array(SITES * SHOTS);
let tmpBRe = new Float64Array(SITES * SHOTS);
let tmpBIm = new Float64Array(SITES * SHOTS);

let classical = new Float64Array(SITES);
let cTmp = new Float64Array(SITES);
let probQ = new Float64Array(SITES);

let stepCount = 0;
let decoh = 0;
let coinType = "hadamard";
let running = true;
let frameAcc = 0;
let sigmaHistory = [];

function initWalk() {
    aRe.fill(0); aIm.fill(0); bRe.fill(0); bIm.fill(0);
    classical.fill(0);
    classical[HALF] = 1;
    stepCount = 0;
    sigmaHistory = [];

    for (let s = 0; s < SHOTS; s++) {
        const idx = s * SITES + HALF;
        if (coinType === "hadamard") {
            aRe[idx] = Math.SQRT1_2;
            bIm[idx] = Math.SQRT1_2;
        } else {
            aRe[idx] = 1;
        }
    }
    computeMarginals();
}

function computeMarginals() {
    probQ.fill(0);
    for (let x = 0; x < SITES; x++) {
        let sum = 0;
        for (let s = 0; s < SHOTS; s++) {
            const idx = s * SITES + x;
            sum += aRe[idx] * aRe[idx] + aIm[idx] * aIm[idx] + bRe[idx] * bRe[idx] + bIm[idx] * bIm[idx];
        }
        probQ[x] = sum / SHOTS;
    }
    let varQ = 0, varC = 0;
    for (let x = 0; x < SITES; x++) {
        const dx = x - HALF;
        varQ += dx * dx * probQ[x];
        varC += dx * dx * classical[x];
    }
    const sq = Math.sqrt(varQ), sc = Math.sqrt(varC);
    sigmaHistory.push({ t: stepCount, sq, sc });
    if (sigmaHistory.length > 75) sigmaHistory.shift();

    document.getElementById("walk-out").textContent =
        `Step t = ${stepCount} · σ_Q = ${sq.toFixed(2)}  σ_C = ${sc.toFixed(2)}`;
}

function stepWalk() {
    if (stepCount >= HALF - 2) initWalk();

    const theta = coinType === "dft" ? Math.PI / 6 : Math.PI / 4;
    const c = Math.cos(theta), si = Math.sin(theta);

    // Classical binomial step
    cTmp.fill(0);
    for (let x = 1; x < SITES - 1; x++) {
        const p = classical[x];
        if (p > 1e-9) {
            cTmp[x - 1] += 0.5 * p;
            cTmp[x + 1] += 0.5 * p;
        }
    }
    classical.set(cTmp);

    // Quantum coin + shift step across stochastic trajectories
    tmpARe.fill(0); tmpAIm.fill(0); tmpBRe.fill(0); tmpBIm.fill(0);
    for (let s = 0; s < SHOTS; s++) {
        const off = s * SITES;
        const doCollapse = decoh > 0 && Math.random() < decoh;

        if (doCollapse) {
            // Projective position + coin measurement weighted by Born rule
            let r = Math.random();
            let chosenX = HALF, chosenCoin = 0;
            outer: for (let x = 1; x < SITES - 1; x++) {
                const idx = off + x;
                const p0 = aRe[idx] * aRe[idx] + aIm[idx] * aIm[idx];
                const p1 = bRe[idx] * bRe[idx] + bIm[idx] * bIm[idx];
                if (r < p0) { chosenX = x; chosenCoin = 0; break outer; }
                r -= p0;
                if (r < p1) { chosenX = x; chosenCoin = 1; break outer; }
                r -= p1;
            }
            const ar = chosenCoin === 0 ? 1 : 0;
            const br = chosenCoin === 1 ? 1 : 0;
            const naR = c * ar + si * br;
            const nbR = si * ar - c * br;
            tmpARe[off + chosenX - 1] += naR;
            tmpBRe[off + chosenX + 1] += nbR;
        } else {
            for (let x = 1; x < SITES - 1; x++) {
                const idx = off + x;
                const ar = aRe[idx], ai = aIm[idx], br = bRe[idx], bi = bIm[idx];
                if (ar === 0 && ai === 0 && br === 0 && bi === 0) continue;
                const naR = c * ar + si * br;
                const naI = c * ai + si * bi;
                const nbR = si * ar - c * br;
                const nbI = si * ai - c * bi;
                tmpARe[off + x - 1] += naR;
                tmpAIm[off + x - 1] += naI;
                tmpBRe[off + x + 1] += nbR;
                tmpBIm[off + x + 1] += nbI;
            }
        }
    }
    aRe.set(tmpARe); aIm.set(tmpAIm); bRe.set(tmpBRe); bIm.set(tmpBIm);
    stepCount++;
    computeMarginals();
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

initWalk();
for (let i = 0; i < 36; i++) stepWalk();

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width;
    const H = canvas.height;
    const embedded =
        document.documentElement.classList.contains("embed") ||
        document.documentElement.classList.contains("panels-hidden");
    const topY = embedded || H < 680 ? 52 : 254;

    const padX = 52;
    const plotW = W - padX * 2;
    const baseY = H * 0.72;
    const plotH = Math.max(120, Math.min(H * 0.44, baseY - topY));

    // Horizon & center lattice line
    ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padX, baseY);
    ctx.lineTo(padX + plotW, baseY);
    ctx.moveTo(W * 0.5, baseY - plotH);
    ctx.lineTo(W * 0.5, baseY + 12);
    ctx.stroke();

    // Find peak for auto-scale
    let maxP = 0.04;
    for (let x = 0; x < SITES; x++) {
        if (probQ[x] > maxP) maxP = probQ[x];
        if (classical[x] > maxP) maxP = classical[x];
    }

    const parity = stepCount % 2;
    const xPos = (x) => padX + (x / (SITES - 1)) * plotW;

    // Classical dashed curve (cobalt)
    ctx.beginPath();
    let started = false;
    for (let x = 0; x < SITES; x++) {
        if ((x - HALF + 1000) % 2 !== parity) continue;
        const px = xPos(x);
        const py = baseY - (classical[x] / maxP) * plotH;
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#1d5fa7";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Quantum distribution fill & vermilion spikes
    ctx.beginPath();
    ctx.moveTo(xPos(0), baseY);
    for (let x = 0; x < SITES; x++) {
        if ((x - HALF + 1000) % 2 !== parity) continue;
        const px = xPos(x);
        const py = baseY - (probQ[x] / maxP) * plotH;
        ctx.lineTo(px, py);
    }
    ctx.lineTo(xPos(SITES - 1), baseY);
    ctx.closePath();
    ctx.fillStyle = "rgba(214, 58, 34, 0.16)";
    ctx.fill();
    ctx.strokeStyle = "#d63a22";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Vertical combs at active parity sites
    ctx.strokeStyle = "rgba(214, 58, 34, 0.45)";
    ctx.lineWidth = 1.2;
    for (let x = 0; x < SITES; x += 1) {
        if ((x - HALF + 1000) % 2 !== parity) continue;
        if (probQ[x] < 0.002) continue;
        const px = xPos(x);
        const py = baseY - (probQ[x] / maxP) * plotH;
        ctx.beginPath();
        ctx.moveTo(px, baseY);
        ctx.lineTo(px, py);
        ctx.stroke();
    }

    // Inset: Std Dev scaling sigma(t) chart at bottom
    const ix = padX, iy = baseY + 26, iw = Math.min(340, plotW * 0.42), ih = Math.min(115, H - baseY - 38);
    if (ih > 55 && sigmaHistory.length > 2) {
        ctx.fillStyle = "rgba(239, 244, 230, 0.85)";
        ctx.fillRect(ix, iy, iw, ih);
        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(ix, iy, iw, ih);

        ctx.fillStyle = "#14202b";
        ctx.font = "600 10px 'Martian Mono', monospace";
        ctx.fillText("SPREAD σ(t): QUANTUM vs √t", ix + 10, iy + 16);

        const maxT = Math.max(10, stepCount);
        const maxS = Math.max(4, sigmaHistory[sigmaHistory.length - 1].sq * 1.15);

        const plotCurve = (key, color) => {
            ctx.beginPath();
            sigmaHistory.forEach((pt, idx) => {
                const sx = ix + 10 + (pt.t / maxT) * (iw - 20);
                const sy = iy + ih - 10 - (pt[key] / maxS) * (ih - 32);
                if (idx === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            });
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.8;
            ctx.stroke();
        };
        plotCurve("sc", "#1d5fa7");
        plotCurve("sq", "#d63a22");
    }
}

function animate() {
    if (running) {
        frameAcc++;
        if (frameAcc >= 6) {
            frameAcc = 0;
            stepWalk();
        }
    }
    draw();
    requestAnimationFrame(animate);
}

document.getElementById("coin-sel").addEventListener("change", (e) => {
    coinType = e.target.value;
    initWalk();
});
document.getElementById("decoh").addEventListener("input", (e) => {
    decoh = parseFloat(e.target.value);
    document.getElementById("decoh-val").textContent = decoh.toFixed(2);
    initWalk();
});
document.getElementById("play-btn").addEventListener("click", (e) => {
    running = !running;
    e.target.textContent = running ? "Running" : "Paused";
    e.target.classList.toggle("active", running);
});
document.getElementById("step-btn").addEventListener("click", () => {
    for (let i = 0; i < 5; i++) stepWalk();
});
document.getElementById("reset-btn").addEventListener("click", initWalk);

animate();
