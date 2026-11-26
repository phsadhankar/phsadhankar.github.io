const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const SPECS = {
    max2: {
        name: "max2(x, y)",
        oracle: (x, y) => (x < y ? y : x),
        examples: [[-2, 3], [5, 1], [0, -1], [4, 4]],
        verifyDomain: [[-5, -2], [-1, 0], [0, 0], [3, 7], [9, -4], [2, 2]],
    },
    abs: {
        name: "abs(x)",
        oracle: (x) => (x < 0 ? -x : x),
        examples: [[-3, 0], [4, 0], [0, 0], [-1, 0]],
        verifyDomain: [[-7, 1], [-2, 5], [0, 0], [1, -3], [6, 2]],
    },
    relu: {
        name: "relu(x)",
        oracle: (x) => (x < 0 ? 0 : x),
        examples: [[-4, 1], [0, 2], [3, -1], [-1, 0]],
        verifyDomain: [[-6, 0], [-2, 3], [0, 0], [5, -1], [2, 2]],
    },
    diff: {
        name: "dist(x, y)",
        oracle: (x, y) => (x < y ? y - x : x - y),
        examples: [[1, 5], [6, 2], [-2, 1], [3, 3]],
        verifyDomain: [[-3, 4], [5, -1], [0, 0], [2, 7], [8, 3]],
    },
};

let specKey = "max2";
let useOE = true;
let levels = []; // levels[h] = [{ code, ast, sig, type, kept, isWinner }]
let prunedCount = 0;
let keptCount = 0;
let winner = null;
let cegisLog = [];
let currentExamples = [];

function evalAst(ast, x, y) {
    switch (ast.op) {
        case "var": return ast.name === "x" ? x : y;
        case "lit": return ast.val;
        case "neg": return -evalAst(ast.a, x, y);
        case "sub": return evalAst(ast.a, x, y) - evalAst(ast.b, x, y);
        case "add": return evalAst(ast.a, x, y) + evalAst(ast.b, x, y);
        case "lt": return evalAst(ast.a, x, y) < evalAst(ast.b, x, y);
        case "ite": return evalAst(ast.c, x, y) ? evalAst(ast.t, x, y) : evalAst(ast.f, x, y);
    }
}

function fmtAst(ast) {
    switch (ast.op) {
        case "var": return ast.name;
        case "lit": return String(ast.val);
        case "neg": return "-" + (ast.a.op === "sub" || ast.a.op === "add" ? `(${fmtAst(ast.a)})` : fmtAst(ast.a));
        case "sub": return `${fmtAst(ast.a)} − ${fmtAst(ast.b)}`;
        case "add": return `${fmtAst(ast.a)} + ${fmtAst(ast.b)}`;
        case "lt": return `${fmtAst(ast.a)} < ${fmtAst(ast.b)}`;
        case "ite": return `ite(${fmtAst(ast.c)}, ${fmtAst(ast.t)}, ${fmtAst(ast.f)})`;
    }
}

function initSynth() {
    const spec = SPECS[specKey];
    currentExamples = spec.examples.slice(0, 2);
    resetBank();
}

function resetBank() {
    const spec = SPECS[specKey];
    const seenInt = new Set();
    const seenBool = new Set();
    prunedCount = 0;
    keptCount = 0;
    winner = null;
    cegisLog = [`Seeds: ${currentExamples.map(([x, y]) => `(${x},${y})↦${spec.oracle(x, y)}`).join(", ")}`];

    const h1 = [];
    const baseAsts = [
        { op: "var", name: "x", ty: "int" },
        { op: "var", name: "y", ty: "int" },
        { op: "lit", val: 0, ty: "int" },
        { op: "lit", val: 1, ty: "int" },
    ];
    for (const ast of baseAsts) {
        const sig = currentExamples.map(([x, y]) => evalAst(ast, x, y));
        const key = sig.join(",");
        seenInt.add(key);
        const node = { ast, code: fmtAst(ast), ty: "int", sig, kept: true, level: 0 };
        h1.push(node);
        keptCount++;
        checkCandidate(node);
    }
    levels = [h1];
    levels._seenInt = seenInt;
    levels._seenBool = seenBool;
    updateReadout();
}

