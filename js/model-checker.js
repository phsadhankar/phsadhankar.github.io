const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let sysId = "peterson";
let specId = "safety";
let bugOn = false;

let states = [];
let edges = [];
let tokens = [];
let lasso = []; // Array of edge indices forming counterexample path / cycle
let satSet = new Set();
let badSet = new Set();

let waveTick = 0;
let dragNode = null;
let hoverNode = null;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function buildSystem() {
    const W = canvas.width;
    const H = canvas.height;
    const embedded =
        document.documentElement.classList.contains("embed") ||
        document.documentElement.classList.contains("panels-hidden");
    const topY = embedded || H < 680 ? 30 : 210;
    const cx = W * 0.5;
    const cy = topY + (H - topY) * 0.5;
    const rx = Math.min(340, W * 0.34);
    const ry = Math.min(200, (H - topY) * 0.36);

    let defs;
    if (sysId === "peterson") {
        defs = [
            { id: "N0,N1", tag: "idle", x: 0, y: -0.9, init: true, bad: false, req: false, crit: false },
            { id: "W0,N1", tag: "req0", x: -0.68, y: -0.45, init: false, bad: false, req: true, crit: false },
            { id: "N0,W1", tag: "req1", x: 0.68, y: -0.45, init: false, bad: false, req: true, crit: false },
            { id: "C0,N1", tag: "crit0", x: -0.95, y: 0.2, init: false, bad: false, req: false, crit: true },
            { id: "N0,C1", tag: "crit1", x: 0.95, y: 0.2, init: false, bad: false, req: false, crit: true },
            { id: "W0,W1", tag: "turn", x: 0, y: 0.05, init: false, bad: false, req: true, crit: false },
            { id: "C0,W1", tag: "crit0·w1", x: -0.52, y: 0.72, init: false, bad: false, req: true, crit: true },
            { id: "W0,C1", tag: "w0·crit1", x: 0.52, y: 0.72, init: false, bad: false, req: true, crit: true },
            { id: "C0,C1", tag: "RACE!", x: 0, y: 1.0, init: false, bad: true, req: false, crit: false },
        ];
        edges = [
            [0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 5],
            [3, 0], [4, 0], [3, 6], [4, 7], [5, 6], [5, 7],
            [6, 2], [7, 1], [6, 5], [7, 5],
        ];
        if (bugOn) {
            // Broken turn check: both W0,W1 can skip into C0,C1! Also C0,W1 can race into C0,C1 and bounce
            edges.push([5, 8], [6, 8], [7, 8], [8, 6], [8, 7]);
        }
    } else if (sysId === "abp") {
        defs = [
            { id: "S0·A0", tag: "sync0", x: -0.78, y: -0.65, init: true, bad: false, req: false, crit: true },
            { id: "TX0", tag: "send(0)", x: 0, y: -0.88, init: false, bad: false, req: true, crit: false },
            { id: "DROP0", tag: "loss", x: -0.35, y: -0.15, init: false, bad: false, req: true, crit: false },
            { id: "ACK0", tag: "ack(0)", x: 0.78, y: -0.65, init: false, bad: false, req: false, crit: true },
            { id: "S1·A1", tag: "sync1", x: 0.78, y: 0.65, init: false, bad: false, req: false, crit: true },
            { id: "TX1", tag: "send(1)", x: 0, y: 0.88, init: false, bad: false, req: true, crit: false },
            { id: "DROP1", tag: "loss", x: 0.35, y: 0.15, init: false, bad: false, req: true, crit: false },
            { id: "ACK1", tag: "ack(1)", x: -0.78, y: 0.65, init: false, bad: false, req: false, crit: true },
            { id: "CORR", tag: "DESYNC", x: 0, y: 0.0, init: false, bad: true, req: false, crit: false },
        ];
        edges = [
            [0, 1], [1, 3], [1, 2], [2, 1], [3, 4],
            [4, 5], [5, 7], [5, 6], [6, 5], [7, 0],
        ];
        if (bugOn) {
            edges.push([2, 8], [8, 6], [6, 8]);
        }
    } else {
        defs = [
            { id: "BUF=0", tag: "empty", x: -0.92, y: 0, init: true, bad: false, req: false, crit: true },
            { id: "BUF=1", tag: "n=1", x: -0.45, y: -0.65, init: false, bad: false, req: true, crit: false },
            { id: "BUF=2", tag: "n=2", x: 0.45, y: -0.65, init: false, bad: false, req: true, crit: false },
            { id: "BUF=3", tag: "full", x: 0.92, y: 0, init: false, bad: false, req: false, crit: true },
            { id: "WAIT_P", tag: "sleepP", x: 0.45, y: 0.68, init: false, bad: false, req: true, crit: false },
            { id: "WAIT_C", tag: "sleepC", x: -0.45, y: 0.68, init: false, bad: false, req: true, crit: false },
            { id: "OVFL", tag: "OVF!", x: 0, y: 0.0, init: false, bad: true, req: false, crit: false },
        ];
        edges = [
            [0, 1], [1, 2], [2, 3], [3, 2], [2, 1], [1, 0],
            [3, 4], [4, 2], [0, 5], [5, 1],
        ];
        if (bugOn) {
            edges.push([3, 6], [6, 3], [6, 6]);
        }
    }

    states = defs.map((d, idx) => ({
        idx,
        id: d.id,
        tag: d.tag,
        x: cx + d.x * rx,
        y: cy + d.y * ry,
        bx: cx + d.x * rx,
        by: cy + d.y * ry,
        vx: 0,
        vy: 0,
        init: d.init,
        bad: d.bad,
        req: d.req,
        crit: d.crit,
        depth: Infinity,
    }));

    // BFS reachability from S0 (index 0)
    const q = [0];
    states[0].depth = 0;
    const parent = new Array(states.length).fill(-1);
    while (q.length) {
        const u = q.shift();
        for (const [eu, ev] of edges) {
            if (eu === u && states[ev].depth === Infinity) {
                states[ev].depth = states[u].depth + 1;
                parent[ev] = u;
                q.push(ev);
            }
        }
    }

    // Evaluate CTL/LTL property & extract counterexample lasso if violated
    satSet.clear();
    badSet.clear();
    lasso = [];

    if (specId === "safety") {
        // AG !bad
        states.forEach((s) => {
            if (s.depth < Infinity && s.bad) badSet.add(s.idx);
            else if (s.depth < Infinity) satSet.add(s.idx);
        });
        if (badSet.size > 0) {
            // Trace shortest path 0 -> first bad state + self/return loop
            const target = [...badSet][0];
            let cur = target;
            const stem = [];
            while (cur !== -1) {
                stem.unshift(cur);
                cur = parent[cur];
            }
            for (let i = 0; i < stem.length - 1; i++) {
                const ei = edges.findIndex(([a, b]) => a === stem[i] && b === stem[i + 1]);
                if (ei >= 0) lasso.push(ei);
            }
            // Add cycle from target if exists
            const back = edges.findIndex(([a, b]) => a === target && (b === target || stem.includes(b)));
            if (back >= 0) lasso.push(back);
        }
    } else {
        // Liveness check: find fair cycles avoiding crit when req holds (e.g. DROP0<->TX0 / W0,W1->C0,C1 bug)
        // Compute backward fixed point of AF(crit) = mu Z. crit U AX Z
        let Z = new Set(states.filter((s) => s.crit).map((s) => s.idx));
        let changed = true;
        while (changed) {
            changed = false;
            states.forEach((s) => {
                if (Z.has(s.idx)) return;
                const out = edges.filter(([a]) => a === s.idx).map(([, b]) => b);
                if (out.length > 0 && out.every((b) => Z.has(b))) {
                    Z.add(s.idx);
                    changed = true;
                }
            });
        }
        states.forEach((s) => {
            if (s.depth === Infinity) return;
            if (s.req && !Z.has(s.idx)) badSet.add(s.idx);
            else satSet.add(s.idx);
        });
        // In ABP/Bounded/Bugged, highlight a concrete non-progress or bad loop if any bad states exist
        if (badSet.size > 0) {
            const target = [...badSet][0];
            const stem = [];
            let cur = target;
            while (cur !== -1) {
                stem.unshift(cur);
                cur = parent[cur];
            }
            for (let i = 0; i < stem.length - 1; i++) {
                const ei = edges.findIndex(([a, b]) => a === stem[i] && b === stem[i + 1]);
                if (ei >= 0) lasso.push(ei);
            }
            // Find cycle within !Z
            const loopE = edges.findIndex(([a, b]) => a === target && !Z.has(b));
            if (loopE >= 0) lasso.push(loopE);
            const loopBack = edges.findIndex(([a, b]) => loopE >= 0 && a === edges[loopE][1] && b === target);
            if (loopBack >= 0) lasso.push(loopBack);
        }
    }

    // Seed continuous kinetic trace tokens moving across active edges
    tokens = [];
    const numTok = 14;
    for (let i = 0; i < numTok; i++) {
        const usable = edges.filter(([a]) => states[a].depth < Infinity);
        if (!usable.length) break;
        const e = usable[i % usable.length];
        tokens.push({
            u: e[0],
            v: e[1],
            t: (i * 0.23) % 1,
            speed: 0.008 + (i % 4) * 0.0025,
            isLasso: lasso.some((ei) => edges[ei][0] === e[0] && edges[ei][1] === e[1]),
        });
    }

    waveTick = 0;
}

