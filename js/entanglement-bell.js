const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let thetaDeg = 45; // |psi> = cos(theta)|00> + e^(i phi) sin(theta)|11>
let phiDeg = 0;
let thetaA = 0; // Alice Bloch angle in radians
let thetaB = Math.PI / 4; // Bob Bloch angle in radians

let pulses = [];
let flashes = [];
let counts = { pp: 0, pm: 0, mp: 0, mm: 0 };
let emitTick = 0;
let draggingDial = null;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function params() {
    const th = (thetaDeg * Math.PI) / 180;
    const ph = (phiDeg * Math.PI) / 180;
    const conc = Math.abs(Math.sin(2 * th));
    const vis = conc * Math.cos(ph);
    const mz = Math.cos(2 * th);
    return { th, ph, conc, vis, mz };
}

function corrE(a, b, p) {
    return Math.cos(a) * Math.cos(b) + p.vis * Math.sin(a) * Math.sin(b);
}

function outcomeProbs(a, b, p) {
    const E = corrE(a, b, p);
    const mA = p.mz * Math.cos(a);
    const mB = p.mz * Math.cos(b);
    return {
        E,
        pp: Math.max(0, 0.25 * (1 + mA + mB + E)),
        mm: Math.max(0, 0.25 * (1 - mA - mB + E)),
        pm: Math.max(0, 0.25 * (1 + mA - mB - E)),
        mp: Math.max(0, 0.25 * (1 - mA + mB - E)),
    };
}

function chshValue(p) {
    // Evaluate CHSH around current Alice basis thetaA and optimal companion angles shifted by (thetaB - thetaA)
    const d = thetaB - thetaA;
    const a = thetaA;
    const ap = thetaA + Math.PI / 2;
    const b = thetaA + d;
    const bp = thetaA - d;
    return Math.abs(corrE(a, b, p) - corrE(a, bp, p) + corrE(ap, b, p) + corrE(ap, bp, p));
}

function samplePair() {
    const p = params();
    const pr = outcomeProbs(thetaA, thetaB, p);
    let r = Math.random();
    let res = "pp";
    if (r < pr.pp) res = "pp";
    else if (r < pr.pp + pr.mm) res = "mm";
    else if (r < pr.pp + pr.mm + pr.pm) res = "pm";
    else res = "mp";
    counts[res]++;
    return res;
}

function clearStats() {
    counts = { pp: 0, pm: 0, mp: 0, mm: 0 };
}

// Seed initial photon pulses & statistics so first paint & ?embed looks alive
for (let i = 0; i < 42; i++) samplePair();
for (let k = 0.15; k <= 0.9; k += 0.25) {
    const res = samplePair();
    pulses.push({ t: k, res, aSign: res[0] === "p" ? 1 : -1, bSign: res[1] === "p" ? 1 : -1 });
}

function layout() {
    const W = canvas.width;
    const H = canvas.height;
    const embedded =
        document.documentElement.classList.contains("embed") ||
        document.documentElement.classList.contains("panels-hidden");
    const topY = embedded || H < 680 ? 36 : 240;
    const benchH = Math.max(190, (H - topY - 36) * 0.56);
    const dialY = topY + benchH * 0.52;
    const dialR = Math.min(72, benchH * 0.34, W * 0.11);
    const ax = Math.max(dialR + 46, W * 0.2);
    const bx = Math.min(W - dialR - 46, W * 0.8);
    const sx = W * 0.5;
    return { W, H, topY, benchH, dialY, dialR, ax, bx, sx };
}

