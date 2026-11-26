const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let benchId = "queens4";
let speed = 3;
let running = true;

let numVars = 0;
let baseClauses = [];
let clauses = [];
let learnedCount = 0;

// CDCL Solver State
let assign = []; // 0 = undef, +1 = true, -1 = false
let level = [];
let reason = []; // clause index or -1 if decision
let trail = [];
let decLevel = 0;
let qHead = 0;
let status = "SOLVING"; // SOLVING | SAT | UNSAT
let dwellTicks = 0;

// Kinetic Visual Effects
let propArcs = []; // { fromVar, toVar, life, kind: 'prop'|'conflict' }
let nodePulse = [];
let learnedBanner = "";
let stepAcc = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function makeQueens4() {
    // 16 vars: row r (0..3), col c (0..3) => var = r*4 + c + 1
    const v = (r, c) => r * 4 + c + 1;
    const cs = [];
    for (let r = 0; r < 4; r++) {
        cs.push([v(r, 0), v(r, 1), v(r, 2), v(r, 3)]);
        for (let c1 = 0; c1 < 4; c1++)
            for (let c2 = c1 + 1; c2 < 4; c2++) cs.push([-v(r, c1), -v(r, c2)]);
    }
    for (let c = 0; c < 4; c++) {
        for (let r1 = 0; r1 < 4; r1++)
            for (let r2 = r1 + 1; r2 < 4; r2++) cs.push([-v(r1, c), -v(r2, c)]);
    }
    for (let r1 = 0; r1 < 4; r1++)
        for (let c1 = 0; c1 < 4; c1++)
            for (let r2 = r1 + 1; r2 < 4; r2++)
                for (let c2 = 0; c2 < 4; c2++)
                    if (Math.abs(r1 - r2) === Math.abs(c1 - c2)) cs.push([-v(r1, c1), -v(r2, c2)]);
    return { n: 16, cs };
}

function makeK4Color3() {
    // 4 vertices x 3 colors = 12 vars (UNSAT!)
    const v = (u, k) => u * 3 + k + 1;
    const cs = [];
    for (let u = 0; u < 4; u++) {
        cs.push([v(u, 0), v(u, 1), v(u, 2)]);
        for (let a = 0; a < 3; a++)
            for (let b = a + 1; b < 3; b++) cs.push([-v(u, a), -v(u, b)]);
    }
    for (let u = 0; u < 4; u++)
        for (let w = u + 1; w < 4; w++)
            for (let k = 0; k < 3; k++) cs.push([-v(u, k), -v(w, k)]);
    return { n: 12, cs };
}

function makePHP34() {
    // 4 pigeons into 3 holes = 12 vars (UNSAT!)
    const v = (p, h) => p * 3 + h + 1;
    const cs = [];
    for (let p = 0; p < 4; p++) cs.push([v(p, 0), v(p, 1), v(p, 2)]);
    for (let h = 0; h < 3; h++)
        for (let p1 = 0; p1 < 4; p1++)
            for (let p2 = p1 + 1; p2 < 4; p2++) cs.push([-v(p1, h), -v(p2, h)]);
    return { n: 12, cs };
}

function makeRand3() {
    const n = 14;
    const cs = [];
    let seed = 4219;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let m = 0; m < 58; m++) {
        const picked = new Set();
        while (picked.size < 3) picked.add(1 + Math.floor(rng() * n));
        cs.push([...picked].map((vr) => (rng() < 0.5 ? vr : -vr)));
    }
    return { n, cs };
}

function litVal(lit) {
    const vr = Math.abs(lit);
    const a = assign[vr];
    if (a === 0) return 0;
    return lit > 0 ? a : -a;
}

function initSolver() {
    const spec =
        benchId === "queens4"
            ? makeQueens4()
            : benchId === "k4color"
            ? makeK4Color3()
            : benchId === "php34"
            ? makePHP34()
            : makeRand3();
    numVars = spec.n;
    baseClauses = spec.cs;
    clauses = spec.cs.map((c) => [...c]);
    learnedCount = 0;

    assign = new Array(numVars + 1).fill(0);
    level = new Array(numVars + 1).fill(-1);
    reason = new Array(numVars + 1).fill(-1);
    trail = [];
    decLevel = 0;
    qHead = 0;
    status = "SOLVING";
    dwellTicks = 0;
    propArcs = [];
    nodePulse = new Array(numVars + 1).fill(0);
    learnedBanner = "Initial CNF loaded";
}