buildSystem();

function stepTokensAndSprings(now) {
    // Gentle spring return toward home layout + subtle harmonic breath
    states.forEach((s, i) => {
        if (dragNode === s) return;
        const hx = s.bx + Math.sin(now * 0.0012 + i * 1.1) * 5;
        const hy = s.by + Math.cos(now * 0.001 + i * 1.5) * 4;
        s.vx = (s.vx + (hx - s.x) * 0.04) * 0.82;
        s.vy = (s.vy + (hy - s.y) * 0.04) * 0.82;
        s.x += s.vx;
        s.y += s.vy;
    });

    tokens.forEach((tk) => {
        tk.t += tk.speed;
        if (tk.t >= 1) {
            tk.t = 0;
            const nextEdges = edges.filter(([a]) => a === tk.v);
            if (nextEdges.length > 0) {
                // Prefer lasso edges when bug/violation exists so counterexample path pulses vividly
                const lassoHits = nextEdges.filter(([a, b]) =>
                    lasso.some((ei) => edges[ei][0] === a && edges[ei][1] === b)
                );
                const pool = lassoHits.length && Math.random() < 0.65 ? lassoHits : nextEdges;
                const pick = pool[Math.floor(Math.random() * pool.length)];
                tk.u = pick[0];
                tk.v = pick[1];
                tk.isLasso = lasso.some((ei) => edges[ei][0] === tk.u && edges[ei][1] === tk.v);
            } else {
                tk.u = 0;
                const startEdges = edges.filter(([a]) => a === 0);
                tk.v = startEdges.length ? startEdges[0][1] : 0;
            }
        }
    });
}