function drawDial(cx, cy, R, ang, title, sub, pSignFlash) {
    ctx.fillStyle = "rgba(239, 244, 230, 0.88)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Degree ticks
    for (let deg = 0; deg < 360; deg += 30) {
        const rad = (deg * Math.PI) / 180;
        const rIn = deg % 90 === 0 ? R - 11 : R - 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * rIn, cy + Math.sin(rad) * rIn);
        ctx.lineTo(cx + Math.cos(rad) * R, cy + Math.sin(rad) * R);
        ctx.strokeStyle = "rgba(20, 32, 43, 0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Orthogonal axis (+1 / -1 polarizer orientation at ang/2 in physical space or ang in Bloch)
    const ux = Math.sin(ang), uy = -Math.cos(ang);
    ctx.strokeStyle = "#d63a22";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx - ux * (R - 12), cy - uy * (R - 12));
    ctx.lineTo(cx + ux * (R - 8), cy + uy * (R - 8));
    ctx.stroke();

    // Arrowhead on +1 end
    ctx.fillStyle = "#d63a22";
    ctx.beginPath();
    ctx.arc(cx + ux * (R - 10), cy + uy * (R - 10), 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Recent outcome flash badge (+1 / -1)
    if (pSignFlash && pSignFlash.life > 0) {
        ctx.globalAlpha = pSignFlash.life;
        ctx.fillStyle = pSignFlash.sign > 0 ? "#d63a22" : "#1d5fa7";
        ctx.font = "700 12px 'Martian Mono', monospace";
        ctx.fillText(pSignFlash.sign > 0 ? "+1" : "−1", cx - 10, cy - R - 12);
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(title, cx, cy + R + 20);
    ctx.fillStyle = "#3c4b57";
    ctx.font = "500 10px 'Martian Mono', monospace";
    ctx.fillText(sub, cx, cy + R + 36);
    ctx.textAlign = "left";
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const L = layout();
    const p = params();
    const pr = outcomeProbs(thetaA, thetaB, p);
    const S = chshValue(p);

    // Emit periodic correlated photon wavepackets
    emitTick++;
    if (emitTick >= 22) {
        emitTick = 0;
        const res = samplePair();
        pulses.push({ t: 0, res, aSign: res[0] === "p" ? 1 : -1, bSign: res[1] === "p" ? 1 : -1 });
    }

    // Beamlines from center BBO crystal to Alice & Bob
    ctx.strokeStyle = "rgba(20, 32, 43, 0.28)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(L.ax + L.dialR, L.dialY);
    ctx.lineTo(L.bx - L.dialR, L.dialY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Travelling correlated photons
    for (let i = pulses.length - 1; i >= 0; i--) {
        const q = pulses[i];
        q.t += 0.015;
        if (q.t >= 1) {
            flashes.push({ side: "a", sign: q.aSign, life: 1 });
            flashes.push({ side: "b", sign: q.bSign, life: 1 });
            pulses.splice(i, 1);
            continue;
        }
        const xLeft = L.sx - q.t * (L.sx - (L.ax + L.dialR));
        const xRight = L.sx + q.t * (L.bx - L.dialR - L.sx);
        const phase = Math.sin(q.t * Math.PI * 10) * 5;

        // Dashed entanglement tether between pair
        ctx.strokeStyle = `rgba(214, 58, 34, ${0.15 * (1 - q.t * 0.5)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xLeft, L.dialY + phase);
        ctx.lineTo(xRight, L.dialY - phase);
        ctx.stroke();

        ctx.fillStyle = q.aSign === q.bSign ? "#d63a22" : "#1d5fa7";
        ctx.beginPath();
        ctx.arc(xLeft, L.dialY + phase, 4.2, 0, Math.PI * 2);
        ctx.arc(xRight, L.dialY - phase, 4.2, 0, Math.PI * 2);
        ctx.fill();
    }

    let lastA = null, lastB = null;
    for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].life -= 0.03;
        if (flashes[i].life <= 0) flashes.splice(i, 1);
        else if (flashes[i].side === "a") lastA = flashes[i];
        else lastB = flashes[i];
    }

    // Center BBO source diamond
    const pulseR = 13 + 3 * Math.sin(performance.now() * 0.005);
    ctx.fillStyle = "rgba(214, 58, 34, 0.14)";
    ctx.beginPath();
    ctx.arc(L.sx, L.dialY, pulseR + 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#eff4e6";
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(L.sx, L.dialY - 16);
    ctx.lineTo(L.sx + 16, L.dialY);
    ctx.lineTo(L.sx, L.dialY + 16);
    ctx.lineTo(L.sx - 16, L.dialY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#14202b";
    ctx.font = "600 10px 'Martian Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("BBO |ψ⟩", L.sx, L.dialY + 34);
    ctx.fillStyle = "#3c4b57";
    ctx.fillText(`C = ${p.conc.toFixed(2)}`, L.sx, L.dialY + 49);
    ctx.textAlign = "left";

    // Draw Alice & Bob dials
    const degA = Math.round(((thetaA * 180) / Math.PI + 360) % 360);
    const degB = Math.round(((thetaB * 180) / Math.PI + 360) % 360);
    drawDial(L.ax, L.dialY, L.dialR, thetaA, `ALICE θ_a = ${degA}°`, "Drag dial", lastA);
    drawDial(L.bx, L.dialY, L.dialR, thetaB, `BOB θ_b = ${degB}°`, "Drag dial", lastB);

    // Bottom pane: CHSH Witness & Correlation Curve vs angle offset Δθ
    const cx0 = 52;
    const cy0 = L.dialY + L.dialR + 54;
    const cw = L.W - 104;
    const ch = Math.max(100, L.H - cy0 - 28);

    if (ch > 85) {
        const leftW = cw * 0.6;
        ctx.fillStyle = "rgba(239, 244, 230, 0.84)";
        ctx.fillRect(cx0, cy0, leftW, ch);
        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 1.4;
        ctx.strokeRect(cx0, cy0, leftW, ch);

        const gx = cx0 + 44, gy = cy0 + 28, gw = leftW - 64, gh = ch - 48;

        // Baseline S = 0, Classical Bell Bound S = 2, Tsirelson Bound S = 2*sqrt(2)
        const sToY = (sVal) => gy + gh * (1 - sVal / 3.1);
        const yBound = sToY(2);
        const yTsir = sToY(2 * Math.SQRT2);

        // Shaded quantum nonlocality region S > 2
        ctx.fillStyle = "rgba(214, 58, 34, 0.08)";
        ctx.fillRect(gx, gy, gw, Math.max(0, yBound - gy));

        ctx.strokeStyle = "#1d5fa7";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(gx, yBound);
        ctx.lineTo(gx + gw, yBound);
        ctx.stroke();

        ctx.strokeStyle = "rgba(20, 32, 43, 0.3)";
        ctx.beginPath();
        ctx.moveTo(gx, yTsir);
        ctx.lineTo(gx + gw, yTsir);
        ctx.stroke();
        ctx.setLineDash([]);

        // CHSH S(delta) curve across [0, 180] deg
        ctx.beginPath();
        for (let k = 0; k <= 120; k++) {
            const dRad = (k / 120) * Math.PI;
            const sVal = Math.abs(
                corrE(thetaA, thetaA + dRad, p) -
                corrE(thetaA, thetaA - dRad, p) +
                corrE(thetaA + Math.PI / 2, thetaA + dRad, p) +
                corrE(thetaA + Math.PI / 2, thetaA - dRad, p)
            );
            const px = gx + (k / 120) * gw;
            const py = sToY(sVal);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "#d63a22";
        ctx.lineWidth = 2.4;
        ctx.stroke();

        // Active operating point
        const diff = (((thetaB - thetaA) % Math.PI) + Math.PI) % Math.PI;
        const curX = gx + (diff / Math.PI) * gw;
        const curY = sToY(S);
        ctx.fillStyle = S > 2.001 ? "#d63a22" : "#1d5fa7";
        ctx.beginPath();
        ctx.arc(curX, curY, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#14202b";
        ctx.font = "600 10.5px 'Martian Mono', monospace";
        ctx.fillText("CHSH WITNESS S(θ_b − θ_a)  ·  NONLOCAL REGION S > 2 SHADED", cx0 + 12, cy0 + 18);
        ctx.fillStyle = "#1d5fa7";
        ctx.font = "500 9.5px 'Martian Mono', monospace";
        ctx.fillText("S = 2", gx - 36, yBound + 3);
        ctx.fillStyle = "#3c4b57";
        ctx.fillText("2√2", gx - 32, yTsir + 3);

        // Right card: Joint Coincidence Histogram (+1/+1, -1/-1, +1/-1, -1/+1)
        const hx0 = cx0 + leftW + 18;
        const hw = cw - leftW - 18;
        ctx.fillStyle = "rgba(239, 244, 230, 0.84)";
        ctx.fillRect(hx0, cy0, hw, ch);
        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 1.4;
        ctx.strokeRect(hx0, cy0, hw, ch);

        ctx.fillStyle = "#14202b";
        ctx.font = "600 10.5px 'Martian Mono', monospace";
        ctx.fillText(`COINCIDENCE COUNTS  E = ${pr.E.toFixed(3)}`, hx0 + 12, cy0 + 18);

        const total = Math.max(1, counts.pp + counts.mm + counts.pm + counts.mp);
        const bars = [
            { label: "++", c: counts.pp, prob: pr.pp, col: "#d63a22" },
            { label: "−−", c: counts.mm, prob: pr.mm, col: "#d63a22" },
            { label: "+−", c: counts.pm, prob: pr.pm, col: "#1d5fa7" },
            { label: "−+", c: counts.mp, prob: pr.mp, col: "#1d5fa7" },
        ];
        const barW = Math.min(48, (hw - 40) / 5);
        const gap = (hw - 28 - bars.length * barW) / (bars.length + 1);
        const barBase = cy0 + ch - 24;
        const barMaxH = ch - 58;

        bars.forEach((b, idx) => {
            const x = hx0 + 14 + gap + idx * (barW + gap);
            const empirical = b.c / total;
            const hEmp = empirical * barMaxH * 1.8;
            const hQM = b.prob * barMaxH * 1.8;

            ctx.fillStyle = b.col;
            ctx.fillRect(x, barBase - Math.min(barMaxH, hEmp), barW, Math.min(barMaxH, hEmp));

            // Analytical QM target marker line
            ctx.strokeStyle = "#14202b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 3, barBase - Math.min(barMaxH, hQM));
            ctx.lineTo(x + barW + 3, barBase - Math.min(barMaxH, hQM));
            ctx.stroke();

            ctx.fillStyle = "#14202b";
            ctx.font = "600 10px 'Martian Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText(b.label, x + barW * 0.5, barBase + 14);
        });
        ctx.textAlign = "left";
    }

    const status = S > 2.002 ? "BELL VIOLATION (NONLOCAL)" : "WITHIN CLASSICAL BOUND ≤ 2";
    document.getElementById("bell-out").textContent = `S = ${S.toFixed(3)} · E = ${pr.E.toFixed(3)} · ${status}`;
    requestAnimationFrame(draw);
}

canvas.addEventListener("mousedown", (e) => {
    const L = layout();
    if (Math.hypot(e.clientX - L.ax, e.clientY - L.dialY) <= L.dialR + 18) {
        draggingDial = "a";
    } else if (Math.hypot(e.clientX - L.bx, e.clientY - L.dialY) <= L.dialR + 18) {
        draggingDial = "b";
    }
});
window.addEventListener("mouseup", () => (draggingDial = null));
canvas.addEventListener("mousemove", (e) => {
    if (!draggingDial) return;
    const L = layout();
    const cx = draggingDial === "a" ? L.ax : L.bx;
    const ang = Math.atan2(e.clientX - cx, L.dialY - e.clientY);
    if (draggingDial === "a") thetaA = ang;
    else thetaB = ang;

    const diffDeg = Math.round(((((thetaB - thetaA) * 180) / Math.PI) % 180 + 180) % 180);
    document.getElementById("ang-slider").value = String(diffDeg);
    document.getElementById("ang-val").textContent = `${diffDeg}°`;
    clearStats();
});

document.getElementById("theta-slider").addEventListener("input", (e) => {
    thetaDeg = parseInt(e.target.value, 10);
    document.getElementById("theta-val").textContent = `${thetaDeg}°`;
    document.getElementById("conc-val").textContent = params().conc.toFixed(2);
    clearStats();
});
document.getElementById("phi-slider").addEventListener("input", (e) => {
    phiDeg = parseInt(e.target.value, 10);
    document.getElementById("phi-val").textContent = `${phiDeg}°`;
    clearStats();
});
document.getElementById("ang-slider").addEventListener("input", (e) => {
    const deg = parseInt(e.target.value, 10);
    thetaB = thetaA + (deg * Math.PI) / 180;
    document.getElementById("ang-val").textContent = `${deg}°`;
    clearStats();
});
document.getElementById("tsirelson-btn").addEventListener("click", () => {
    thetaDeg = 45; phiDeg = 0; thetaA = 0; thetaB = Math.PI / 4;
    document.getElementById("theta-slider").value = "45";
    document.getElementById("phi-slider").value = "0";
    document.getElementById("ang-slider").value = "45";
    document.getElementById("theta-val").textContent = "45°";
    document.getElementById("phi-val").textContent = "0°";
    document.getElementById("ang-val").textContent = "45°";
    document.getElementById("conc-val").textContent = "1.00";
    clearStats();
});
document.getElementById("product-btn").addEventListener("click", () => {
    thetaDeg = 0;
    document.getElementById("theta-slider").value = "0";
    document.getElementById("theta-val").textContent = "0°";
    document.getElementById("conc-val").textContent = "0.00";
    clearStats();
});
document.getElementById("reset-btn").addEventListener("click", clearStats);

draw();