function enqueue(lit, dl, rsnIdx, triggerVar = 0) {
    const vr = Math.abs(lit);
    assign[vr] = lit > 0 ? 1 : -1;
    level[vr] = dl;
    reason[vr] = rsnIdx;
    trail.push(lit);
    nodePulse[vr] = 1;
    if (triggerVar > 0 && triggerVar !== vr) {
        propArcs.push({ fromVar: triggerVar, toVar: vr, life: 1, kind: "prop" });
    }
}

function resolveClause(c1, c2, pivotVar) {
    const s = new Set();
    for (const l of c1) if (Math.abs(l) !== pivotVar) s.add(l);
    for (const l of c2) if (Math.abs(l) !== pivotVar) s.add(l);
    return [...s];
}

function analyzeConflict(confIdx) {
    let learnt = [...clauses[confIdx]];
    let countAtLevel = 0;
    const seen = new Set();
    let tIdx = trail.length - 1;

    // 1-UIP resolution loop along trail
    const tally = () => {
        countAtLevel = 0;
        for (const l of learnt) if (level[Math.abs(l)] === decLevel) countAtLevel++;
    };
    tally();

    let safetyGuard = 0;
    while (countAtLevel > 1 && tIdx >= 0 && safetyGuard++ < 64) {
        const pLit = trail[tIdx--];
        const pVar = Math.abs(pLit);
        if (!learnt.some((l) => Math.abs(l) === pVar)) continue;
        const rIdx = reason[pVar];
        if (rIdx < 0) continue;
        learnt = resolveClause(learnt, clauses[rIdx], pVar);
        // Remove tautologies
        if (learnt.some((l) => learnt.includes(-l))) break;
        tally();
    }

    // Visual conflict flashes among conflict literals
    const cLits = clauses[confIdx];
    for (let i = 0; i < cLits.length; i++) {
        nodePulse[Math.abs(cLits[i])] = 1.2;
        if (i > 0) {
            propArcs.push({
                fromVar: Math.abs(cLits[i - 1]),
                toVar: Math.abs(cLits[i]),
                life: 1.25,
                kind: "conflict",
            });
        }
    }

    if (learnt.length === 0) return { empty: true, learnt, backLevel: -1, uipLit: 0 };

    let maxOther = 0;
    let uipLit = learnt[0];
    for (const l of learnt) {
        const dl = level[Math.abs(l)];
        if (dl === decLevel) uipLit = l;
        else if (dl > maxOther) maxOther = dl;
    }
    return { empty: false, learnt, backLevel: learnt.length === 1 ? 0 : maxOther, uipLit };
}

function backjump(targetLevel) {
    while (trail.length > 0) {
        const lastLit = trail[trail.length - 1];
        const vr = Math.abs(lastLit);
        if (level[vr] <= targetLevel) break;
        trail.pop();
        assign[vr] = 0;
        level[vr] = -1;
        reason[vr] = -1;
    }
    decLevel = targetLevel;
    qHead = trail.length;
}