function edgeCurvePt(u, v, t) {
    if (u === v) {
        const a = -Math.PI / 2 + t * Math.PI * 2;
        const r = 34;
        return { x: u.x + Math.cos(a) * r, y: u.y - 24 + Math.sin(a) * r };
    }
    const dx = v.x - u.x, dy = v.y - u.y;
    const len = Math.hypot(dx, dy) || 1;
    // Consistent slight perpendicular bow so reciprocal edges u->v and v->u never collide!
    const nx = -dy / len, ny = dx / len;
    const mx = (u.x + v.x) * 0.5 + nx * 24;
    const my = (u.y + v.y) * 0.5 + ny * 24;
    const omt = 1 - t;
    return {
        x: omt * omt * u.x + 2 * omt * t * mx + t * t * v.x,
        y: omt * omt * u.y + 2 * omt * t * my + t * t * v.y,
        cx: mx,
        cy: my,
    };
}

function draw() {
    const now = performance.now();
    stepTokensAndSprings(now);
    waveTick = (waveTick + 0.025) % 6.5;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    edges.forEach(([ui, vi], ei) => {
        const u = states[ui], v = states[vi];
        const reachable = u.depth < Infinity && v.depth < Infinity;
        const onLasso = lasso.includes(ei);

        ctx.beginPath();
        if (ui === vi) {
            ctx.arc(u.x, u.y - 24, 24, 0, Math.PI * 2);
        } else {
            const pMid = edgeCurvePt(u, v, 0.5);
            ctx.moveTo(u.x, u.y);
            ctx.quadraticCurveTo(pMid.cx, pMid.cy, v.x, v.y);
        }

        if (onLasso) {
            ctx.strokeStyle = "#d63a22";
            ctx.lineWidth = 2.6;
        } else if (reachable) {
            ctx.strokeStyle = "rgba(20, 32, 43, 0.34)";
            ctx.lineWidth = 1.4;
        } else {
            ctx.strokeStyle = "rgba(20, 32, 43, 0.12)";
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead near target state rim
        if (ui !== vi) {
            const tip = edgeCurvePt(u, v, 0.8);
            const pre = edgeCurvePt(u, v, 0.74);
            const ang = Math.atan2(tip.y - pre.y, tip.x - pre.x);
            ctx.fillStyle = onLasso ? "#d63a22" : reachable ? "rgba(20, 32, 43, 0.52)" : "rgba(20, 32, 43, 0.18)";
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(tip.x - 8 * Math.cos(ang - 0.38), tip.y - 8 * Math.sin(ang - 0.38));
            ctx.lineTo(tip.x - 8 * Math.cos(ang + 0.38), tip.y - 8 * Math.sin(ang + 0.38));
            ctx.closePath();
            ctx.fill();
        }
    });

    // Draw kinetic transition tokens along curves
    tokens.forEach((tk) => {
        const u = states[tk.u], v = states[tk.v];
        const pt = edgeCurvePt(u, v, tk.t);
        const ptPrev = edgeCurvePt(u, v, Math.max(0, tk.t - 0.08));
        ctx.strokeStyle = tk.isLasso ? "rgba(214, 58, 34, 0.65)" : "rgba(29, 95, 167, 0.55)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(ptPrev.x, ptPrev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        ctx.fillStyle = tk.isLasso ? "#d63a22" : "#1d5fa7";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, tk.isLasso ? 4.4 : 3.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw nodes with expanding BFS wavefront ring
    const R = 29;
    states.forEach((s) => {
        const reach = s.depth < Infinity;
        const isBad = badSet.has(s.idx);
        const waveHit = reach && Math.abs(waveTick - s.depth) < 0.75;

        if (waveHit) {
            const p = 1 - Math.abs(waveTick - s.depth) / 0.75;
            ctx.strokeStyle = isBad ? `rgba(214, 58, 34, ${p * 0.75})` : `rgba(29, 95, 167, ${p * 0.65})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(s.x, s.y, R + 6 + (1 - p) * 14, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = !reach
            ? "rgba(239, 244, 230, 0.42)"
            : isBad
            ? "#d63a22"
            : s.init
            ? "#1d5fa7"
            : "#eff4e6";
        ctx.beginPath();
        ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = hoverNode === s ? "#d63a22" : reach ? "#14202b" : "rgba(20, 32, 43, 0.25)";
        ctx.lineWidth = s.init || isBad ? 2.2 : 1.5;
        ctx.stroke();

        ctx.fillStyle = isBad || s.init ? "#eff4e6" : reach ? "#14202b" : "rgba(20, 32, 43, 0.38)";
        ctx.font = "700 10px 'Martian Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(s.id, s.x, s.y - 1);
        ctx.font = "500 8.5px 'Martian Mono', monospace";
        ctx.fillStyle = isBad || s.init ? "rgba(239, 244, 230, 0.85)" : "#3c4b57";
        ctx.fillText(s.tag, s.x, s.y + 11);
        ctx.textAlign = "left";
    });

    const out = document.getElementById("mc-out");
    if (badSet.size > 0) {
        out.textContent = `COUNTEREXAMPLE LASSO FOUND · ${badSet.size} VIOLATING STATES`;
    } else {
        out.textContent = `K |= ${specId === "safety" ? "AG ¬bad" : "AG(req ⇒ AF crit)"} · VERIFIED (${satSet.size}/${states.length} reachable)`;
    }

    requestAnimationFrame(draw);
}

canvas.addEventListener("mousedown", (e) => {
    dragNode = states.find((s) => Math.hypot(e.clientX - s.x, e.clientY - s.y) <= 28) || null;
});
window.addEventListener("mouseup", () => (dragNode = null));
canvas.addEventListener("mousemove", (e) => {
    hoverNode = states.find((s) => Math.hypot(e.clientX - s.x, e.clientY - s.y) <= 28) || null;
    if (!dragNode) return;
    dragNode.x = e.clientX;
    dragNode.y = e.clientY;
    dragNode.bx = e.clientX;
    dragNode.by = e.clientY;
});

document.getElementById("sys-sel").addEventListener("change", (e) => {
    sysId = e.target.value;
    buildSystem();
});
document.getElementById("spec-sel").addEventListener("change", (e) => {
    specId = e.target.value;
    buildSystem();
});
document.getElementById("bug-btn").addEventListener("click", (e) => {
    bugOn = !bugOn;
    e.target.textContent = bugOn ? "Inject Race Bug: ON" : "Inject Race Bug: OFF";
    e.target.classList.toggle("active", bugOn);
    buildSystem();
});
document.getElementById("wave-btn").addEventListener("click", () => {
    waveTick = 0;
});

draw();