function checkCandidate(node) {
    if (winner || node.ty !== "int") return;
    const spec = SPECS[specKey];
    const matchesExamples = currentExamples.every(([x, y], idx) => node.sig[idx] === spec.oracle(x, y));
    if (!matchesExamples) return;

    // Counterexample verifier over full domain
    const cex = spec.verifyDomain.find(([x, y]) => evalAst(node.ast, x, y) !== spec.oracle(x, y));
    if (!cex) {
        node.isWinner = true;
        winner = node;
        cegisLog.push(`✓ Verified: ${node.code} across all test points`);
    } else if (!currentExamples.some(([x, y]) => x === cex[0] && y === cex[1])) {
        cegisLog.push(`✗ Rejected ${node.code} via CEX (${cex[0]},${cex[1]})↦${spec.oracle(cex[0], cex[1])}`);
        currentExamples.push(cex);
    }
}

function expandDepth() {
    if (winner || levels.length >= 3) return;
    const h = levels.length;
    const prevAll = levels.flat().filter((n) => n.kept);
    const ints = prevAll.filter((n) => n.ty === "int");
    const bools = prevAll.filter((n) => n.ty === "bool");
    const seenInt = levels._seenInt;
    const seenBool = levels._seenBool;
    const batch = [];

    function tryAdd(ast, ty) {
        if (batch.length > 260) return;
        const sig = currentExamples.map(([x, y]) => evalAst(ast, x, y));
        const key = sig.join(",");
        const seen = ty === "int" ? seenInt : seenBool;
        if (useOE && seen.has(key)) {
            prunedCount++;
            if (batch.filter((n) => !n.kept).length < 18) {
                batch.push({ ast, code: fmtAst(ast), ty, sig, kept: false, level: h });
            }
            return;
        }
        seen.add(key);
        keptCount++;
        const node = { ast, code: fmtAst(ast), ty, sig, kept: true, level: h };
        batch.push(node);
        checkCandidate(node);
    }

    // Unary neg
    for (const a of ints) {
        if (winner) break;
        if (a.ast.op !== "neg") tryAdd({ op: "neg", a: a.ast }, "int");
    }
    // Binary sub & lt
    for (const a of ints) {
        for (const b of ints) {
            if (winner) break;
            if (a !== b) {
                tryAdd({ op: "sub", a: a.ast, b: b.ast }, "int");
                tryAdd({ op: "lt", a: a.ast, b: b.ast }, "bool");
            }
        }
    }
    // ite(bool, int, int)
    for (const c of bools) {
        for (const t of ints) {
            for (const f of ints) {
                if (winner) break;
                if (t !== f) {
                    tryAdd({ op: "ite", c: c.ast, t: t.ast, f: f.ast }, "int");
                }
            }
        }
    }

    levels.push(batch);
    updateReadout();
}

function solveCegis() {
    for (let round = 0; round < 4; round++) {
        resetBank();
        for (let d = 0; d < 2 && !winner; d++) expandDepth();
        if (winner) break;
    }
    updateReadout();
}

function updateReadout() {
    const spec = SPECS[specKey];
    const out = document.getElementById("synth-out");
    if (winner) {
        out.textContent = `${spec.name} := ${winner.code}\nKept ${keptCount} · OE-Pruned ${prunedCount}`;
    } else {
        out.textContent = `Depth ${levels.length}/3 · Kept ${keptCount} · Pruned ${prunedCount}\nStep depth to expand search`;
    }
}

// ---------- Canvas Visualization ----------

