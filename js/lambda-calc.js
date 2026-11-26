const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const PRESETS = {
    skk: "(\u03bbx y z. x z (y z)) (\u03bbx y. x) (\u03bbx y. x) a",
    add: "(\u03bbm n f x. m f (n f x)) (\u03bbf x. f x) (\u03bbf x. f x)",
    and: "(\u03bbp q. p q p) (\u03bbx y. x) (\u03bbx y. y)",
    omega: "(\u03bbx. x x) (\u03bby. y)",
};

// ---------- Parser ----------

function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === "\\" || ch === "\u03bb") { out.push({ t: "LAM" }); i++; continue; }
        if (ch === ".") { out.push({ t: "DOT" }); i++; continue; }
        if (ch === "(") { out.push({ t: "L" }); i++; continue; }
        if (ch === ")") { out.push({ t: "R" }); i++; continue; }
        if (/[a-zA-Z0-9_']/.test(ch)) {
            let id = "";
            while (i < src.length && /[a-zA-Z0-9_']/.test(src[i])) id += src[i++];
            out.push({ t: "ID", v: id });
            continue;
        }
        i++;
    }
    return out;
}

function parseLambda(src) {
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];

    function parseTerm() {
        if (peek() && peek().t === "LAM") {
            next();
            const params = [];
            while (peek() && peek().t === "ID") params.push(next().v);
            if (!params.length) throw new Error("Expected parameter after λ");
            if (!peek() || peek().t !== "DOT") throw new Error("Expected '.'");
            next();
            let body = parseTerm();
            for (let i = params.length - 1; i >= 0; i--) {
                body = { kind: "abs", param: params[i], body };
            }
            return body;
        }
        let acc = parseAtom();
        while (peek() && (peek().t === "ID" || peek().t === "L" || peek().t === "LAM")) {
            if (peek().t === "LAM") {
                acc = { kind: "app", fn: acc, arg: parseTerm() };
                break;
            }
            acc = { kind: "app", fn: acc, arg: parseAtom() };
        }
        return acc;
    }

    function parseAtom() {
        const tk = peek();
        if (!tk) throw new Error("Unexpected end of expression");
        if (tk.t === "ID") { next(); return { kind: "var", name: tk.v }; }
        if (tk.t === "L") {
            next();
            const inner = parseTerm();
            if (!peek() || peek().t !== "R") throw new Error("Missing ')'");
            next();
            return inner;
        }
        throw new Error("Unexpected token");
    }

    const ast = parseTerm();
    if (pos < toks.length) throw new Error("Trailing tokens");
    return ast;
}

function formatTerm(t, parens = false) {
    if (t.kind === "var") return t.name;
    if (t.kind === "abs") {
        let cur = t;
        const ps = [];
        while (cur.kind === "abs") { ps.push(cur.param); cur = cur.body; }
        const s = `\u03bb${ps.join(" ")}. ${formatTerm(cur, false)}`;
        return parens ? `(${s})` : s;
    }
    const fnStr = t.fn.kind === "abs" ? formatTerm(t.fn, true) : formatTerm(t.fn, false);
    const argStr = t.arg.kind !== "var" ? formatTerm(t.arg, true) : formatTerm(t.arg, false);
    const s = `${fnStr} ${argStr}`;
    return parens ? `(${s})` : s;
}

// ---------- Capture-avoiding substitution & beta reduction ----------

function freeVars(t, s = new Set()) {
    if (t.kind === "var") { s.add(t.name); return s; }
    if (t.kind === "app") { freeVars(t.fn, s); freeVars(t.arg, s); return s; }
    const inner = freeVars(t.body);
    inner.delete(t.param);
    inner.forEach((v) => s.add(v));
    return s;
}

function allVars(t, s = new Set()) {
    if (t.kind === "var") { s.add(t.name); return s; }
    if (t.kind === "abs") { s.add(t.param); return allVars(t.body, s); }
    allVars(t.fn, s);
    return allVars(t.arg, s);
}

function rename(t, oldName, newName) {
    if (t.kind === "var") return { kind: "var", name: t.name === oldName ? newName : t.name };
    if (t.kind === "app") return { kind: "app", fn: rename(t.fn, oldName, newName), arg: rename(t.arg, oldName, newName) };
    if (t.param === oldName) return t;
    return { kind: "abs", param: t.param, body: rename(t.body, oldName, newName) };
}

