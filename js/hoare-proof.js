const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const PROGRAMS = {
    sum: {
        title: "Sum 1..n",
        pre: "{ n ≥ 0 }",
        initLabel: "i := 0; s := 0;",
        guardLabel: "while i < n",
        invGood: "{ 0 ≤ i ≤ n ∧ s = i(i + 1)/2 }",
        invBad: "{ 0 ≤ i < n ∧ s = i(i + 1)/2 }  [too strong at exit!]",
        bodyLabel: "i := i + 1; s := s + i",
        post: "{ s = n(n + 1)/2 }",
        xLabel: "i (counter)",
        yLabel: "s (accumulator)",
        vcs(bug) {
            return [
                { name: "VC₁ Entry", expr: "n ≥ 0 ⇒ 0 ≤ 0 ≤ n ∧ 0 = 0", ok: true },
                { name: "VC₂ Step", expr: "(I ∧ i < n) ⇒ s+(i+1) = (i+1)(i+2)/2", ok: !bug },
                { name: "VC₃ Exit", expr: "(I ∧ ¬(i < n)) ⇒ s = n(n+1)/2", ok: !bug, cex: "i = n violates 0 ≤ i < n" },
            ];
        },
        run(n, bug) {
            let i = 0, s = 0;
            const states = [{ step: 0, x: i, y: s, ok: true, label: `i=0, s=0` }];
            while (i < n && states.length < 30) {
                i++;
                s += i;
                const invOk = bug ? i < n && s === (i * (i + 1)) / 2 : i <= n && s === (i * (i + 1)) / 2;
                states.push({ step: states.length, x: i, y: s, ok: invOk, label: `i=${i}, s=${s}` });
            }
            return {
                states,
                maxX: n,
                maxY: Math.max(1, (n * (n + 1)) / 2),
                curve: (x) => (x * (x + 1)) / 2,
            };
        },
    },
    pow: {
        title: "Fast Exponentiation (2^e)",
        pre: "{ e₀ ≥ 0 }",
        initLabel: "r := 1; b := 2; e := e₀;",
        guardLabel: "while e > 0",
        invGood: "{ r · b^e = 2^e₀ ∧ e ≥ 0 }",
        invBad: "{ r · b^e = 2^e₀ ∧ e > 0 }  [fails when e = 0]",
        bodyLabel: "if odd(e) then r := r·b; b := b²; e := ⌊e/2⌋",
        post: "{ r = 2^e₀ }",
        xLabel: "step k",
        yLabel: "r · b^e (conserved)",
        vcs(bug) {
            return [
                { name: "VC₁ Entry", expr: "e₀ ≥ 0 ⇒ 1 · 2^e₀ = 2^e₀", ok: true },
                { name: "VC₂ Step", expr: "(I ∧ e > 0) ⇒ r'·(b²)^⌊e/2⌋ = 2^e₀", ok: !bug },
                { name: "VC₃ Exit", expr: "(I ∧ e = 0) ⇒ r = 2^e₀", ok: !bug, cex: "e = 0 contradicts e > 0" },
            ];
        },
        run(e0, bug) {
            let r = 1, b = 2, e = e0;
            const target = Math.pow(2, e0);
            const states = [{ step: 0, x: 0, y: r * Math.pow(b, e), ok: true, label: `r=${r}, e=${e}` }];
            while (e > 0 && states.length < 20) {
                if (e % 2 === 1) r *= b;
                b *= b;
                e = Math.floor(e / 2);
                const val = r * Math.pow(b, e);
                const ok = bug ? e > 0 && val === target : e >= 0 && val === target;
                states.push({ step: states.length, x: states.length - 1, y: val, ok, label: `r=${r}, e=${e}` });
            }
            return {
                states,
                maxX: Math.max(1, states.length - 1),
                maxY: target * 1.25,
                curve: () => target,
            };
        },
    },
    div: {
        title: "Euclidean Quotient (b = 3)",
        pre: "{ a ≥ 0 ∧ b = 3 }",
        initLabel: "q := 0; r := a;",
        guardLabel: "while r ≥ b",
        invGood: "{ a = q·b + r ∧ r ≥ 0 }",
        invBad: "{ a = q·b + r ∧ r ≥ b }  [fails at last step]",
        bodyLabel: "q := q + 1; r := r − b",
        post: "{ a = q·b + r ∧ 0 ≤ r < b }",
        xLabel: "q (quotient)",
        yLabel: "r (remainder)",
        vcs(bug) {
            return [
                { name: "VC₁ Entry", expr: "a ≥ 0 ⇒ a = 0·b + a ∧ a ≥ 0", ok: true },
                { name: "VC₂ Step", expr: "(I ∧ r ≥ b) ⇒ (q+1)b + (r−b) = a", ok: !bug },
                { name: "VC₃ Exit", expr: "(I ∧ r < b) ⇒ 0 ≤ r < b", ok: !bug, cex: "r < b breaks r ≥ b" },
            ];
        },
        run(n, bug) {
            const a = n * 2 + 4, b = 3;
            let q = 0, r = a;
            const states = [{ step: 0, x: q, y: r, ok: true, label: `q=0, r=${r}` }];
            while (r >= b && states.length < 25) {
                q += 1;
                r -= b;
                const ok = bug ? r >= b && q * b + r === a : r >= 0 && q * b + r === a;
                states.push({ step: states.length, x: q, y: r, ok, label: `q=${q}, r=${r}` });
            }
            return {
                states,
                maxX: Math.max(1, q),
                maxY: a,
                curve: (x) => a - x * b,
            };
        },
    },
    gcd: {
        title: "Euclidean GCD",
        pre: "{ a₀ > 0 ∧ b₀ > 0 }",
        initLabel: "a := F(n+3); b := F(n+2);",
        guardLabel: "while b ≠ 0",
        invGood: "{ gcd(a, b) = gcd(a₀, b₀) }",
        invBad: "{ gcd(a, b) = gcd(a₀, b₀) ∧ b > 0 }",
        bodyLabel: "(a, b) := (b, a mod b)",
        post: "{ a = gcd(a₀, b₀) }",
        xLabel: "step k",
        yLabel: "b (decreasing mod)",
        vcs(bug) {
            return [
                { name: "VC₁ Entry", expr: "gcd(a₀, b₀) = gcd(a₀, b₀)", ok: true },
                { name: "VC₂ Step", expr: "b ≠ 0 ⇒ gcd(b, a mod b) = gcd(a, b)", ok: !bug },
                { name: "VC₃ Exit", expr: "(I ∧ b = 0) ⇒ a = gcd(a₀, b₀)", ok: !bug, cex: "b = 0 fails b > 0" },
            ];
        },
        run(n, bug) {
            let f0 = 1, f1 = 1;
            for (let k = 0; k < n + 2; k++) { const t = f0 + f1; f0 = f1; f1 = t; }
            let a = f1, b = f0;
            const states = [{ step: 0, x: 0, y: b, ok: true, label: `a=${a}, b=${b}` }];
            while (b !== 0 && states.length < 25) {
                const t = a % b;
                a = b;
                b = t;
                const ok = bug ? b > 0 : b >= 0;
                states.push({ step: states.length, x: states.length - 1, y: b, ok, label: `a=${a}, b=${b}` });
            }
            return {
                states,
                maxX: Math.max(1, states.length - 1),
                maxY: f0,
                curve: (x) => f0 * Math.pow(0.618, x),
            };
        },
    },
};