function stepCDCL() {
    if (status !== "SOLVING") return;

    // 1) One step of Unit Propagation (BCP) if pending, or full check
    if (qHead < trail.length) {
        qHead = trail.length;
    }

    // Scan clauses for conflict or unit
    let unitFound = null;
    for (let ci = 0; ci < clauses.length; ci++) {
        const c = clauses[ci];
        let sat = false;
        let undefLit = 0;
        let undefCount = 0;
        let triggerVar = 0;
        for (const l of c) {
            const val = litVal(l);
            if (val === 1) { sat = true; break; }
            if (val === 0) { undefLit = l; undefCount++; }
            else triggerVar = Math.abs(l);
        }
        if (sat) continue;
        if (undefCount === 0) {
            // CONFLICT!
            if (decLevel === 0) {
                status = "UNSAT";
                learnedBanner = "CONFLICT AT LEVEL 0 ⇒ ⊥ UNSAT PROVEN";
                return;
            }
            const res = analyzeConflict(ci);
            if (res.empty) {
                status = "UNSAT";
                learnedBanner = "EMPTY CLAUSE ⊥ DERIVED ⇒ UNSAT";
                return;
            }
            clauses.push(res.learnt);
            learnedCount++;
            learnedBanner = `Learned (${res.learnt.map((l) => (l > 0 ? `x${l}` : `¬x${-l}`)).join(" ∨ ")}) · Jump → d${res.backLevel}`;
            backjump(res.backLevel);
            enqueue(res.uipLit, res.backLevel, clauses.length - 1);
            return;
        }
        if (undefCount === 1 && unitFound === null) {
            unitFound = { lit: undefLit, ci, triggerVar };
        }
    }

    if (unitFound) {
        enqueue(unitFound.lit, decLevel, unitFound.ci, unitFound.triggerVar);
        learnedBanner = `BCP forced ${unitFound.lit > 0 ? `x${unitFound.lit}` : `¬x${-unitFound.lit}`} @ d${decLevel}`;
        return;
    }

    // 2) Decide next unassigned variable (prefer variables in shortest unresolved clauses / VSIDS-lite)
    let pick = 0;
    for (let vr = 1; vr <= numVars; vr++) {
        if (assign[vr] === 0) { pick = vr; break; }
    }
    if (pick === 0) {
        status = "SAT";
        learnedBanner = "ALL CLAUSES SATISFIED · MODEL FOUND (SAT)";
        return;
    }
    decLevel++;
    // Decision polarity alternates slightly to showcase backtracking before converging
    const pol = (decLevel + learnedCount) % 2 === 1 ? 1 : -1;
    enqueue(pick * pol, decLevel, -1);
    learnedBanner = `Decide ${pol > 0 ? `x${pick}` : `¬x${pick}`} @ d${decLevel}`;
}

initSolver();
// Warm up 5 steps so initial render is actively solving cleanly
for (let i = 0; i < 5; i++) stepCDCL();

function varPos(vr, cx, cy, Rx, Ry, now) {
    const ang = ((vr - 1) / numVars) * Math.PI * 2 - Math.PI / 2;
    const wob = Math.sin(now * 0.0014 + vr * 0.9) * 5;
    return {
        x: cx + Math.cos(ang) * (Rx + wob),
        y: cy + Math.sin(ang) * (Ry + wob),
    };
}

