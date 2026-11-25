// The grid behind the page is a flow net: the streamlines and equipotentials
// of uniform flow past a circular cylinder. The cylinder is your cursor.
//
// With the complex potential  w = ζ + R²/ζ  a point ζ of the undisturbed
// stream sits at  z = (ζ + √(ζ² − 4R²)) / 2  in the physical plane, so
// bending the grid is just a matter of evaluating that inverse for every
// sample along every grid line. The red line is the dividing streamline.
(function () {
    const canvas = document.getElementById("net");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const MINOR = 16;
    const MAJOR = 64;
    const STEP = 10;
    const R_REST = 24;
    const R_HOT = 40;

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drifting = matchMedia("(hover: none)").matches;

    let W = 0;
    let H = 0;
    let dpr = 1;

    // current and target cylinder
    let x = 0, y = 0, r = R_REST;
    let tx = 0, ty = 0, tr = R_REST;
    let placed = false;
    let dirty = true;
    let last = 0;

    // result of warp()
    let wx = 0;
    let wy = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!placed) {
            x = tx = W * 0.72;
            y = ty = H * 0.36;
            placed = true;
        }
        dirty = true;
    }

    // ζ = (zr, zi) relative to the cylinder centre -> physical point in wx, wy
    function warp(zr, zi) {
        const a = zr * zr - zi * zi - 4 * r * r;
        const b = 2 * zr * zi;
        const m = Math.hypot(a, b);
        const sr = Math.sqrt((m + a) / 2);
        let si = Math.sqrt(Math.max(0, (m - a) / 2));
        if (b < 0) si = -si;

        const p1r = (zr + sr) / 2;
        const p1i = (zi + si) / 2;
        const p2r = (zr - sr) / 2;
        const p2i = (zi - si) / 2;

        // the exterior solution is the one outside the circle
        if (p1r * p1r + p1i * p1i >= p2r * p2r + p2i * p2i) {
            wx = x + p1r;
            wy = y + p1i;
        } else {
            wx = x + p2r;
            wy = y + p2i;
        }
    }

    function horizontal(yy) {
        // keep clear of exactly zero so the line picks a side of the cylinder
        const zi = yy - y || 1e-3;
        warp(-STEP - x, zi);
        ctx.moveTo(wx, wy);
        for (let px = 0; px <= W + STEP; px += STEP) {
            warp(px - x, zi);
            ctx.lineTo(wx, wy);
        }
    }

    function vertical(xx) {
        const zr = xx - x;
        const blocked = Math.abs(zr) < 2 * r;
        let prev = -STEP - y;
        warp(zr, prev);
        ctx.moveTo(wx, wy);
        for (let py = 0; py <= H + STEP; py += STEP) {
            const zi = py - y;
            if (blocked && prev < 0 !== zi < 0) {
                // equipotentials end on the cylinder; don't draw across it
                warp(zr, prev < 0 ? -1e-3 : 1e-3);
                ctx.lineTo(wx, wy);
                warp(zr, prev < 0 ? 1e-3 : -1e-3);
                ctx.moveTo(wx, wy);
            }
            warp(zr, zi);
            ctx.lineTo(wx, wy);
            prev = zi;
        }
    }

    function lines(spacing, offset, style, width) {
        ctx.beginPath();
        for (let yy = -offset; yy < H + spacing; yy += spacing) horizontal(yy);
        for (let xx = 0; xx < W + spacing; xx += spacing) vertical(xx);
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.stroke();
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        const offset = window.scrollY % MAJOR;
        lines(MINOR, offset, "rgba(58, 108, 78, 0.13)", 1);
        lines(MAJOR, offset, "rgba(58, 108, 78, 0.3)", 1);

        // the dividing streamline
        ctx.beginPath();
        for (const side of [1e-3, -1e-3]) {
            warp(-W - x, side);
            ctx.moveTo(wx, wy);
            for (let px = -W; px <= W * 2; px += 6) {
                warp(px - x + 0, side);
                ctx.lineTo(wx, wy);
            }
        }
        ctx.strokeStyle = "rgba(214, 58, 34, 0.85)";
        ctx.lineWidth = 1.25;
        ctx.stroke();

        // the cylinder
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(228, 236, 217, 0.96)";
        ctx.fill();
        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.strokeStyle = "#d63a22";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
        last = now;

        if (drifting) {
            tx = W * (0.5 + 0.32 * Math.sin(now * 0.00028));
            ty = H * (0.42 + 0.26 * Math.sin(now * 0.00041 + 1.3));
        }

        const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 11);
        const nx = x + (tx - x) * k;
        const ny = y + (ty - y) * k;
        const nr = r + (tr - r) * k;
        if (Math.abs(nx - x) + Math.abs(ny - y) + Math.abs(nr - r) > 0.02) dirty = true;
        x = nx;
        y = ny;
        r = nr;

        if (dirty) {
            draw();
            dirty = drifting;
        }
        requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", () => (dirty = true), { passive: true });
    window.addEventListener(
        "pointermove",
        (e) => {
            if (e.pointerType === "touch") return;
            tx = e.clientX;
            ty = e.clientY;
            tr = e.target.closest && e.target.closest("a, button, [data-hot]") ? R_HOT : R_REST;
        },
        { passive: true }
    );

    resize();
    requestAnimationFrame(frame);
})();