function astMeasure(ast) {
    if (ast.op === "var" || ast.op === "lit") return { ast, ch: [], w: 1 };
    if (ast.op === "neg") {
        const a = astMeasure(ast.a);
        return { ast, ch: [a], w: a.w };
    }
    if (ast.op === "sub" || ast.op === "add" || ast.op === "lt") {
        const a = astMeasure(ast.a), b = astMeasure(ast.b);
        return { ast, ch: [a, b], w: a.w + b.w };
    }
    const c = astMeasure(ast.c), t = astMeasure(ast.t), f = astMeasure(ast.f);
    return { ast, ch: [c, t, f], w: c.w + t.w + f.w };
}

function astLayout(m, x0, x1, y, dy, out = []) {
    const cx = (x0 + x1) * 0.5;
    const node = { ast: m.ast, x: cx, y, children: [] };
    out.push(node);
    let curX = x0;
    for (const ch of m.ch) {
        const span = ((x1 - x0) * ch.w) / m.w;
        node.children.push(astLayout(ch, curX, curX + span, y + dy, dy, out));
        curX += span;
    }
    return node;
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

initSynth();
solveCegis();

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width;
    const H = canvas.height;
    const spec = SPECS[specKey];

    const pad = 34;
    const splitX = W * 0.48;

    // Left frame: Synthesized AST + Specification check table
    const lx = pad, ly = 44, lw = splitX - pad - 14, lh = H - 80;
    ctx.fillStyle = "rgba(239, 244, 230, 0.78)";
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lx, ly, lw, lh);

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText(`SYNTHESIZED PROGRAM  ·  ${spec.name}`, lx + 14, ly + 22);

    const dispAst = winner ? winner.ast : levels[levels.length - 1]?.[0]?.ast;
    if (dispAst) {
        const measured = astMeasure(dispAst);
        const flat = [];
        astLayout(measured, lx + 30, lx + lw - 30, ly + 72, 64, flat);

        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 1.5;
        for (const it of flat) {
            for (const c of it.children) {
                ctx.beginPath();
                ctx.moveTo(it.x, it.y);
                ctx.lineTo(c.x, c.y);
                ctx.stroke();
            }
        }
        for (const it of flat) {
            const label =
                it.ast.op === "var" ? it.ast.name :
                it.ast.op === "lit" ? String(it.ast.val) :
                it.ast.op === "sub" ? "−" :
                it.ast.op === "lt" ? "<" :
                it.ast.op === "neg" ? "neg" : it.ast.op;
            const isLeaf = it.ast.op === "var" || it.ast.op === "lit";
            ctx.fillStyle = it.ast.op === "ite" ? "#d63a22" : isLeaf ? "#eff4e6" : "#1d5fa7";
            if (isLeaf) {
                ctx.fillRect(it.x - 16, it.y - 12, 32, 24);
                ctx.strokeStyle = "#14202b";
                ctx.strokeRect(it.x - 16, it.y - 12, 32, 24);
                ctx.fillStyle = "#14202b";
            } else {
                ctx.beginPath();
                ctx.arc(it.x, it.y, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#eff4e6";
            }
            ctx.font = "600 11px 'Martian Mono', monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, it.x, it.y + 1);
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    }

    // Bottom left: CEGIS I/O & counterexample table
    const ty = ly + lh * 0.56;
    ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
    ctx.beginPath();
    ctx.moveTo(lx + 14, ty);
    ctx.lineTo(lx + lw - 14, ty);
    ctx.stroke();

    ctx.fillStyle = "#14202b";
    ctx.font = "600 10.5px 'Martian Mono', monospace";
    ctx.fillText("CEGIS SPECIFICATION TRACE", lx + 14, ty + 20);

    cegisLog.slice(-5).forEach((line, idx) => {
        ctx.fillStyle = line.startsWith("✓") ? "#1d5fa7" : line.startsWith("✗") ? "#d63a22" : "#14202b";
        ctx.font = "500 10.5px 'Martian Mono', monospace";
        ctx.fillText(line.slice(0, 56), lx + 14, ty + 42 + idx * 18);
    });

    // Example verification grid
    const ey = ty + 142;
    spec.examples.forEach(([x, y], i) => {
        const rowY = ey + i * 20;
        if (rowY > ly + lh - 12) return;
        const target = spec.oracle(x, y);
        const got = winner ? evalAst(winner.ast, x, y) : "—";
        ctx.fillStyle = "#14202b";
        ctx.fillText(`(${x}, ${y}) ↦ ${target}`, lx + 14, rowY);
        ctx.fillStyle = got === target ? "#1d5fa7" : "#3c4b57";
        ctx.fillText(`eval = ${got}`, lx + lw * 0.55, rowY);
    });

    // Right frame: Bottom-up Enumerative Lattice + OE Signatures
    const rx = splitX + 8, ry = 44, rw = W - rx - pad, rh = H - 80;
    ctx.fillStyle = "rgba(239, 244, 230, 0.78)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText(`ENUMERATIVE BANK  (KEPT ${keptCount} · PRUNED ${prunedCount})`, rx + 14, ry + 22);

    let cursorY = ry + 48;
    levels.forEach((lvl, h) => {
        ctx.fillStyle = "#d63a22";
        ctx.font = "600 10.5px 'Martian Mono', monospace";
        const keptInLvl = lvl.filter((n) => n.kept).length;
        ctx.fillText(`HEIGHT ${h + 1} (${keptInLvl} equivalence classes)`, rx + 14, cursorY);
        cursorY += 12;

        let cx = rx + 14;
        const shown = lvl.slice(0, h === 2 ? 18 : 14);
        if (winner && winner.level === h && !shown.includes(winner)) {
            shown[shown.length - 1] = winner;
        }
        shown.forEach((n) => {
            const label = n.code.length > 22 ? n.code.slice(0, 20) + "…" : n.code;
            const chipW = Math.min(rw - 30, label.length * 6.8 + 16);
            if (cx + chipW > rx + rw - 14) {
                cx = rx + 14;
                cursorY += 26;
            }
            if (cursorY > ry + rh - 28) return;

            ctx.fillStyle = n.isWinner ? "#d63a22" : n.kept ? "#eff4e6" : "rgba(20, 32, 43, 0.06)";
            ctx.fillRect(cx, cursorY, chipW, 20);
            ctx.strokeStyle = n.isWinner ? "#d63a22" : n.kept ? (n.ty === "bool" ? "#1d5fa7" : "#14202b") : "rgba(20, 32, 43, 0.25)";
            ctx.lineWidth = n.isWinner ? 2 : 1;
            ctx.strokeRect(cx, cursorY, chipW, 20);

            ctx.fillStyle = n.isWinner ? "#eff4e6" : n.kept ? "#14202b" : "rgba(60, 75, 87, 0.65)";
            ctx.font = "500 10px 'Martian Mono', monospace";
            ctx.fillText(label, cx + 8, cursorY + 13);
            if (!n.kept) {
                // strike through pruned expressions
                ctx.strokeStyle = "rgba(214, 58, 34, 0.6)";
                ctx.beginPath();
                ctx.moveTo(cx + 5, cursorY + 10);
                ctx.lineTo(cx + chipW - 5, cursorY + 10);
                ctx.stroke();
            }
            cx += chipW + 6;
        });
        cursorY += 40;
    });

    requestAnimationFrame(draw);
}

document.getElementById("spec-sel").addEventListener("change", (e) => {
    specKey = e.target.value;
    initSynth();
    solveCegis();
});
document.getElementById("oe-toggle").addEventListener("click", (e) => {
    useOE = !useOE;
    e.target.textContent = "OE Pruning: " + (useOE ? "ON" : "OFF");
    e.target.classList.toggle("active", useOE);
    initSynth();
    solveCegis();
});
document.getElementById("step-btn").addEventListener("click", expandDepth);
document.getElementById("run-btn").addEventListener("click", solveCegis);
document.getElementById("reset-btn").addEventListener("click", () => {
    initSynth();
});

draw();