let progKey = "sum";
let param = 6;
let bugInjected = false;
let simData = null;
let traceIdx = 0;

function rebuild(startFull = true) {
    simData = PROGRAMS[progKey].run(param, bugInjected);
    traceIdx = startFull ? simData.states.length - 1 : 0;
    const vcs = PROGRAMS[progKey].vcs(bugInjected);
    const bad = vcs.find((v) => !v.ok);
    const out = document.getElementById("vc-out");
    document.getElementById("param-val").textContent = param;
    if (bad) {
        out.textContent = `✗ ${bad.name} FAILED\nCEX: ${bad.cex || "Invariant falsified"}`;
    } else {
        out.textContent = `✓ All 3 VCs discharged · Q.E.D.\nTrace ${traceIdx}/${simData.states.length - 1} (${simData.states[traceIdx].label})`;
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
rebuild(true);

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width;
    const H = canvas.height;
    const p = PROGRAMS[progKey];
    const vcs = p.vcs(bugInjected);

    const pad = 34;
    const splitX = W * 0.48;

    // Left frame: Proof Outline & VCs
    const lx = pad, ly = 44, lw = splitX - pad - 12, lh = H - 80;
    ctx.fillStyle = "rgba(239, 244, 230, 0.8)";
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lx, ly, lw, lh);

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText(`ANNOTATED PROOF OUTLINE · ${p.title.toUpperCase()}`, lx + 14, ly + 22);

    const codeLines = [
        { txt: p.pre, kind: "assert" },
        { txt: p.initLabel, kind: "code" },
        { txt: p.guardLabel, kind: "code" },
        { txt: "  inv " + (bugInjected ? p.invBad : p.invGood), kind: bugInjected ? "bad" : "assert" },
        { txt: "  do  " + p.bodyLabel, kind: "code" },
        { txt: p.post, kind: "assert" },
    ];
    let yCur = ly + 52;
    codeLines.forEach((ln) => {
        ctx.fillStyle =
            ln.kind === "bad" ? "#d63a22" : ln.kind === "assert" ? "#1d5fa7" : "#14202b";
        ctx.font = `${ln.kind === "code" ? "500" : "600"} 11px 'Martian Mono', monospace`;
        ctx.fillText(ln.txt.slice(0, 56), lx + 16, yCur);
        yCur += 24;
    });

    // Verification Conditions block
    const vcy = yCur + 22;
    ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
    ctx.beginPath();
    ctx.moveTo(lx + 14, vcy - 14);
    ctx.lineTo(lx + lw - 14, vcy - 14);
    ctx.stroke();

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText("VERIFICATION CONDITIONS (WP)", lx + 14, vcy + 6);

    vcs.forEach((vc, idx) => {
        const by = vcy + 24 + idx * 54;
        if (by + 44 > ly + lh) return;
        ctx.fillStyle = vc.ok ? "rgba(29, 95, 167, 0.08)" : "rgba(214, 58, 34, 0.12)";
        ctx.fillRect(lx + 14, by, lw - 28, 44);
        ctx.strokeStyle = vc.ok ? "#1d5fa7" : "#d63a22";
        ctx.lineWidth = vc.ok ? 1.2 : 2;
        ctx.strokeRect(lx + 14, by, lw - 28, 44);

        ctx.fillStyle = vc.ok ? "#1d5fa7" : "#d63a22";
        ctx.font = "700 10.5px 'Martian Mono', monospace";
        ctx.fillText(`${vc.ok ? "✓" : "✗"} ${vc.name}`, lx + 24, by + 17);

        ctx.fillStyle = "#14202b";
        ctx.font = "500 10.5px 'Martian Mono', monospace";
        ctx.fillText(vc.expr.slice(0, 52), lx + 24, by + 34);
    });

    // Right frame: Invariant Manifold + Program State Trajectory
    const rx = splitX + 10, ry = 44, rw = W - rx - pad, rh = H - 80;
    ctx.fillStyle = "rgba(239, 244, 230, 0.8)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.fillStyle = "#14202b";
    ctx.font = "600 11px 'Martian Mono', monospace";
    ctx.fillText("STATE TRACE ON INVARIANT MANIFOLD", rx + 14, ry + 22);

    const px0 = rx + 58;
    const py0 = ry + rh - 54;
    const pw = rw - 92;
    const ph = rh - 108;

    // Axes
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px0, py0 - ph);
    ctx.lineTo(px0, py0);
    ctx.lineTo(px0 + pw, py0);
    ctx.stroke();

    ctx.fillStyle = "#3c4b57";
    ctx.font = "10px 'Martian Mono', monospace";
    ctx.fillText(p.xLabel, px0 + pw - 90, py0 + 22);
    ctx.fillText(p.yLabel, px0 - 10, py0 - ph - 12);

    const toSX = (x) => px0 + (x / Math.max(1, simData.maxX)) * pw;
    const toSY = (y) => py0 - (y / Math.max(1, simData.maxY)) * ph;

    // Invariant curve (cobalt dashed)
    ctx.strokeStyle = "rgba(29, 95, 167, 0.65)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) {
        const xv = (k / 60) * simData.maxX;
        const sx = toSX(xv);
        const sy = toSY(simData.curve(xv));
        if (k === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Program trace states up to traceIdx
    const shownStates = simData.states.slice(0, traceIdx + 1);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    shownStates.forEach((st, idx) => {
        const sx = toSX(st.x);
        const sy = toSY(st.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
    });
    ctx.stroke();

    shownStates.forEach((st, idx) => {
        const sx = toSX(st.x);
        const sy = toSY(st.y);
        ctx.fillStyle = !st.ok ? "#d63a22" : idx === shownStates.length - 1 ? "#1d5fa7" : "#eff4e6";
        ctx.beginPath();
        ctx.arc(sx, sy, idx === shownStates.length - 1 ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = !st.ok ? "#d63a22" : "#14202b";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        if (idx === shownStates.length - 1 || !st.ok || idx % 2 === 0) {
            ctx.fillStyle = !st.ok ? "#d63a22" : "#14202b";
            ctx.font = "500 9.5px 'Martian Mono', monospace";
            ctx.fillText(st.label, Math.min(rx + rw - 92, sx + 8), sy - 8);
        }
    });

    requestAnimationFrame(draw);
}

document.getElementById("prog-sel").addEventListener("change", (e) => {
    progKey = e.target.value;
    rebuild(true);
});
document.getElementById("param-slider").addEventListener("input", (e) => {
    param = parseInt(e.target.value);
    rebuild(true);
});
document.getElementById("step-btn").addEventListener("click", () => {
    traceIdx = (traceIdx + 1) % simData.states.length;
    const st = simData.states[traceIdx];
    const vcs = PROGRAMS[progKey].vcs(bugInjected);
    const bad = vcs.find((v) => !v.ok);
    document.getElementById("vc-out").textContent = bad
        ? `✗ ${bad.name} FAILED · ${st.label}`
        : `✓ Invariant holds · Step ${traceIdx}/${simData.states.length - 1} (${st.label})`;
});
document.getElementById("bug-btn").addEventListener("click", (e) => {
    bugInjected = !bugInjected;
    e.target.textContent = "Inject Bug: " + (bugInjected ? "ON" : "OFF");
    e.target.classList.toggle("active", bugInjected);
    rebuild(true);
});
document.getElementById("reset-btn").addEventListener("click", () => {
    rebuild(false);
});

draw();
