// Interactive z^4 - 1 Conformal Separatrix Atlas for navigating Math, Physics, Quantum, and Formal Methods.
(function () {
    const stage = document.getElementById("atlas-stage");
    const canvas = document.getElementById("atlas-canvas");
    if (!stage || !canvas) return;
    const ctx = canvas.getContext("2d");

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let stacked = false;

    let hoveredIdx = -1;
    let cursor = { x: 0.5, y: 0.5, inside: false };
    let saddle = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let weights = [0.25, 0.25, 0.25, 0.25];
    let targetWeights = [0.25, 0.25, 0.25, 0.25];

    const basins = [...stage.querySelectorAll(".basin")];

    function syncBasins() {
        const order = ["math", "physics", "quantum", "formal"];
        basins.forEach((el, idx) => {
            el.addEventListener("pointerenter", () => setActive(idx));
            el.addEventListener("focus", () => setActive(idx));
            el.addEventListener("pointerleave", () => setActive(-1));
            el.addEventListener("blur", () => setActive(-1));
            el.dataset.idx = idx;
            el.dataset.id = order[idx];
        });
    }

    function setActive(idx) {
        hoveredIdx = idx;
        basins.forEach((b, i) => b.classList.toggle("is-hot", i === idx));
        if (idx === -1) {
            saddle.tx = 0.5;
            saddle.ty = 0.5;
            targetWeights = [0.25, 0.25, 0.25, 0.25];
        } else {
            // Shift saddle away from hovered quadrant so its chamber inflates physically
            const shifts = [
                [0.58, 0.58], // 0 Math (top-left)
                [0.42, 0.58], // 1 Physics (top-right)
                [0.58, 0.42], // 2 Quantum (bottom-left)
                [0.42, 0.42], // 3 Formal (bottom-right)
            ];
            saddle.tx = shifts[idx][0];
            saddle.ty = shifts[idx][1];
            targetWeights = [0.16, 0.16, 0.16, 0.16];
            targetWeights[idx] = 0.52;
        }
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const r = stage.getBoundingClientRect();
        W = Math.max(280, Math.round(r.width));
        H = Math.max(320, Math.round(r.height));
        stacked = W < 680;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function getPoles() {
        if (stacked) {
            const x = W * 0.78;
            return [
                { x, y: H * 0.125, lbl: "∮  ζ(s)" },
                { x, y: H * 0.375, lbl: "∇×u  L" },
                { x, y: H * 0.625, lbl: "⟨ψ|  SU(2)" },
                { x, y: H * 0.875, lbl: "⊢  λx.M" },
            ];
        }
        return [
            { x: W * 0.425, y: H * 0.34, lbl: "z₁ = +1" },
            { x: W * 0.575, y: H * 0.34, lbl: "z₂ = +i" },
            { x: W * 0.425, y: H * 0.66, lbl: "z₃ = −1" },
            { x: W * 0.575, y: H * 0.66, lbl: "z₄ = −i" },
        ];
    }

    function drawRuler() {
        ctx.strokeStyle = "rgba(20, 32, 43, 0.35)";
        ctx.fillStyle = "rgba(60, 75, 87, 0.75)";
        ctx.font = "500 9px 'Martian Mono', monospace";
        ctx.lineWidth = 1;

        const stepX = 36;
        for (let x = stepX; x < W - 12; x += stepX) {
            const major = (x / stepX) % 4 === 0;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, major ? 8 : 4);
            ctx.moveTo(x, H);
            ctx.lineTo(x, H - (major ? 8 : 4));
            ctx.stroke();
        }
        const stepY = 36;
        for (let y = stepY; y < H - 12; y += stepY) {
            const major = (y / stepY) % 4 === 0;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(major ? 8 : 4, y);
            ctx.moveTo(W, y);
            ctx.lineTo(W - (major ? 8 : 4), y);
            ctx.stroke();
        }
    }

    // 0: Math holomorphic spirals + orthogonal rays
    function drawMathPole(cx, cy, R, t, hot, weight) {
        const ink = hot ? "#d63a22" : "rgba(20, 32, 43, 0.55)";
        const soft = hot ? "rgba(29, 95, 167, 0.55)" : "rgba(29, 95, 167, 0.26)";
        const scale = R * (0.78 + weight * 0.65);

        ctx.save();
        ctx.translate(cx, cy);
        for (let arm = 0; arm < 3; arm++) {
            const a0 = t * 0.35 + (arm * Math.PI * 2) / 3;
            ctx.beginPath();
            for (let i = 0; i <= 54; i++) {
                const u = i / 54;
                const ang = a0 + u * Math.PI * 3.1;
                const rad = u * scale;
                const px = Math.cos(ang) * rad;
                const py = Math.sin(ang) * rad;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = arm === 0 ? ink : soft;
            ctx.lineWidth = hot && arm === 0 ? 1.8 : 1.1;
            ctx.stroke();
        }
        // Equipotential rings
        for (let ring = 1; ring <= 3; ring++) {
            ctx.beginPath();
            ctx.arc(0, 0, (scale * ring) / 3.2, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(20, 32, 43, 0.16)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    }

    // 1: Physics vorticity figure-8 + phase trajectories
    function drawPhysicsPole(cx, cy, R, t, hot, weight) {
        const ink = hot ? "#d63a22" : "rgba(20, 32, 43, 0.55)";
        const soft = hot ? "rgba(29, 95, 167, 0.6)" : "rgba(29, 95, 167, 0.25)";
        const scale = R * (0.8 + weight * 0.6);

        ctx.save();
        ctx.translate(cx, cy);
        for (let layer = 0; layer < 3; layer++) {
            const amp = scale * (0.48 + layer * 0.24);
            ctx.beginPath();
            for (let i = 0; i <= 72; i++) {
                const u = (i / 72) * Math.PI * 2;
                const x = Math.sin(u + t * 0.3) * amp;
                const y = Math.sin(2 * u + t * 0.45 + layer * 0.3) * amp * 0.62;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = layer === 2 ? ink : soft;
            ctx.lineWidth = hot && layer === 2 ? 1.8 : 1.1;
            ctx.stroke();
        }
        // Moving particle on outer orbit
        const u = t * 1.1;
        ctx.fillStyle = hot ? "#d63a22" : "#1d5fa7";
        ctx.beginPath();
        ctx.arc(Math.sin(u + t * 0.3) * scale * 0.96, Math.sin(2 * u + t * 0.45 + 0.6) * scale * 0.6, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 2: Quantum Bloch sphere meridians + interference ripples
    function drawQuantumPole(cx, cy, R, t, hot, weight) {
        const ink = hot ? "#d63a22" : "rgba(20, 32, 43, 0.55)";
        const soft = hot ? "rgba(29, 95, 167, 0.65)" : "rgba(29, 95, 167, 0.28)";
        const scale = R * (0.76 + weight * 0.6);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = ink;
        ctx.lineWidth = hot ? 1.7 : 1.1;
        ctx.beginPath();
        ctx.arc(0, 0, scale * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        for (let m = 0; m < 3; m++) {
            const rot = t * 0.35 + (m * Math.PI) / 3;
            ctx.save();
            ctx.rotate(rot);
            ctx.beginPath();
            ctx.ellipse(0, 0, scale * 0.85, scale * 0.3, 0, 0, Math.PI * 2);
            ctx.strokeStyle = soft;
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.restore();
        }
        // Ket state vector oscillating
        const ang = t * 0.85;
        const vx = Math.cos(ang) * scale * 0.72;
        const vy = -Math.sin(ang * 1.3) * scale * 0.62;
        ctx.strokeStyle = hot ? "#d63a22" : "#14202b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(vx, vy);
        ctx.stroke();
        ctx.fillStyle = "#d63a22";
        ctx.beginPath();
        ctx.arc(vx, vy, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 3: Formal Methods commuting proof lattice + redex pulse
    function drawFormalPole(cx, cy, R, t, hot, weight) {
        const ink = hot ? "#d63a22" : "rgba(20, 32, 43, 0.6)";
        const soft = hot ? "rgba(29, 95, 167, 0.6)" : "rgba(29, 95, 167, 0.28)";
        const s = R * (0.68 + weight * 0.52);

        const nodes = [
            [0, -s],
            [-s * 0.9, 0],
            [s * 0.9, 0],
            [0, s * 0.9],
            [-s * 0.45, -s * 0.45],
            [s * 0.45, s * 0.45],
        ];
        const edges = [
            [0, 1], [0, 2], [1, 3], [2, 3], [0, 3], [4, 5],
        ];

        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = soft;
        ctx.lineWidth = 1.2;
        edges.forEach(([a, b], idx) => {
            ctx.beginPath();
            ctx.moveTo(nodes[a][0], nodes[a][1]);
            ctx.lineTo(nodes[b][0], nodes[b][1]);
            ctx.stroke();
            if (idx === Math.floor(t * 1.2) % edges.length) {
                const u = (t * 1.2) % 1;
                const px = nodes[a][0] + (nodes[b][0] - nodes[a][0]) * u;
                const py = nodes[a][1] + (nodes[b][1] - nodes[a][1]) * u;
                ctx.fillStyle = "#d63a22";
                ctx.beginPath();
                ctx.arc(px, py, 3.3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        nodes.forEach(([nx, ny], idx) => {
            ctx.fillStyle = idx === 0 || idx === 3 ? (hot ? "#d63a22" : "#1d5fa7") : "#eff4e6";
            ctx.fillRect(nx - 4.5, ny - 4.5, 9, 9);
            ctx.strokeStyle = ink;
            ctx.lineWidth = 1.2;
            ctx.strokeRect(nx - 4.5, ny - 4.5, 9, 9);
        });
        ctx.restore();
    }

    function drawSeparatrices(t) {
        if (stacked) {
            // 3 undulating phase-wave separatrices dividing vertical column
            const ys = [0.25, 0.5, 0.75];
            ys.forEach((f, idx) => {
                const yBase = H * f + (hoveredIdx === idx ? 12 : hoveredIdx === idx + 1 ? -12 : 0);
                const hot = hoveredIdx === idx || hoveredIdx === idx + 1;
                ctx.beginPath();
                for (let x = 0; x <= W; x += 12) {
                    const y = yBase + Math.sin(x * 0.025 + t * 1.1 + idx) * (hot ? 6 : 3);
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = hot ? "#d63a22" : "rgba(20, 32, 43, 0.5)";
                ctx.lineWidth = hot ? 1.8 : 1.2;
                ctx.stroke();
            });
            return;
        }

        const sx = saddle.x * W;
        const sy = saddle.y * H;
        const driftX = (sx - W * 0.5) * 0.35 + (cursor.inside ? (cursor.x - 0.5) * 18 : 0);
        const driftY = (sy - H * 0.5) * 0.35 + (cursor.inside ? (cursor.y - 0.5) * 18 : 0);

        // Background hyperbolic contour families asymptotic to the separatrices
        ctx.strokeStyle = "rgba(58, 108, 78, 0.2)";
        ctx.lineWidth = 1;
        for (let k = -2; k <= 2; k++) {
            if (k === 0) continue;
            const o = k * 42;
            ctx.beginPath();
            ctx.moveTo(0, sy - driftY + o * 0.45);
            ctx.quadraticCurveTo(sx, sy + o, W, sy + driftY + o * 0.45);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(sx - driftX + o * 0.45, 0);
            ctx.quadraticCurveTo(sx + o, sy, sx + driftX + o * 0.45, H);
            ctx.stroke();
        }

        // Main horizontal & vertical curved separatrices passing through saddle (sx, sy)
        ctx.strokeStyle = hoveredIdx >= 0 ? "#d63a22" : "#14202b";
        ctx.lineWidth = hoveredIdx >= 0 ? 1.8 : 1.4;
        ctx.beginPath();
        ctx.moveTo(0, sy - driftY * 0.7);
        ctx.bezierCurveTo(sx * 0.5, sy, sx * 0.5 + sx * 0.5, sy, W, sy + driftY * 0.7);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx - driftX * 0.7, 0);
        ctx.bezierCurveTo(sx, sy * 0.5, sx, sy * 0.5 + sy * 0.5, sx + driftX * 0.7, H);
        ctx.stroke();

        // Saddle singularity marker at (sx, sy)
        ctx.fillStyle = "#eff4e6";
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hoveredIdx >= 0 ? "#d63a22" : "#14202b";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx - 4, sy - 4);
        ctx.lineTo(sx + 4, sy + 4);
        ctx.moveTo(sx + 4, sy - 4);
        ctx.lineTo(sx - 4, sy + 4);
        ctx.stroke();
    }

    function drawMorphisms(poles) {
        if (stacked) return;
        const pairs = [
            [0, 1, "δS = 0"],
            [1, 3, "⊢ U"],
            [2, 3, "Q-Synth"],
            [0, 2, "Ĥ ψ"],
        ];
        ctx.save();
        ctx.font = "500 9.5px 'Martian Mono', monospace";
        pairs.forEach(([a, b, tag]) => {
            const p1 = poles[a], p2 = poles[b];
            const hot = hoveredIdx === a || hoveredIdx === b;
            ctx.strokeStyle = hot ? "rgba(214, 58, 34, 0.5)" : "rgba(20, 32, 43, 0.22)";
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);

            const mx = (p1.x + p2.x) * 0.5;
            const my = (p1.y + p2.y) * 0.5;
            ctx.fillStyle = "rgba(239, 244, 230, 0.9)";
            ctx.fillRect(mx - 28, my - 8, 56, 16);
            ctx.fillStyle = hot ? "#d63a22" : "rgba(60, 75, 87, 0.85)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(tag, mx, my);
        });
        ctx.restore();
    }

    let t0 = performance.now();
    function frame(now) {
        const t = reduceMotion ? 1.4 : (now - t0) * 0.001;

        saddle.x += (saddle.tx - saddle.x) * 0.11;
        saddle.y += (saddle.ty - saddle.y) * 0.11;
        for (let i = 0; i < 4; i++) weights[i] += (targetWeights[i] - weights[i]) * 0.12;

        ctx.clearRect(0, 0, W, H);

        // Soft paper backing tint
        ctx.fillStyle = "rgba(239, 244, 230, 0.42)";
        ctx.fillRect(0, 0, W, H);

        drawRuler();

        const poles = getPoles();
        const baseR = stacked ? Math.min(40, H * 0.075) : Math.min(W * 0.088, H * 0.135);

        // Highlight wash in hovered basin
        if (hoveredIdx >= 0) {
            const p = poles[hoveredIdx];
            const grad = ctx.createRadialGradient(p.x, p.y, 12, p.x, p.y, baseR * 3.2);
            grad.addColorStop(0, "rgba(214, 58, 34, 0.11)");
            grad.addColorStop(1, "rgba(214, 58, 34, 0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }

        drawSeparatrices(t);
        drawMorphisms(poles);

        const drawers = [drawMathPole, drawPhysicsPole, drawQuantumPole, drawFormalPole];
        poles.forEach((p, idx) => {
            drawers[idx](p.x, p.y, baseR, t, hoveredIdx === idx, weights[idx]);
        });

        // Pointer complex coordinate readout along bottom edge on desktop
        if (!stacked) {
            const zr = ((cursor.x - 0.5) * 2).toFixed(2);
            const zi = ((0.5 - cursor.y) * 2).toFixed(2);
            const bName = hoveredIdx >= 0 ? ["Math", "Physics", "Quantum", "Formal"][hoveredIdx] : "Saddle";
            ctx.fillStyle = "rgba(60, 75, 87, 0.85)";
            ctx.font = "500 9.5px 'Martian Mono', monospace";
            ctx.textAlign = "right";
            ctx.fillText(`f(z) = z⁴ − 1 · z = ${zr} ${Number(zi) >= 0 ? "+" : "−"} ${Math.abs(zi)}i · [${bName}]`, W - 14, H - 10);
            ctx.textAlign = "left";
        }

        requestAnimationFrame(frame);
    }

    stage.addEventListener("pointermove", (e) => {
        const r = stage.getBoundingClientRect();
        cursor.x = (e.clientX - r.left) / Math.max(1, r.width);
        cursor.y = (e.clientY - r.top) / Math.max(1, r.height);
        cursor.inside = true;
    });
    stage.addEventListener("pointerleave", () => {
        cursor.inside = false;
        setActive(-1);
    });

    syncBasins();
    resize();
    window.addEventListener("resize", resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    requestAnimationFrame(frame);
})();