function freshName(base, avoid) {
    let cand = base.replace(/'+$/, "") + "'";
    while (avoid.has(cand)) cand += "'";
    return cand;
}

function subst(t, x, val) {
    if (t.kind === "var") return t.name === x ? val : t;
    if (t.kind === "app") return { kind: "app", fn: subst(t.fn, x, val), arg: subst(t.arg, x, val) };
    if (t.param === x) return t;
    const fvVal = freeVars(val);
    if (!fvVal.has(t.param)) {
        return { kind: "abs", param: t.param, body: subst(t.body, x, val) };
    }
    const avoid = new Set([...fvVal, ...allVars(t.body), x]);
    const pNew = freshName(t.param, avoid);
    return { kind: "abs", param: pNew, body: subst(rename(t.body, t.param, pNew), x, val) };
}

function findNextRedex(t, order) {
    if (t.kind === "var") return null;
    if (t.kind === "abs") return findNextRedex(t.body, order);
    if (order === "normal") {
        if (t.fn.kind === "abs") return t;
        return findNextRedex(t.fn, order) || findNextRedex(t.arg, order);
    }
    // applicative
    const inFn = findNextRedex(t.fn, order);
    if (inFn) return inFn;
    const inArg = findNextRedex(t.arg, order);
    if (inArg) return inArg;
    if (t.fn.kind === "abs") return t;
    return null;
}

function reduceOnce(t, targetNode) {
    if (t === targetNode && t.kind === "app" && t.fn.kind === "abs") {
        return subst(t.fn.body, t.fn.param, t.arg);
    }
    if (t.kind === "abs") return { kind: "abs", param: t.param, body: reduceOnce(t.body, targetNode) };
    if (t.kind === "app") {
        const fn2 = reduceOnce(t.fn, targetNode);
        if (fn2 !== t.fn) return { kind: "app", fn: fn2, arg: t.arg };
        const arg2 = reduceOnce(t.arg, targetNode);
        if (arg2 !== t.arg) return { kind: "app", fn: t.fn, arg: arg2 };
    }
    return t;
}

// ---------- Hindley-Milner Type Inference (Algorithm W) ----------

function inferType(ast) {
    let nextId = 0;
    const tv = () => ({ k: "var", id: nextId++ });
    const substMap = new Map();

    function apply(t) {
        if (t.k === "var") return substMap.has(t.id) ? apply(substMap.get(t.id)) : t;
        if (t.k === "arr") return { k: "arr", a: apply(t.a), b: apply(t.b) };
        return t;
    }
    function occurs(id, t) {
        t = apply(t);
        if (t.k === "var") return t.id === id;
        return occurs(id, t.a) || occurs(id, t.b);
    }
    function unify(t1, t2) {
        t1 = apply(t1);
        t2 = apply(t2);
        if (t1.k === "var" && t2.k === "var" && t1.id === t2.id) return;
        if (t1.k === "var") {
            if (occurs(t1.id, t2)) throw new Error("occurs check (recursive / untyped)");
            substMap.set(t1.id, t2);
            return;
        }
        if (t2.k === "var") {
            if (occurs(t2.id, t1)) throw new Error("occurs check (recursive / untyped)");
            substMap.set(t2.id, t1);
            return;
        }
        if (t1.k === "arr" && t2.k === "arr") {
            unify(t1.a, t2.a);
            unify(t1.b, t2.b);
            return;
        }
        throw new Error("type mismatch");
    }

    const env = new Map();
    function w(node) {
        if (node.kind === "var") {
            if (env.has(node.name)) return env.get(node.name);
            const t = tv();
            env.set(node.name, t);
            return t;
        }
        if (node.kind === "abs") {
            const paramT = tv();
            const prev = env.has(node.param) ? env.get(node.param) : undefined;
            env.set(node.param, paramT);
            const bodyT = w(node.body);
            if (prev === undefined) env.delete(node.param);
            else env.set(node.param, prev);
            return { k: "arr", a: apply(paramT), b: bodyT };
        }
        const tFn = w(node.fn);
        const tArg = w(node.arg);
        const resT = tv();
        unify(tFn, { k: "arr", a: tArg, b: resT });
        return apply(resT);
    }

    try {
        const res = apply(w(ast));
        const names = "αβγδεζηθκμ";
        const seen = new Map();
        function fmt(t, top = true) {
            t = apply(t);
            if (t.k === "var") {
                if (!seen.has(t.id)) seen.set(t.id, seen.size < names.length ? names[seen.size] : `t${seen.size}`);
                return seen.get(t.id);
            }
            const s = `${fmt(t.a, false)} → ${fmt(t.b, true)}`;
            return top ? s : `(${s})`;
        }
        return `Γ ⊢ term : ${fmt(res, true)}`;
    } catch (e) {
        return `Untyped in STLC (${e.message})`;
    }
}

// ---------- State & History ----------

let currentAst = null;
let trace = [];
let strategy = "normal";
let parseError = "";

function loadExpr(src, preSteps = 0) {
    try {
        parseError = "";
        currentAst = parseLambda(src);
        trace = [{ term: formatTerm(currentAst), rule: "init" }];
        for (let i = 0; i < preSteps; i++) stepReduce();
        updateReadout();
    } catch (e) {
        parseError = e.message;
        updateReadout();
    }
}

function stepReduce() {
    if (!currentAst) return false;
    const redex = findNextRedex(currentAst, strategy);
    if (!redex) return false;
    const rule = `(${redex.fn.param} ↦ ${formatTerm(redex.arg)})`;
    currentAst = reduceOnce(currentAst, redex);
    trace.push({ term: formatTerm(currentAst), rule });
    if (trace.length > 9) trace.shift();
    updateReadout();
    return true;
}

function updateReadout() {
    const out = document.getElementById("type-out");
    if (parseError) {
        out.textContent = "Parse error: " + parseError;
        out.style.borderLeft = "3px solid #d63a22";
        return;
    }
    const redex = findNextRedex(currentAst, strategy);
    const ty = inferType(currentAst);
    out.textContent = ty + "\n" + (redex ? "Next redex available →β" : "Normal form reached (nf)");
}

// ---------- AST Tree Layout & Drawing ----------

function measureTree(node, redex, depth = 0) {
    const isRedex = node === redex;
    if (node.kind === "var") {
        return { node, isRedex, width: 1, height: depth, children: [] };
    }
    if (node.kind === "abs") {
        const c = measureTree(node.body, redex, depth + 1);
        return { node, isRedex, width: Math.max(1, c.width), height: c.height, children: [c] };
    }
    const l = measureTree(node.fn, redex, depth + 1);
    const r = measureTree(node.arg, redex, depth + 1);
    return { node, isRedex, width: l.width + r.width, height: Math.max(l.height, r.height), children: [l, r] };
}

function layoutTree(m, x0, x1, y, dy, out = []) {
    const cx = (x0 + x1) * 0.5;
    const item = { node: m.node, isRedex: m.isRedex, x: cx, y, children: [] };
    out.push(item);
    if (m.children.length === 1) {
        item.children.push(layoutTree(m.children[0], x0, x1, y + dy, dy, out));
    } else if (m.children.length === 2) {
        const total = m.width;
        const mid = x0 + ((x1 - x0) * m.children[0].width) / total;
        item.children.push(layoutTree(m.children[0], x0, mid, y + dy, dy, out));
        item.children.push(layoutTree(m.children[1], mid, x1, y + dy, dy, out));
    }
    return item;
}

function boundsOf(layout) {
    let minX = layout.x, maxX = layout.x, minY = layout.y, maxY = layout.y;
    for (const c of layout.children) {
        const b = boundsOf(c);
        minX = Math.min(minX, b.minX);
        maxX = Math.max(maxX, b.maxX);
        minY = Math.min(minY, b.minY);
        maxY = Math.max(maxY, b.maxY);
    }
    return { minX, maxX, minY, maxY };
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

loadExpr(PRESETS.skk, 1);

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width;
    const H = canvas.height;

    const embedded = document.documentElement.classList.contains("embed") || document.documentElement.classList.contains("panels-hidden");
    const topPad = 42;
    const ledgerH = Math.min(185, H * 0.24);
    const treeH = H - ledgerH - topPad - 24;
    const leftPad = embedded || W < 1050 ? Math.max(36, W * 0.14) : 415;
    const rightPad = embedded || W < 1050 ? Math.max(36, W * 0.14) : 345;

    if (currentAst) {
        const redex = findNextRedex(currentAst, strategy);
        const measured = measureTree(currentAst, redex, 0);
        const depth = Math.max(1, measured.height);
        const dy = Math.min(72, (treeH - 50) / depth);
        const flat = [];
        const root = layoutTree(measured, leftPad, W - rightPad, topPad + 28, dy, flat);

        // Highlight active redex subtree box first
        for (const item of flat) {
            if (item.isRedex) {
                const b = boundsOf(item);
                ctx.save();
                ctx.fillStyle = "rgba(214, 58, 34, 0.08)";
                ctx.strokeStyle = "#d63a22";
                ctx.lineWidth = 1.6;
                ctx.setLineDash([6, 4]);
                ctx.fillRect(b.minX - 28, b.minY - 24, b.maxX - b.minX + 56, b.maxY - b.minY + 48);
                ctx.strokeRect(b.minX - 28, b.minY - 24, b.maxX - b.minX + 56, b.maxY - b.minY + 48);
                ctx.setLineDash([]);
                ctx.fillStyle = "#d63a22";
                ctx.font = "600 10px 'Martian Mono', monospace";
                ctx.fillText("β-REDEX", b.minX - 24, b.minY - 28);
                ctx.restore();
            }
        }

        // Draw edges
        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 1.5;
        for (const item of flat) {
            for (const ch of item.children) {
                ctx.beginPath();
                ctx.moveTo(item.x, item.y);
                ctx.lineTo(ch.x, ch.y);
                ctx.stroke();
            }
        }

        // Draw nodes
        for (const item of flat) {
            const n = item.node;
            if (n.kind === "app") {
                ctx.fillStyle = item.isRedex ? "#d63a22" : "#14202b";
                ctx.beginPath();
                ctx.arc(item.x, item.y, 13, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#eff4e6";
                ctx.font = "700 12px 'Martian Mono', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("@", item.x, item.y + 1);
            } else if (n.kind === "abs") {
                ctx.fillStyle = "#1d5fa7";
                ctx.beginPath();
                ctx.arc(item.x, item.y, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#14202b";
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.fillStyle = "#eff4e6";
                ctx.font = "600 11px 'Martian Mono', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("\u03bb" + n.param, item.x, item.y + 1);
            } else {
                const w = Math.max(26, n.name.length * 8 + 14);
                ctx.fillStyle = "#eff4e6";
                ctx.fillRect(item.x - w * 0.5, item.y - 12, w, 24);
                ctx.strokeStyle = "#14202b";
                ctx.lineWidth = 1.4;
                ctx.strokeRect(item.x - w * 0.5, item.y - 12, w, 24);
                ctx.fillStyle = "#14202b";
                ctx.font = "600 11px 'Martian Mono', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(n.name, item.x, item.y + 1);
            }
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    }

    // Bottom reduction trace ledger
    const ly = H - ledgerH;
    const lx = 36;
    const lw = W - 72;
    ctx.fillStyle = "rgba(239, 244, 230, 0.88)";
    ctx.fillRect(lx, ly, lw, ledgerH - 22);
    ctx.strokeStyle = "#14202b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lx, ly, lw, ledgerH - 22);

    ctx.fillStyle = "#14202b";
    ctx.font = "600 10.5px 'Martian Mono', monospace";
    ctx.fillText("REDUCTION TRACE (β-STEPS)", lx + 14, ly + 20);

    const maxShow = Math.max(3, Math.floor((ledgerH - 54) / 20));
    const slice = trace.slice(-maxShow);
    slice.forEach((step, idx) => {
        const y = ly + 42 + idx * 20;
        const isLast = idx === slice.length - 1;
        ctx.fillStyle = isLast ? "#d63a22" : "#3c4b57";
        ctx.font = "600 10.5px 'Martian Mono', monospace";
        ctx.fillText(idx === 0 && trace.length === slice.length ? "   " : "→β", lx + 14, y);
        ctx.fillStyle = "#14202b";
        ctx.font = "500 11px 'Martian Mono', monospace";
        const line = step.term.length > 76 ? step.term.slice(0, 73) + "..." : step.term;
        ctx.fillText(line, lx + 46, y);
        ctx.fillStyle = "#1d5fa7";
        ctx.fillText(step.rule, lx + lw - Math.min(260, step.rule.length * 7 + 20), y);
    });

    requestAnimationFrame(draw);
}

document.getElementById("preset").addEventListener("change", (e) => {
    const val = PRESETS[e.target.value];
    document.getElementById("expr-in").value = val;
    loadExpr(val, 0);
});
document.getElementById("expr-in").addEventListener("change", (e) => loadExpr(e.target.value, 0));
document.getElementById("strategy").addEventListener("change", (e) => {
    strategy = e.target.value;
    updateReadout();
});
document.getElementById("step-btn").addEventListener("click", stepReduce);
document.getElementById("norm-btn").addEventListener("click", () => {
    for (let i = 0; i < 30; i++) {
        if (!stepReduce()) break;
    }
});
document.getElementById("reset-btn").addEventListener("click", () => {
    loadExpr(document.getElementById("expr-in").value, 0);
});

draw();