function draw() {
    const now = performance.now();
    if (running) {
        if (status === "SOLVING") {
            stepAcc++;
            const interval = [28, 18, 10, 5, 2][speed - 1];
            if (stepAcc >= interval) {
                stepAcc = 0;
                stepCDCL();
            }
        } else {
            dwellTicks++;
            if (dwellTicks > 190) initSolver();
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;
    const embedded =
        document.documentElement.classList.contains("embed") ||
        document.documentElement.classList.contains("panels-hidden");
    const topY = embedded || H < 680 ? 34 : 205;

    const cx = W * 0.5;
    const cy = topY + (H - topY - 82) * 0.52;
    const Rx = Math.min(340, W * 0.34);
    const Ry = Math.min(200, (H - topY - 100) * 0.44);

    // Draw clause chord web gently behind variable ring
    let satClauses = 0;
    clauses.forEach((c, ci) => {
        let isSat = false, hasConflict = true;
        for (const l of c) {
            const v = litVal(l);
            if (v === 1) isSat = true;
            if (v !== -1) hasConflict = false;
        }
        if (isSat) satClauses++;

        const isLearned = ci >= baseClauses.length;
        if (c.length < 2) return;
        const p0 = varPos(Math.abs(c[0]), cx, cy, Rx, Ry, now);
        const p1 = varPos(Math.abs(c[1]), cx, cy, Rx, Ry, now);

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(cx, cy, p1.x, p1.y);
        if (hasConflict) {
            ctx.strokeStyle = "rgba(214, 58, 34, 0.72)";
            ctx.lineWidth = 2.1;
        } else if (isLearned) {
            ctx.strokeStyle = "rgba(29, 95, 167, 0.32)";
            ctx.lineWidth = 1.25;
        } else if (isSat) {
            ctx.strokeStyle = "rgba(58, 108, 78, 0.22)";
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = "rgba(20, 32, 43, 0.14)";
            ctx.lineWidth = 1;
        }
        ctx.stroke();
    });

    // Animated propagation & conflict lightning arcs
    for (let i = propArcs.length - 1; i >= 0; i--) {
        const a = propArcs[i];
        a.life -= 0.035;
        if (a.life <= 0) { propArcs.splice(i, 1); continue; }
        const p1 = varPos(a.fromVar, cx, cy, Rx, Ry, now);
        const p2 = varPos(a.toVar, cx, cy, Rx, Ry, now);
        ctx.strokeStyle =
            a.kind === "conflict"
                ? `rgba(214, 58, 34, ${Math.min(1, a.life)})`
                : `rgba(29, 95, 167, ${Math.min(1, a.life)})`;
        ctx.lineWidth = a.kind === "conflict" ? 3 : 2.2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
        ctx.stroke();
    }

    // Variable nodes around ring
    const R = 20;
    for (let vr = 1; vr <= numVars; vr++) {
        const p = varPos(vr, cx, cy, Rx, Ry, now);
        const a = assign[vr];
        if (nodePulse[vr] > 0) {
            ctx.strokeStyle = a === -1 ? `rgba(214, 58, 34, ${nodePulse[vr] * 0.7})` : `rgba(29, 95, 167, ${nodePulse[vr] * 0.7})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, R + (1.3 - nodePulse[vr]) * 14, 0, Math.PI * 2);
            ctx.stroke();
            nodePulse[vr] = Math.max(0, nodePulse[vr] - 0.035);
        }

        ctx.fillStyle = a === 1 ? "#1d5fa7" : a === -1 ? "#d63a22" : "#eff4e6";
        ctx.beginPath();
        ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = reason[vr] === -1 && a !== 0 ? "#14202b" : "rgba(20, 32, 43, 0.45)";
        ctx.lineWidth = reason[vr] === -1 && a !== 0 ? 2.4 : 1.3;
        ctx.stroke();

        ctx.fillStyle = a !== 0 ? "#eff4e6" : "#14202b";
        ctx.font = "700 9.5px 'Martian Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`x${vr}`, p.x, p.y - 1);
        ctx.font = "500 8px 'Martian Mono', monospace";
        ctx.fillText(a === 1 ? `T@d${level[vr]}` : a === -1 ? `F@d${level[vr]}` : "?", p.x, p.y + 10);
    }
    ctx.textAlign = "left";

    // Center live ratio dial
    const ratio = satClauses / Math.max(1, clauses.length);
    ctx.fillStyle = "#14202b";
    ctx.font = "700 13px 'Martian Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${satClauses} / ${clauses.length} CLAUSES`, cx, cy - 6);
    ctx.fillStyle = status === "UNSAT" ? "#d63a22" : status === "SAT" ? "#1d5fa7" : "#3c4b57";
    ctx.font = "600 10.5px 'Martian Mono', monospace";
    ctx.fillText(`DEC LEVEL d = ${decLevel}  ·  LEARNED ${learnedCount}`, cx, cy + 14);
    ctx.textAlign = "left";

    // Bottom trail / learned banner bar
    const bw = Math.min(640, W - 72);
    const bx = (W - bw) * 0.5;
    ctx.fillStyle = "rgba(239, 244, 230, 0.9)";
    ctx.fillRect(bx, H - 56, bw, 36);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(bx, H - 56, bw, 36);

    ctx.fillStyle = "#1d5fa7";
    ctx.fillRect(bx + 2, H - 54, (bw - 4) * ratio, 4);

    ctx.fillStyle = status === "UNSAT" ? "#d63a22" : "#14202b";
    ctx.font = "600 10.5px 'Martian Mono', monospace";
    ctx.fillText(learnedBanner, bx + 12, H - 30);

    document.getElementById("sat-out").textContent = `${status} · d=${decLevel} · ${learnedCount} learned`;
    requestAnimationFrame(draw);
}

document.getElementById("bench-sel").addEventListener("change", (e) => {
    benchId = e.target.value;
    initSolver();
});
document.getElementById("speed-slider").addEventListener("input", (e) => {
    speed = parseInt(e.target.value, 10);
    document.getElementById("speed-val").textContent = ["Slow", "Moderate", "Normal", "Fast", "Turbo"][speed - 1];
});
document.getElementById("play-btn").addEventListener("click", (e) => {
    running = !running;
    e.target.textContent = running ? "Running" : "Paused";
    e.target.classList.toggle("active", running);
});
document.getElementById("step-btn").addEventListener("click", () => {
    stepCDCL();
});
document.getElementById("reset-btn").addEventListener("click", initSolver);

draw();
