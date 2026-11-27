// Cellular Automata & Life-in-Life Lab
// Supports: Conway's B3/S23, Hierarchical Meta-B3/S23 inside Micro-B3/S23 (Life-in-Life),
// Lifelike / Generations (B.../S.../K), Moore / von Neumann, Toroidal / Bounded,
// Brian's Brain, Wireworld digital logic, Elementary 1D (Rule 0-255), and custom saved rules.

(function () {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const embedded = new URLSearchParams(location.search).has("embed");

    const PALETTE = {
        paper: "#e4ecd9",
        paperHi: "#eff4e6",
        ink: "#14202b",
        soft: "#3c4b57",
        red: "#d63a22",
        blue: "#1d5fa7",
        ochre: "#9a5b13",
        gridMinor: "rgba(58, 108, 78, 0.14)",
        gridMajor: "rgba(58, 108, 78, 0.30)",
    };

    /* ===================== CANONICAL B3/S23 PATTERNS ===================== */
    const PATTERNS = {
        glider: [
            [1, 0], [2, 1], [0, 2], [1, 2], [2, 2],
        ],
        lwss: [
            [1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3],
        ],
        blinker: [
            [0, 0], [1, 0], [2, 0],
        ],
        toad: [
            [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1],
        ],
        beacon: [
            [0, 0], [1, 0], [0, 1], [3, 2], [2, 3], [3, 3],
        ],
        block: [
            [0, 0], [1, 0], [0, 1], [1, 1],
        ],
        eater: [
            [0, 0], [1, 0], [0, 1], [2, 1], [2, 2], [2, 3], [3, 3],
        ],
        rpent: [
            [1, 0], [2, 0], [0, 1], [1, 1], [1, 2],
        ],
        acorn: [
            [1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2],
        ],
        replicator: [
            [2, 0], [3, 0], [4, 0], [1, 1], [4, 1], [0, 2],
            [4, 2], [0, 3], [3, 3], [0, 4], [1, 4], [2, 4],
        ],
        pentadecathlon: [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
        ],
        pulsar: (() => {
            const p = [];
            for (const d of [2, 3, 4]) {
                for (const s of [-1, 1]) {
                    p.push([6 + s * d, 0], [6 + s * d, 5], [6 + s * d, 7], [6 + s * d, 12]);
                    p.push([0, 6 + s * d], [5, 6 + s * d], [7, 6 + s * d], [12, 6 + s * d]);
                }
            }
            return p;
        })(),
        gosper: [
            [24, 0], [22, 1], [24, 1], [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2],
            [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3], [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4],
            [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5], [10, 6], [16, 6], [24, 6],
            [11, 7], [15, 7], [12, 8], [13, 8],
        ],
    };

    function rotatePts(pts, rot) {
        let out = pts.map(([x, y]) => [x, y]);
        for (let r = 0; r < (rot & 3); r++) {
            out = out.map(([x, y]) => [-y, x]);
        }
        let minX = Infinity, minY = Infinity;
        for (const [x, y] of out) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
        }
        return out.map(([x, y]) => [x - minX, y - minY]);
    }

    function flipTransform(pts, fx, fy) {
        return pts.map(([x, y]) => [fx * x, fy * y]);
    }

    /* ===================== PRESET UNIVERSE CATALOG ===================== */
    const BUILTIN_PRESETS = {
        life: {
            kind: "2d",
            name: "Conway's Game of Life (B3/S23)",
            B: [3], S: [2, 3], states: 2, nbr: "moore", wrap: true,
            defaultSeed: "gosper-and-eaters",
            seeds: [
                ["gosper-and-eaters", "Gosper Glider Gun"],
                ["rpent-classic", "R-Pentomino (Methuselah)"],
                ["pulsar-gallery", "Pulsar & Oscillators"],
                ["acorn-seed", "Acorn (5206 gens)"],
                ["lwss-fleet", "LWSS Spaceship Armada"],
                ["soup-25", "Random Soup (25%)"],
            ],
        },
        "life-in-life": {
            kind: "meta",
            name: "Life in Life (Meta B3/S23 ∈ B3/S23)",
            B: [3], S: [2, 3], states: 2, nbr: "moore", wrap: true,
            defaultSeed: "meta-glider",
            seeds: [
                ["meta-glider", "Macro Glider + Blinker"],
                ["meta-pulsar", "Macro Pulsar (Period 3)"],
                ["meta-osc", "Macro Toad & Beacon"],
                ["meta-rpent", "Macro R-Pentomino"],
                ["meta-soup", "Macro Random Soup"],
            ],
        },
        highlife: {
            kind: "2d",
            name: "HighLife (B36/S23 · Replicator)",
            B: [3, 6], S: [2, 3], states: 2, nbr: "moore", wrap: true,
            defaultSeed: "hl-replicator",
            seeds: [
                ["hl-replicator", "Twin Replicators"],
                ["hl-bomber", "Replicator + Glider Soup"],
                ["soup-22", "Random Soup (22%)"],
            ],
        },
        daynight: {
            kind: "2d",
            name: "Day & Night (B3678/S34678)",
            B: [3, 6, 7, 8], S: [3, 4, 6, 7, 8], states: 2, nbr: "moore", wrap: true,
            defaultSeed: "soup-48",
            seeds: [
                ["soup-48", "Dense Parity Soup (48%)"],
                ["dn-core", "Anti-Matter Seed"],
            ],
        },
        seeds: {
            kind: "2d",
            name: "Seeds (B2/S · Explosive)",
            B: [2], S: [], states: 2, nbr: "moore", wrap: true,
            defaultSeed: "seeds-pair",
            seeds: [
                ["seeds-pair", "Twin Ignition Sparks"],
                ["seeds-quad", "Four-Fold Photonic Ring"],
            ],
        },
        maze: {
            kind: "2d",
            name: "Maze Solver (B3/S12345)",
            B: [3], S: [1, 2, 3, 4, 5], states: 2, nbr: "moore", wrap: true,
            defaultSeed: "maze-core",
            seeds: [
                ["maze-core", "Symmetric Maze Kernel"],
                ["soup-30", "Dense Soup (30%)"],
            ],
        },
        starwars: {
            kind: "2d",
            name: "Star Wars (B2/S345 · 4-State)",
            B: [2], S: [3, 4, 5], states: 4, nbr: "moore", wrap: true,
            defaultSeed: "sw-nebula",
            seeds: [
                ["sw-nebula", "Refractory Nebula"],
                ["soup-18", "Random Soup (18%)"],
            ],
        },
        "brians-brain": {
            kind: "brain",
            name: "Brian's Brain (3-State Excitable)",
            B: [2], S: [], states: 3, nbr: "moore", wrap: true,
            defaultSeed: "brain-soup",
            seeds: [
                ["brain-soup", "Excitable Random Soup"],
                ["brain-bar", "Symmetric Pulse Bar"],
            ],
        },
        wireworld: {
            kind: "wire",
            name: "Wireworld (4-State Logic Circuit)",
            B: [], S: [], states: 4, nbr: "moore", wrap: false,
            defaultSeed: "ww-xor",
            seeds: [
                ["ww-xor", "XOR Logic Gate & Dual Clocks"],
                ["ww-diode", "Diode Bridge & Pulse Ring"],
            ],
        },
        "elem-1d": {
            kind: "1d",
            name: "Elementary 1D (Wolfram Rule 110)",
            rule1d: 110,
            defaultSeed: "w1d-single",
            seeds: [
                ["w1d-single", "Rule 110 · Impulse & Spaceships"],
                ["w1d-rand", "Rule 110 · Random Initial Row"],
                ["w1d-90", "Rule 90 · Sierpiński Triangle"],
                ["w1d-30", "Rule 30 · Chaotic Cone"],
            ],
        },
    };

    const STORAGE_KEY = "ca_lab_custom_rules_v1";
    let customPresets = loadCustomRules();

    function loadCustomRules() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    }

    function saveCustomRules() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
        } catch (_) {}
    }

    /* ===================== SIMULATION STATE ===================== */
    let activePresetId = embedded ? "life-in-life" : "life";
    let sim = {
        kind: "2d", // "2d" | "meta" | "brain" | "wire" | "1d"
        W: 120,
        H: 76,
        cells: null,
        next: null,
        age: null,
        B: new Set([3]),
        S: new Set([2, 3]),
        states: 2,
        nbr: "moore",
        wrap: true,
        rule1d: 110,
        gen: 0,
        births: 0,
        deaths: 0,
        liveCount: 0,
        // Life-in-Life hierarchical state
        MW: 18,
        MH: 15,
        M: 64,
        MACRO_PERIOD: 60,
        macro: null,
        macroNext: null,
        macroNbrCount: null,
        macroGen: 0,
        microTick: 0,
        activeTileFlags: null,
    };

    // Visual & Interaction state
    let running = true;
    let fps = 16;
    let fluxPalette = true;
    let tool = "draw"; // "draw" | "erase" | "stamp"
    let drawStateVal = 1;
    let stampName = "glider";
    let stampRot = 0;
    let editMetaScale = "macro"; // "macro" | "micro"
    let cursorCell = { x: -1, y: -1, inside: false };

    let cam = { ox: 0, oy: 0, cellPx: 8 };
    let DPR = Math.min(window.devicePixelRatio || 1, 2);
    let viewW = 1280;
    let viewH = 800;

    /* ===================== GRID HELPERS ===================== */
    function alloc2D(W, H) {
        sim.W = W;
        sim.H = H;
        sim.cells = new Uint8Array(W * H);
        sim.next = new Uint8Array(W * H);
        sim.age = new Uint16Array(W * H);
        sim.gen = 0;
        sim.births = 0;
        sim.deaths = 0;
        sim.liveCount = 0;
    }

    function setCell(x, y, val = 1) {
        if (x < 0 || x >= sim.W || y < 0 || y >= sim.H) return;
        const i = y * sim.W + x;
        sim.cells[i] = val;
        sim.age[i] = val > 0 ? 1 : 0;
    }

    function stampPattern2D(pts, cx, cy, rot = 0, val = 1) {
        const rotated = rotatePts(pts, rot);
        for (const [dx, dy] of rotated) {
            let x = cx + dx;
            let y = cy + dy;
            if (sim.wrap) {
                x = ((x % sim.W) + sim.W) % sim.W;
                y = ((y % sim.H) + sim.H) % sim.H;
            }
            setCell(x, y, val);
        }
    }

    function recountLive() {
        let c = 0;
        for (let i = 0; i < sim.cells.length; i++) {
            if (sim.cells[i] > 0) c++;
        }
        sim.liveCount = c;
    }

    /* ===================== LIFE-IN-LIFE (META B3/S23 ∈ MICRO B3/S23) ===================== */
    // Disjoint 8-direction glider waveguides inside M = 64x64 tiles (verified debris-free under pure B3/S23!)
    const META_CHANNELS = [
        [ 1,  1, 54, 60,  1,  1],
        [-1, -1,  9,  3, -1, -1],
        [-1,  1,  3, 54, -1,  1],
        [ 1, -1, 60,  9,  1, -1],
        [ 1,  0, 56, 20,  1,  1],
        [-1,  0,  7, 43, -1, -1],
        [ 0,  1, 43, 56, -1,  1],
        [ 0, -1, 20,  7,  1, -1],
    ];

    const META_PULSAR_OFFSETS = (() => {
        const out = [];
        for (const d of [2, 3, 4]) {
            for (const s of [-1, 1]) {
                out.push([s * d, -6], [s * d, -1], [s * d, 1], [s * d, 6]);
                out.push([-6, s * d], [-1, s * d], [1, s * d], [6, s * d]);
            }
        }
        return out;
    })();

    const META_EATER_SE = PATTERNS.eater;
    const META_GLIDER_SE = PATTERNS.glider;
    const META_BEACON = PATTERNS.beacon;
    const META_BLOCK = PATTERNS.block;

    function allocMeta(MW = 18, MH = 15, M = 64) {
        sim.MW = MW;
        sim.MH = MH;
        sim.M = M;
        alloc2D(MW * M, MH * M);
        sim.macro = new Uint8Array(MW * MH);
        sim.macroNext = new Uint8Array(MW * MH);
        sim.macroNbrCount = new Uint8Array(MW * MH);
        sim.activeTileFlags = new Uint8Array(MW * MH);
        sim.macroGen = 0;
        sim.microTick = 0;
    }

    function mWrapX(mx) {
        return sim.wrap ? ((mx % sim.MW) + sim.MW) % sim.MW : mx;
    }

    function mWrapY(my) {
        return sim.wrap ? ((my % sim.MH) + sim.MH) % sim.MH : my;
    }

    function computeMacroNeighbors() {
        const { MW, MH, macro, macroNbrCount } = sim;
        for (let my = 0; my < MH; my++) {
            for (let mx = 0; mx < MW; mx++) {
                let n = 0;
                if (sim.nbr === "moore") {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = mWrapX(mx + dx);
                            const ny = mWrapY(my + dy);
                            if (nx >= 0 && nx < MW && ny >= 0 && ny < MH) {
                                n += macro[ny * MW + nx];
                            }
                        }
                    }
                } else {
                    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                        const nx = mWrapX(mx + dx);
                        const ny = mWrapY(my + dy);
                        if (nx >= 0 && nx < MW && ny >= 0 && ny < MH) {
                            n += macro[ny * MW + nx];
                        }
                    }
                }
                macroNbrCount[my * MW + mx] = n;
            }
        }
    }

    function latchMetaHardware() {
        const { MW, MH, M, W, cells, age, macro, activeTileFlags } = sim;
        cells.fill(0);
        age.fill(0);
        computeMacroNeighbors();

        const putAbs = (ax, ay, isNew) => {
            const x = ((ax % W) + W) % W;
            const y = ((ay % sim.H) + sim.H) % sim.H;
            const i = y * W + x;
            cells[i] = 1;
            age[i] = isNew ? 1 : 20;
        };

        for (let my = 0; my < MH; my++) {
            for (let mx = 0; mx < MW; mx++) {
                const mi = my * MW + mx;
                const alive = macro[mi] === 1;
                const hasLiveNeighbor = sim.macroNbrCount[mi] > 0;
                activeTileFlags[mi] = alive || hasLiveNeighbor ? 1 : 0;

                const ox = mx * M;
                const oy = my * M;

                if (alive) {
                    // Luminous B3/S23 Pulsar core + 4 Beacons framing the metacell interior
                    for (const [dx, dy] of META_PULSAR_OFFSETS) {
                        putAbs(ox + 32 + dx, oy + 32 + dy, false);
                    }
                    for (const [bx, by] of [[16, 16], [44, 16], [16, 44], [44, 44]]) {
                        for (const [dx, dy] of META_BEACON) {
                            putAbs(ox + bx + dx, oy + by + dy, false);
                        }
                    }
                } else {
                    // Quiescent B3/S23 Blocks signifying dormant state |0⟩
                    for (const [bx, by] of [[21, 21], [41, 21], [21, 41], [41, 41]]) {
                        for (const [dx, dy] of META_BLOCK) {
                            putAbs(ox + bx + dx, oy + by + dy, false);
                        }
                    }
                }

                // Only place Boundary Eaters + Outbound Gliders on active or receiver tiles
                if (activeTileFlags[mi]) {
                    for (const [dx, dy, sx, sy, fx, fy] of META_CHANNELS) {
                        const rx = sx + 12 * fx - dx * M;
                        const ry = sy + 12 * fy - dy * M;
                        for (const [ex, ey] of flipTransform(META_EATER_SE, fx, fy)) {
                            putAbs(ox + rx + ex, oy + ry + ey, false);
                        }
                        if (alive) {
                            const nx = mWrapX(mx + dx);
                            const ny = mWrapY(my + dy);
                            if (nx >= 0 && nx < MW && ny >= 0 && ny < MH) {
                                for (const [gx, gy] of flipTransform(META_GLIDER_SE, fx, fy)) {
                                    putAbs(ox + sx + gx, oy + sy + gy, true);
                                }
                            }
                        }
                    }
                }
            }
        }
        recountLive();
    }

    function stepMicroB3S23() {
        const { MW, MH, M, W, H, cells, next, age, activeTileFlags } = sim;
        let births = 0;
        let deaths = 0;
        let total = 0;

        // Toroidal pure B3/S23 step over active metacells (skipping quiet still-life tiles!)
        for (let my = 0; my < MH; my++) {
            for (let mx = 0; mx < MW; mx++) {
                const mi = my * MW + mx;
                const ox = mx * M;
                const oy = my * M;
                if (!activeTileFlags[mi]) {
                    // Quiet blocks stay invariant; copy & add block count (16)
                    for (let ly = 0; ly < M; ly++) {
                        const row = (oy + ly) * W + ox;
                        for (let lx = 0; lx < M; lx++) {
                            const v = cells[row + lx];
                            next[row + lx] = v;
                            if (v) total++;
                        }
                    }
                    continue;
                }

                for (let ly = 0; ly < M; ly++) {
                    const y = oy + ly;
                    const ym = y === 0 ? H - 1 : y - 1;
                    const yp = y === H - 1 ? 0 : y + 1;
                    const r0 = ym * W;
                    const r1 = y * W;
                    const r2 = yp * W;
                    for (let lx = 0; lx < M; lx++) {
                        const x = ox + lx;
                        const xm = x === 0 ? W - 1 : x - 1;
                        const xp = x === W - 1 ? 0 : x + 1;
                        const n =
                            cells[r0 + xm] + cells[r0 + x] + cells[r0 + xp] +
                            cells[r1 + xm] + cells[r1 + xp] +
                            cells[r2 + xm] + cells[r2 + x] + cells[r2 + xp];
                        const idx = r1 + x;
                        const a = cells[idx];
                        const nv = n === 3 || (a && n === 2) ? 1 : 0;
                        next[idx] = nv;
                        if (nv) {
                            total++;
                            if (!a) {
                                births++;
                                age[idx] = 1;
                            } else {
                                age[idx] = Math.min(65000, age[idx] + 1);
                            }
                        } else if (a) {
                            deaths++;
                            age[idx] = 0;
                        }
                    }
                }
            }
        }
        const tmp = sim.cells;
        sim.cells = sim.next;
        sim.next = tmp;
        sim.births = births;
        sim.deaths = deaths;
        sim.liveCount = total;
        sim.gen++;
        sim.microTick++;

        if (sim.microTick >= sim.MACRO_PERIOD) {
            advanceMacroGeneration();
        }
    }

    function advanceMacroGeneration() {
        const { MW, MH, macro, macroNext, macroNbrCount, B, S } = sim;
        computeMacroNeighbors();
        for (let i = 0; i < MW * MH; i++) {
            const a = macro[i];
            const n = macroNbrCount[i];
            macroNext[i] = a ? (S.has(n) ? 1 : 0) : B.has(n) ? 1 : 0;
        }
        const tmp = sim.macro;
        sim.macro = sim.macroNext;
        sim.macroNext = tmp;
        sim.macroGen++;
        sim.microTick = 0;
        latchMetaHardware();
    }

    function stepMacroFull() {
        const remaining = sim.MACRO_PERIOD - sim.microTick;
        for (let k = 0; k < remaining; k++) {
            stepMicroB3S23();
        }
    }

    /* ===================== STANDARD 2D & 1D STEP ENGINES ===================== */
    function step2D() {
        const { W, H, cells, next, age, B, S, states, nbr, wrap, kind } = sim;
        let births = 0;
        let deaths = 0;
        let total = 0;

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const a = cells[i];

                if (kind === "wire") {
                    // 0=empty, 1=head, 2=tail, 3=conductor
                    if (a === 0) {
                        next[i] = 0;
                    } else if (a === 1) {
                        next[i] = 2;
                        age[i] = 1;
                    } else if (a === 2) {
                        next[i] = 3;
                        age[i] = 10;
                    } else {
                        let heads = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                let nx = x + dx, ny = y + dy;
                                if (wrap) {
                                    nx = (nx + W) % W;
                                    ny = (ny + H) % H;
                                } else if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                                if (cells[ny * W + nx] === 1) heads++;
                            }
                        }
                        if (heads === 1 || heads === 2) {
                            next[i] = 1;
                            births++;
                            age[i] = 1;
                        } else {
                            next[i] = 3;
                        }
                    }
                    if (next[i] > 0) total++;
                    continue;
                }

                // Count state==1 ("live / firing") neighbors
                let n = 0;
                if (nbr === "moore") {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            let nx = x + dx, ny = y + dy;
                            if (wrap) {
                                nx = (nx + W) % W;
                                ny = (ny + H) % H;
                            } else if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                            if (cells[ny * W + nx] === 1) n++;
                        }
                    }
                } else {
                    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                        let nx = x + dx, ny = y + dy;
                        if (wrap) {
                            nx = (nx + W) % W;
                            ny = (ny + H) % H;
                        } else if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                        if (cells[ny * W + nx] === 1) n++;
                    }
                }

                let nv = 0;
                if (kind === "brain") {
                    // 0=ready, 1=firing, 2=refractory
                    if (a === 0) nv = n === 2 ? 1 : 0;
                    else if (a === 1) nv = 2;
                    else nv = 0;
                } else if (states <= 2) {
                    nv = a ? (S.has(n) ? 1 : 0) : B.has(n) ? 1 : 0;
                } else {
                    // Generations rule B/S/K: only state 0 births, only state 1 survives, else decays 1->2->...->K-1->0
                    if (a === 0) nv = B.has(n) ? 1 : 0;
                    else if (a === 1) nv = S.has(n) ? 1 : 2;
                    else nv = a + 1 < states ? a + 1 : 0;
                }

                next[i] = nv;
                if (nv === 1 && a !== 1) births++;
                if (nv !== 1 && a === 1) deaths++;
                if (nv > 0) {
                    total++;
                    age[i] = nv === 1 ? (a === 1 ? Math.min(65000, age[i] + 1) : 1) : 1;
                } else {
                    age[i] = 0;
                }
            }
        }

        const tmp = sim.cells;
        sim.cells = sim.next;
        sim.next = tmp;
        sim.births = births;
        sim.deaths = deaths;
        sim.liveCount = total;
        sim.gen++;
    }

    function step1D() {
        const { W, H, cells, rule1d, gen } = sim;
        // Bottom-most active strip grows down until full, then scrolls up cleanly like strip chart
        const curRow = Math.min(gen, H - 1);
        const prevRow = curRow === H - 1 ? H - 1 : curRow;
        if (curRow === H - 1) {
            cells.copyWithin(0, W);
        }
        const srcY = curRow === H - 1 ? H - 2 : Math.max(0, curRow - 1);
        const dstY = curRow === H - 1 ? H - 1 : curRow;
        if (gen > 0) {
            let births = 0;
            for (let x = 0; x < W; x++) {
                const l = cells[srcY * W + ((x - 1 + W) % W)] ? 4 : 0;
                const c = cells[srcY * W + x] ? 2 : 0;
                const r = cells[srcY * W + ((x + 1) % W)] ? 1 : 0;
                const bit = (rule1d >> (l | c | r)) & 1;
                cells[dstY * W + x] = bit;
                if (bit) births++;
            }
            sim.births = births;
            sim.deaths = 0;
        }
        let total = 0;
        for (let i = 0; i < cells.length; i++) if (cells[i]) total++;
        sim.liveCount = total;
        sim.gen++;
    }

    function stepSim() {
        if (sim.kind === "meta") stepMicroB3S23();
        else if (sim.kind === "1d") step1D();
        else step2D();
    }

    /* ===================== SEED LOADERS ===================== */
    function loadSeed(seedId) {
        if (sim.kind === "meta") {
            allocMeta(18, 15, 64);
            const setM = (x, y) => {
                const nx = ((x % sim.MW) + sim.MW) % sim.MW;
                const ny = ((y % sim.MH) + sim.MH) % sim.MH;
                sim.macro[ny * sim.MW + nx] = 1;
            };
            if (seedId === "meta-pulsar") {
                for (const [dx, dy] of PATTERNS.pulsar) setM(2 + dx, 1 + dy);
            } else if (seedId === "meta-osc") {
                for (const [dx, dy] of PATTERNS.toad) setM(4 + dx, 6 + dy);
                for (const [dx, dy] of PATTERNS.beacon) setM(10 + dx, 5 + dy);
            } else if (seedId === "meta-rpent") {
                for (const [dx, dy] of PATTERNS.rpent) setM(7 + dx, 6 + dy);
            } else if (seedId === "meta-soup") {
                for (let i = 0; i < sim.macro.length; i++) {
                    sim.macro[i] = Math.random() < 0.28 ? 1 : 0;
                }
            } else {
                // Macro Glider aimed toward Macro Blinker & Block
                for (const [dx, dy] of PATTERNS.glider) setM(4 + dx, 3 + dy);
                for (const [dx, dy] of PATTERNS.blinker) setM(11 + dx, 9 + dy);
                for (const [dx, dy] of PATTERNS.block) setM(2 + dx, 10 + dy);
            }
            latchMetaHardware();
            fitCamera();
            return;
        }

        if (sim.kind === "1d") {
            alloc2D(156, 98);
            if (seedId === "w1d-90") sim.rule1d = 90;
            else if (seedId === "w1d-30") sim.rule1d = 30;
            else if (seedId === "w1d-single" || seedId === "w1d-rand") sim.rule1d = Number(document.getElementById("w1d-num").value) || 110;
            if (seedId === "w1d-rand") {
                for (let x = 0; x < sim.W; x++) setCell(x, 0, Math.random() < 0.45 ? 1 : 0);
            } else {
                setCell(Math.floor(sim.W * 0.52), 0, 1);
            }
            sim.gen = 1;
            // Warm up 26 rows so it reads immediately
            for (let k = 0; k < 26; k++) step1D();
            syncCustomControls();
            fitCamera();
            return;
        }

        alloc2D(128, 82);
        const cx = Math.floor(sim.W / 2);
        const cy = Math.floor(sim.H / 2);

        if (seedId === "gosper-and-eaters") {
            stampPattern2D(PATTERNS.gosper, 22, 18, 0, 1);
            stampPattern2D(PATTERNS.eater, 49, 44, 0, 1);
            stampPattern2D(PATTERNS.pulsar, 82, 26, 0, 1);
            stampPattern2D(PATTERNS.pentadecathlon, 78, 56, 0, 1);
        } else if (seedId === "rpent-classic") {
            stampPattern2D(PATTERNS.rpent, cx - 2, cy - 2, 0, 1);
            stampPattern2D(PATTERNS.glider, cx - 26, cy - 18, 0, 1);
            stampPattern2D(PATTERNS.glider, cx + 22, cy + 16, 2, 1);
        } else if (seedId === "pulsar-gallery") {
            stampPattern2D(PATTERNS.pulsar, cx - 22, cy - 6, 0, 1);
            stampPattern2D(PATTERNS.pulsar, cx + 10, cy - 6, 0, 1);
            stampPattern2D(PATTERNS.pentadecathlon, cx - 5, cy - 24, 0, 1);
            stampPattern2D(PATTERNS.toad, cx - 10, cy + 18, 0, 1);
            stampPattern2D(PATTERNS.beacon, cx + 8, cy + 18, 0, 1);
        } else if (seedId === "acorn-seed") {
            stampPattern2D(PATTERNS.acorn, cx - 3, cy - 1, 0, 1);
        } else if (seedId === "lwss-fleet") {
            for (let k = 0; k < 5; k++) {
                stampPattern2D(PATTERNS.lwss, 14 + k * 8, 12 + k * 12, 0, 1);
            }
            stampPattern2D(PATTERNS.pulsar, 86, 32, 0, 1);
        } else if (seedId === "hl-replicator") {
            stampPattern2D(PATTERNS.replicator, cx - 18, cy - 2, 0, 1);
            stampPattern2D(PATTERNS.replicator, cx + 14, cy - 2, 0, 1);
        } else if (seedId === "hl-bomber") {
            stampPattern2D(PATTERNS.replicator, cx - 2, cy - 2, 0, 1);
            stampPattern2D(PATTERNS.glider, cx - 20, cy - 16, 0, 1);
        } else if (seedId === "dn-core") {
            for (let dy = -12; dy <= 12; dy++) {
                for (let dx = -12; dx <= 12; dx++) {
                    if ((Math.abs(dx) <= 2 || Math.abs(dy) <= 2) && (dx + dy) % 3 !== 0) {
                        setCell(cx + dx, cy + dy, 1);
                    }
                }
            }
        } else if (seedId === "seeds-pair") {
            setCell(cx - 1, cy, 1);
            setCell(cx + 1, cy, 1);
            setCell(cx, cy - 2, 1);
            setCell(cx, cy + 2, 1);
        } else if (seedId === "seeds-quad") {
            for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
                setCell(cx + dx, cy + dy, 1);
                setCell(cx + dx + 1, cy + dy, 1);
            }
        } else if (seedId === "maze-core") {
            for (let y = cy - 14; y <= cy + 14; y++) {
                for (let x = cx - 18; x <= cx + 18; x++) {
                    if (Math.random() < 0.34) setCell(x, y, 1);
                }
            }
        } else if (seedId === "sw-nebula") {
            for (let y = cy - 18; y <= cy + 18; y++) {
                for (let x = cx - 24; x <= cx + 24; x++) {
                    if (Math.random() < 0.24) setCell(x, y, 1);
                }
            }
        } else if (seedId === "brain-soup") {
            for (let y = 14; y < sim.H - 14; y++) {
                for (let x = 18; x < sim.W - 18; x++) {
                    if (Math.random() < 0.16) setCell(x, y, 1);
                }
            }
        } else if (seedId === "brain-bar") {
            for (let dx = -16; dx <= 16; dx++) {
                setCell(cx + dx, cy, 1);
                setCell(cx + dx, cy + 2, 1);
            }
        } else if (seedId === "ww-xor" || seedId === "ww-diode") {
            buildWireworldCircuit(seedId);
        } else {
            const p = seedId === "soup-48" ? 0.48 : seedId === "soup-30" ? 0.30 : seedId === "soup-22" ? 0.22 : seedId === "soup-18" ? 0.18 : 0.25;
            for (let y = 10; y < sim.H - 10; y++) {
                for (let x = 14; x < sim.W - 14; x++) {
                    if (Math.random() < p) setCell(x, y, 1);
                }
            }
        }

        recountLive();
        fitCamera();
    }

    function buildWireworldCircuit(kind) {
        const cx = 36;
        const cy = 24;
        const wire = (x, y, s = 3) => setCell(x, y, s);
        const loopClock = (lx, ly, len = 12, headOffset = 0) => {
            const path = [];
            for (let x = 1; x < len - 1; x++) path.push([lx + x, ly]);
            path.push([lx + len - 1, ly + 1]);
            for (let x = len - 2; x >= 1; x--) path.push([lx + x, ly + 2]);
            path.push([lx, ly + 1]);
            path.forEach(([x, y], idx) => {
                if (idx === headOffset % path.length) wire(x, y, 1);
                else if (idx === (headOffset + path.length - 1) % path.length) wire(x, y, 2);
                else wire(x, y, 3);
            });
        };
        const hWire = (x1, x2, y) => {
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) wire(x, y, 3);
        };
        const vWire = (x, y1, y2) => {
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) wire(x, y, 3);
        };

        // Top & bottom clock generators
        loopClock(cx - 12, cy - 6, 12, 3);
        loopClock(cx - 12, cy + 10, 14, 7);

        if (kind === "ww-xor") {
            // Wireworld classic XOR gate fed by 2 unequal-period clocks
            hWire(cx, cx + 14, cy - 5);
            hWire(cx + 2, cx + 14, cy + 11);
            vWire(cx + 14, cy - 5, cy + 1);
            vWire(cx + 14, cy + 5, cy + 11);

            // XOR diamond junction around (cx+16, cy+3)
            wire(cx + 15, cy + 1, 3);
            wire(cx + 16, cy + 1, 3);
            wire(cx + 17, cy + 2, 3);
            wire(cx + 15, cy + 5, 3);
            wire(cx + 16, cy + 5, 3);
            wire(cx + 17, cy + 4, 3);
            wire(cx + 16, cy + 2, 3);
            wire(cx + 16, cy + 3, 3);
            wire(cx + 16, cy + 4, 3);
            wire(cx + 15, cy + 3, 0);
            wire(cx + 17, cy + 3, 0);
            wire(cx + 18, cy + 2, 3);
            wire(cx + 18, cy + 3, 3);
            wire(cx + 18, cy + 4, 3);

            // Output bus + return feedback indicator loop
            hWire(cx + 19, cx + 48, cy + 3);
            loopClock(cx + 48, cy + 2, 10, 2);
            // Reverse diode spur along middle rail
            hWire(cx + 30, cx + 46, cy - 5);
            wire(cx + 37, cy - 6, 3);
            wire(cx + 38, cy - 6, 3);
            wire(cx + 37, cy - 4, 3);
            wire(cx + 38, cy - 4, 3);
            wire(cx + 38, cy - 5, 0);
        } else {
            // Diode ring + twin pulse buses
            hWire(cx, cx + 44, cy - 5);
            // Forward Diode
            wire(cx + 20, cy - 6, 3);
            wire(cx + 21, cy - 6, 3);
            wire(cx + 20, cy - 4, 3);
            wire(cx + 21, cy - 4, 3);
            wire(cx + 21, cy - 5, 0);
            // Second rail + Reverse diode (blocks pulses!)
            hWire(cx + 2, cx + 44, cy + 11);
            wire(cx + 24, cy + 10, 3);
            wire(cx + 25, cy + 10, 3);
            wire(cx + 24, cy + 12, 3);
            wire(cx + 25, cy + 12, 3);
            wire(cx + 24, cy + 11, 0);
            // Output return loop
            vWire(cx + 44, cy - 5, cy + 11);
        }
    }

    /* ===================== CAMERA & LAYOUT ===================== */
    function panelsHidden() {
        return (
            embedded ||
            document.documentElement.classList.contains("panels-hidden") ||
            window.innerWidth <= 760
        );
    }

    function fitCamera(customZoomMul = 1) {
        let padL = 24, padR = 24, padT = 24, padB = 24;
        if (!panelsHidden()) {
            padL = 338;
            padR = 366;
            padT = 28;
            padB = 28;
        }
        const availW = Math.max(200, viewW - padL - padR);
        const availH = Math.max(200, viewH - padT - padB);
        const rawCell = Math.min(availW / sim.W, availH / sim.H) * customZoomMul;
        cam.cellPx = Math.max(0.25, rawCell);
        const centerX = padL + availW / 2;
        const centerY = padT + availH / 2;
        cam.ox = centerX - (sim.W * cam.cellPx) / 2;
        cam.oy = centerY - (sim.H * cam.cellPx) / 2;
        if (embedded && sim.kind === "meta") {
            // Focus poster/hover tightly on the active Macro Glider + Pulsar waveguides!
            zoomToMetacell(5.5, 4.5, 2.35);
        }
    }

    function zoomToMetacell(mx, my, targetMicroPx = 7.0) {
        const padL = panelsHidden() ? 20 : 338;
        const padR = panelsHidden() ? 20 : 366;
        const centerX = padL + Math.max(180, viewW - padL - padR) / 2;
        const centerY = viewH / 2;
        cam.cellPx = targetMicroPx;
        const worldX = mx * sim.M + sim.M * 0.5;
        const worldY = my * sim.M + sim.M * 0.5;
        cam.ox = centerX - worldX * cam.cellPx;
        cam.oy = centerY - worldY * cam.cellPx;
    }

    function zoomAt(screenX, screenY, factor) {
        const oldPx = cam.cellPx;
        const minPx = sim.kind === "meta" ? 0.32 : 2.0;
        const maxPx = sim.kind === "meta" ? 28.0 : 38.0;
        const newPx = Math.min(maxPx, Math.max(minPx, oldPx * factor));
        const worldX = (screenX - cam.ox) / oldPx;
        const worldY = (screenY - cam.oy) / oldPx;
        cam.cellPx = newPx;
        cam.ox = screenX - worldX * newPx;
        cam.oy = screenY - worldY * newPx;
    }

    function screenToCell(sx, sy) {
        return {
            x: Math.floor((sx - cam.ox) / cam.cellPx),
            y: Math.floor((sy - cam.oy) / cam.cellPx),
        };
    }

    /* ===================== CANVAS RENDERER ===================== */
    function cellFillColor(val, ageVal) {
        if (sim.kind === "wire") {
            if (val === 1) return PALETTE.red; // Electron Head
            if (val === 2) return PALETTE.blue; // Electron Tail
            return "#3e4e5c"; // Copper conductor
        }
        if (sim.kind === "brain") {
            return val === 1 ? PALETTE.red : PALETTE.blue;
        }
        if (sim.states > 2 && val > 1) {
            const t = (val - 1) / Math.max(1, sim.states - 2);
            return t < 0.5 ? PALETTE.blue : "rgba(29, 95, 167, 0.45)";
        }
        if (fluxPalette && ageVal <= 2) {
            return PALETTE.red;
        }
        return PALETTE.ink;
    }

    function drawMetaGrid() {
        const { MW, MH, M, W, H, cells, age, macro, macroNbrCount, microTick, MACRO_PERIOD } = sim;
        const tilePx = M * cam.cellPx;
        const cellPx = cam.cellPx;

        // Visible macro range
        const mx0 = Math.max(0, Math.floor(-cam.ox / tilePx));
        const mx1 = Math.min(MW - 1, Math.ceil((viewW - cam.ox) / tilePx));
        const my0 = Math.max(0, Math.floor(-cam.oy / tilePx));
        const my1 = Math.min(MH - 1, Math.ceil((viewH - cam.oy) / tilePx));

        // 1. Subtle macro cell state backdrop + waveguide links
        for (let my = my0; my <= my1; my++) {
            for (let mx = mx0; mx <= mx1; mx++) {
                const mi = my * MW + mx;
                const sx = cam.ox + mx * tilePx;
                const sy = cam.oy + my * tilePx;
                const alive = macro[mi] === 1;

                if (alive) {
                    ctx.fillStyle = cellPx < 2.2 ? "rgba(214, 58, 34, 0.13)" : "rgba(239, 244, 230, 0.62)";
                    ctx.fillRect(sx, sy, tilePx, tilePx);
                } else if (macroNbrCount[mi] > 0 && cellPx >= 1.2) {
                    ctx.fillStyle = "rgba(29, 95, 167, 0.05)";
                    ctx.fillRect(sx, sy, tilePx, tilePx);
                }

                // Draw hairline metapixel border
                ctx.strokeStyle = alive ? "rgba(214, 58, 34, 0.55)" : "rgba(20, 32, 43, 0.20)";
                ctx.lineWidth = alive ? 1.3 : 0.8;
                ctx.strokeRect(sx + 0.5, sy + 0.5, tilePx - 1, tilePx - 1);
            }
        }

        // 2. Micro B3/S23 cells inside visible window!
        const vx0 = Math.max(0, Math.floor(-cam.ox / cellPx));
        const vx1 = Math.min(W - 1, Math.ceil((viewW - cam.ox) / cellPx));
        const vy0 = Math.max(0, Math.floor(-cam.oy / cellPx));
        const vy1 = Math.min(H - 1, Math.ceil((viewH - cam.oy) / cellPx));

        const gap = cellPx >= 6 ? 0.8 : 0;
        const drawW = Math.max(1.15, cellPx - gap);

        for (let y = vy0; y <= vy1; y++) {
            const py = cam.oy + y * cellPx;
            const row = y * W;
            for (let x = vx0; x <= vx1; x++) {
                const v = cells[row + x];
                if (!v) continue;
                const px = cam.ox + x * cellPx;
                ctx.fillStyle = fluxPalette && age[row + x] <= 2 ? PALETTE.red : PALETTE.ink;
                ctx.fillRect(px, py, drawW, drawW);
            }
        }

        // 3. Fine micro-cell grid when zoomed deep inside a metacell
        if (cellPx >= 6.5) {
            ctx.strokeStyle = "rgba(58, 108, 78, 0.22)";
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            for (let x = vx0; x <= vx1 + 1; x++) {
                const px = Math.round(cam.ox + x * cellPx) + 0.5;
                ctx.moveTo(px, Math.max(0, cam.oy + vy0 * cellPx));
                ctx.lineTo(px, Math.min(viewH, cam.oy + (vy1 + 1) * cellPx));
            }
            for (let y = vy0; y <= vy1 + 1; y++) {
                const py = Math.round(cam.oy + y * cellPx) + 0.5;
                ctx.moveTo(Math.max(0, cam.ox + vx0 * cellPx), py);
                ctx.lineTo(Math.min(viewW, cam.ox + (vx1 + 1) * cellPx), py);
            }
            ctx.stroke();
        }

        // 4. Schematic Metacell Rule Badge when tilePx >= 96
        if (tilePx >= 96 && !embedded) {
            ctx.font = "600 9.5px 'Martian Mono', monospace";
            ctx.textBaseline = "top";
            for (let my = my0; my <= my1; my++) {
                for (let mx = mx0; mx <= mx1; mx++) {
                    const mi = my * MW + mx;
                    const sx = cam.ox + mx * tilePx;
                    const sy = cam.oy + my * tilePx;
                    const alive = macro[mi] === 1;
                    const nbrs = macroNbrCount[mi];
                    if (!alive && nbrs === 0) continue;

                    const willLive = alive ? sim.S.has(nbrs) : sim.B.has(nbrs);
                    const verdict = alive ? (willLive ? "SURV" : "DIE") : (willLive ? "BIRTH" : "IDLE");
                    const label = `M(${mx},${my}) · N=${nbrs} → ${verdict}`;

                    ctx.fillStyle = "rgba(239, 244, 230, 0.88)";
                    ctx.fillRect(sx + 6, sy + 6, Math.min(tilePx - 12, label.length * 6.2 + 10), 15);
                    ctx.fillStyle = willLive ? PALETTE.red : PALETTE.ink;
                    ctx.fillText(label, sx + 10, sy + 8);

                    // Micro-clock bar along bottom of metacell
                    ctx.fillStyle = alive ? PALETTE.red : PALETTE.blue;
                    ctx.fillRect(sx + 2, sy + tilePx - 4, (tilePx - 4) * (microTick / MACRO_PERIOD), 2.5);
                }
            }
        }

        // 5. Outer Macro Frame
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(cam.ox, cam.oy, W * cellPx, H * cellPx);

        // 6. Cursor highlight (Macro box or Micro cell)
        if (cursorCell.inside) {
            const { x, y } = cursorCell;
            if (x >= 0 && x < W && y >= 0 && y < H) {
                if (cellPx >= 4.5 && editMetaScale === "micro") {
                    ctx.strokeStyle = PALETTE.red;
                    ctx.lineWidth = 1.6;
                    ctx.strokeRect(cam.ox + x * cellPx, cam.oy + y * cellPx, cellPx, cellPx);
                } else {
                    const mx = Math.floor(x / M);
                    const my = Math.floor(y / M);
                    if (tool === "stamp") {
                        const pts = rotatePts(PATTERNS[stampName] || PATTERNS.glider, stampRot);
                        ctx.fillStyle = "rgba(214, 58, 34, 0.34)";
                        ctx.strokeStyle = PALETTE.red;
                        ctx.lineWidth = 1.4;
                        for (const [dx, dy] of pts) {
                            const tx = (((mx + dx) % MW) + MW) % MW;
                            const ty = (((my + dy) % MH) + MH) % MH;
                            ctx.fillRect(cam.ox + tx * tilePx, cam.oy + ty * tilePx, tilePx, tilePx);
                            ctx.strokeRect(cam.ox + tx * tilePx, cam.oy + ty * tilePx, tilePx, tilePx);
                        }
                    } else {
                        ctx.strokeStyle = PALETTE.red;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(cam.ox + mx * tilePx, cam.oy + my * tilePx, tilePx, tilePx);
                    }
                }
            }
        }
    }

    function drawStandardGrid() {
        const { W, H, cells, age } = sim;
        const cellPx = cam.cellPx;
        const gw = W * cellPx;
        const gh = H * cellPx;

        // Backing drafting sheet for bounded/grid area
        ctx.fillStyle = "rgba(239, 244, 230, 0.56)";
        ctx.fillRect(cam.ox, cam.oy, gw, gh);

        const vx0 = Math.max(0, Math.floor(-cam.ox / cellPx));
        const vx1 = Math.min(W - 1, Math.ceil((viewW - cam.ox) / cellPx));
        const vy0 = Math.max(0, Math.floor(-cam.oy / cellPx));
        const vy1 = Math.min(H - 1, Math.ceil((viewH - cam.oy) / cellPx));

        // Grid hairlines
        if (cellPx >= 4.2) {
            ctx.strokeStyle = cellPx >= 10 ? "rgba(58, 108, 78, 0.24)" : "rgba(58, 108, 78, 0.13)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = vx0; x <= vx1 + 1; x++) {
                const px = Math.round(cam.ox + x * cellPx) + 0.5;
                ctx.moveTo(px, cam.oy + vy0 * cellPx);
                ctx.lineTo(px, cam.oy + (vy1 + 1) * cellPx);
            }
            for (let y = vy0; y <= vy1 + 1; y++) {
                const py = Math.round(cam.oy + y * cellPx) + 0.5;
                ctx.moveTo(cam.ox + vx0 * cellPx, py);
                ctx.lineTo(cam.ox + (vx1 + 1) * cellPx, py);
            }
            ctx.stroke();
        }

        const gap = cellPx >= 7 ? 1 : 0;
        const cw = Math.max(1, cellPx - gap);

        for (let y = vy0; y <= vy1; y++) {
            const py = cam.oy + y * cellPx + gap * 0.5;
            const row = y * W;
            for (let x = vx0; x <= vx1; x++) {
                const v = cells[row + x];
                if (!v) continue;
                const px = cam.ox + x * cellPx + gap * 0.5;
                ctx.fillStyle = sim.kind === "1d"
                    ? (fluxPalette && y === Math.min(sim.gen - 1, H - 1) ? PALETTE.red : PALETTE.ink)
                    : cellFillColor(v, age[row + x]);
                ctx.fillRect(px, py, cw, cw);
            }
        }

        // Border frame
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(cam.ox, cam.oy, gw, gh);

        // Hover / stamp preview
        if (cursorCell.inside && !embedded) {
            const { x, y } = cursorCell;
            if (x >= 0 && x < W && y >= 0 && y < H) {
                if (tool === "stamp" && sim.kind !== "1d") {
                    const pts = rotatePts(PATTERNS[stampName] || PATTERNS.glider, stampRot);
                    ctx.fillStyle = "rgba(214, 58, 34, 0.34)";
                    ctx.strokeStyle = PALETTE.red;
                    ctx.lineWidth = 1.2;
                    for (const [dx, dy] of pts) {
                        const px = x + dx;
                        const py = y + dy;
                        if (px < 0 || px >= W || py < 0 || py >= H) continue;
                        ctx.fillRect(cam.ox + px * cellPx, cam.oy + py * cellPx, cellPx, cellPx);
                        ctx.strokeRect(cam.ox + px * cellPx, cam.oy + py * cellPx, cellPx, cellPx);
                    }
                } else {
                    ctx.strokeStyle = PALETTE.red;
                    ctx.lineWidth = 1.6;
                    ctx.strokeRect(cam.ox + x * cellPx, cam.oy + y * cellPx, cellPx, cellPx);
                }
            }
        }
    }

    function render() {
        ctx.clearRect(0, 0, viewW, viewH);
        if (sim.kind === "meta") drawMetaGrid();
        else drawStandardGrid();
        updateStats();
    }

    /* ===================== UI & RULE STUDIO SYNC ===================== */
    const elPreset = document.getElementById("preset-sel");
    const elCustomGroup = document.getElementById("custom-optgroup");
    const elSeed = document.getElementById("seed-sel");
    const elRuleEq = document.getElementById("rule-eq");
    const elRuleInput = document.getElementById("rule-input");
    const elStates = document.getElementById("states-sel");
    const elNbr = document.getElementById("nbr-sel");
    const elWrap = document.getElementById("wrap-sel");
    const elPlay = document.getElementById("play-btn");
    const elMacroBtn = document.getElementById("macro-step-btn");
    const elInspectBtn = document.getElementById("inspect-btn");
    const elMetaScaleRow = document.getElementById("meta-scale-row");
    const elCustom2D = document.getElementById("custom-2d-studio");
    const elCustom1D = document.getElementById("custom-1d-studio");
    const elW1DNum = document.getElementById("w1d-num");
    const elW1DTable = document.getElementById("w1d-table");
    const elDelBtn = document.getElementById("del-rule-btn");

    // Build 0..8 B/S toggle chips
    function initBSToggles() {
        const mkRow = (containerId, setName) => {
            const box = document.getElementById(containerId);
            box.innerHTML = "";
            for (let n = 0; n <= 8; n++) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "bs-bit";
                btn.dataset.n = String(n);
                btn.textContent = String(n);
                btn.addEventListener("click", () => {
                    const targetSet = setName === "B" ? sim.B : sim.S;
                    if (targetSet.has(n)) targetSet.delete(n);
                    else targetSet.add(n);
                    if (sim.kind === "brain" || sim.kind === "wire") {
                        sim.kind = "2d";
                    }
                    syncCustomControls();
                });
                box.appendChild(btn);
            }
        };
        mkRow("b-bits", "B");
        mkRow("s-bits", "S");
    }

    function formatBSString() {
        const b = [...sim.B].sort((a, b) => a - b).join("");
        const s = [...sim.S].sort((a, b) => a - b).join("");
        const k = sim.states > 2 ? `/${sim.states}` : "";
        return `B${b}/S${s}${k}`;
    }

    function parseRuleString(raw) {
        const str = raw.trim().toUpperCase();
        // Accepts B36/S23, B36/S23/4, or 23/3 (S/B ConwayLife style)
        let bNums = [];
        let sNums = [];
        let kNum = null;
        if (str.includes("B") || str.includes("S")) {
            const parts = str.split("/");
            for (const part of parts) {
                if (part.startsWith("B")) {
                    bNums = [...part.slice(1)].map(Number).filter((x) => x >= 0 && x <= 8);
                } else if (part.startsWith("S")) {
                    sNums = [...part.slice(1)].map(Number).filter((x) => x >= 0 && x <= 8);
                } else if (/^\d+$/.test(part)) {
                    kNum = Math.max(2, Math.min(8, Number(part)));
                }
            }
        } else if (/^\d*\/\d*(\/\d+)?$/.test(str)) {
            const parts = str.split("/");
            sNums = [...parts[0]].map(Number).filter((x) => x >= 0 && x <= 8);
            bNums = [...parts[1]].map(Number).filter((x) => x >= 0 && x <= 8);
            if (parts[2]) kNum = Math.max(2, Math.min(8, Number(parts[2])));
        } else {
            return false;
        }
        sim.B = new Set(bNums);
        sim.S = new Set(sNums);
        if (kNum !== null) sim.states = kNum;
        if (sim.kind === "brain" || sim.kind === "wire") sim.kind = "2d";
        return true;
    }

    function renderW1DTable() {
        elW1DTable.innerHTML = "";
        for (let code = 7; code >= 0; code--) {
            const outBit = (sim.rule1d >> code) & 1;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "w1d-case" + (outBit ? " on" : "");
            btn.innerHTML = `
              <span class="w1d-bits">
                <span class="w1d-sq ${(code & 4) ? "fill" : ""}"></span>
                <span class="w1d-sq ${(code & 2) ? "fill" : ""}"></span>
                <span class="w1d-sq ${(code & 1) ? "fill" : ""}"></span>
              </span>
              <span>→ ${outBit}</span>`;
            btn.addEventListener("click", () => {
                sim.rule1d ^= (1 << code);
                elW1DNum.value = String(sim.rule1d);
                renderW1DTable();
                updateRuleEquation();
            });
            elW1DTable.appendChild(btn);
        }
    }

    function updateRuleEquation() {
        if (sim.kind === "meta") {
            elRuleEq.textContent = `Meta ${formatBSString()} ∈ Micro B3/S23 · 64×64 metacells · τ=${sim.MACRO_PERIOD}`;
        } else if (sim.kind === "1d") {
            elRuleEq.textContent = `Wolfram Rule ${sim.rule1d} : {0,1}³ → {0,1} · Binary ${sim.rule1d.toString(2).padStart(8, "0")}`;
        } else if (sim.kind === "wire") {
            elRuleEq.textContent = "Wireworld · Conductor → Head iff #{heads} ∈ {1, 2} · Head → Tail → Conductor";
        } else if (sim.kind === "brain") {
            elRuleEq.textContent = "Brian's Brain · Ready → Firing iff #{firing} = 2 · Firing → Refractory → Ready";
        } else {
            const nName = sim.nbr === "moore" ? "Moore r=1" : "von Neumann r=1";
            const edgeName = sim.wrap ? "Toroidal" : "Bounded";
            elRuleEq.textContent = `${formatBSString()} · States=${sim.states} · ${nName} · ${edgeName}`;
        }
    }

    function syncCustomControls() {
        const is1D = sim.kind === "1d";
        const isMeta = sim.kind === "meta";
        const isSpecial = sim.kind === "wire" || sim.kind === "brain";

        elCustom2D.hidden = is1D;
        elCustom1D.hidden = !is1D;
        elMacroBtn.hidden = !isMeta;
        elInspectBtn.hidden = !isMeta;
        elMetaScaleRow.hidden = !isMeta;
        document.getElementById("custom-scope-tag").textContent = isMeta ? "(Macro Rule)" : "(Live Playable)";

        if (!is1D) {
            const maxNbr = sim.nbr === "moore" ? 8 : 4;
            document.querySelectorAll("#b-bits .bs-bit").forEach((b) => {
                const n = Number(b.dataset.n);
                b.classList.toggle("on", !isSpecial && sim.B.has(n));
                b.classList.toggle("disabled", isSpecial || n > maxNbr);
            });
            document.querySelectorAll("#s-bits .bs-bit").forEach((b) => {
                const n = Number(b.dataset.n);
                b.classList.toggle("on", !isSpecial && sim.S.has(n));
                b.classList.toggle("disabled", isSpecial || n > maxNbr);
            });
            elRuleInput.value = isSpecial ? (sim.kind === "wire" ? "Wireworld" : "B2/S/3 (Brain)") : formatBSString();
            elStates.value = String(sim.states);
            elStates.disabled = isMeta || isSpecial;
            elNbr.value = sim.nbr;
            elNbr.disabled = isSpecial;
            elWrap.value = sim.wrap ? "wrap" : "wall";
            elWrap.disabled = isSpecial;
        } else {
            elW1DNum.value = String(sim.rule1d);
            renderW1DTable();
        }

        // State brush swatches for multi-state automata
        const swatchBox = document.getElementById("state-palette");
        if (sim.kind === "wire") {
            swatchBox.hidden = false;
            swatchBox.innerHTML = [
                [3, "Conductor", "#3e4e5c"],
                [1, "Electron Head", PALETTE.red],
                [2, "Electron Tail", PALETTE.blue],
                [0, "Empty", PALETTE.paperHi],
            ].map(([v, lbl, col]) =>
                `<button type="button" class="swatch-btn ${drawStateVal === v ? "active" : ""}" data-sval="${v}">
                   <span class="swatch-dot" style="background:${col}"></span>${lbl}
                 </button>`
            ).join("");
        } else if (sim.kind === "brain") {
            swatchBox.hidden = false;
            swatchBox.innerHTML = [
                [1, "Firing", PALETTE.red],
                [2, "Refractory", PALETTE.blue],
                [0, "Ready", PALETTE.paperHi],
            ].map(([v, lbl, col]) =>
                `<button type="button" class="swatch-btn ${drawStateVal === v ? "active" : ""}" data-sval="${v}">
                   <span class="swatch-dot" style="background:${col}"></span>${lbl}
                 </button>`
            ).join("");
        } else {
            swatchBox.hidden = true;
            drawStateVal = 1;
        }
        swatchBox.querySelectorAll(".swatch-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                drawStateVal = Number(btn.dataset.sval);
                setTool(drawStateVal === 0 ? "erase" : "draw");
                syncCustomControls();
            });
        });

        updateRuleEquation();
    }

    function refreshSavedPresetsDropdown() {
        elCustomGroup.innerHTML = "";
        for (const [id, p] of Object.entries(customPresets)) {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = p.name;
            elCustomGroup.appendChild(opt);
        }
        elDelBtn.hidden = !customPresets[activePresetId];
    }

    function selectPreset(id) {
        const p = BUILTIN_PRESETS[id] || customPresets[id];
        if (!p) return;
        activePresetId = id;
        sim.kind = p.kind || "2d";
        sim.B = new Set(p.B || [3]);
        sim.S = new Set(p.S || [2, 3]);
        sim.states = p.states || 2;
        sim.nbr = p.nbr || "moore";
        sim.wrap = p.wrap !== undefined ? p.wrap : true;
        if (p.rule1d !== undefined) sim.rule1d = p.rule1d;

        const seeds = p.seeds || [
            ["gosper-and-eaters", "Gosper Gun & Oscillators"],
            ["rpent-classic", "R-Pentomino Seed"],
            ["soup-25", "Random Soup (25%)"],
        ];
        elSeed.innerHTML = seeds.map(([sid, lbl]) => `<option value="${sid}">${lbl}</option>`).join("");
        const chosenSeed = p.defaultSeed || seeds[0][0];
        elSeed.value = chosenSeed;

        elPreset.value = id;
        refreshSavedPresetsDropdown();
        syncCustomControls();
        loadSeed(chosenSeed);
        if (embedded && sim.kind === "meta") {
            // Pre-advance 18 micro-ticks so waveguide gliders are visibly crossing boundaries in preview
            for (let k = 0; k < 18; k++) stepMicroB3S23();
        }
    }

    function updateStats() {
        const genEl = document.getElementById("stat-gen");
        const popEl = document.getElementById("stat-pop");
        const fluxEl = document.getElementById("stat-flux");
        const viewEl = document.getElementById("stat-view");

        if (sim.kind === "meta") {
            const macroLive = sim.macro.reduce((a, b) => a + b, 0);
            genEl.textContent = `Macro ${sim.macroGen} · τ ${sim.microTick}/${sim.MACRO_PERIOD}`;
            popEl.textContent = `${macroLive} metacells (${sim.liveCount.toLocaleString()} micro)`;
        } else {
            const pct = ((sim.liveCount / Math.max(1, sim.W * sim.H)) * 100).toFixed(1);
            genEl.textContent = `Gen ${sim.gen}`;
            popEl.textContent = `${sim.liveCount.toLocaleString()} (${pct}%)`;
        }
        fluxEl.textContent = `+${sim.births} / −${sim.deaths}`;
        const baseScale = sim.kind === "meta" ? (cam.cellPx / 0.55) : (cam.cellPx / 6.0);
        const curText = cursorCell.inside && cursorCell.x >= 0 && cursorCell.x < sim.W && cursorCell.y >= 0 && cursorCell.y < sim.H
            ? sim.kind === "meta"
                ? `M(${Math.floor(cursorCell.x / sim.M)},${Math.floor(cursorCell.y / sim.M)})·(${cursorCell.x % sim.M},${cursorCell.y % sim.M})`
                : `(${cursorCell.x}, ${cursorCell.y})`
            : "(–, –)";
        viewEl.textContent = `${baseScale.toFixed(1)}× · ${curText}`;
        document.getElementById("zoom-val").textContent = `${baseScale.toFixed(1)}×`;
    }

    /* ===================== PAINT & PAN INTERACTION ===================== */
    let dragMode = null; // "paint" | "pan"
    let panStart = { x: 0, y: 0, ox: 0, oy: 0 };
    let lastPainted = "";

    function applyEditAt(sx, sy, forceErase = false) {
        const { x, y } = screenToCell(sx, sy);
        if (x < 0 || x >= sim.W || y < 0 || y >= sim.H) return;
        const val = forceErase || tool === "erase" ? 0 : drawStateVal;

        if (sim.kind === "meta") {
            if (cam.cellPx >= 4.5 && editMetaScale === "micro") {
                const key = `u:${x},${y}`;
                if (key === lastPainted) return;
                lastPainted = key;
                sim.cells[y * sim.W + x] = val ? 1 : 0;
                sim.age[y * sim.W + x] = val ? 1 : 0;
                const mx = Math.floor(x / sim.M);
                const my = Math.floor(y / sim.M);
                sim.activeTileFlags[my * sim.MW + mx] = 1;
                recountLive();
                return;
            }
            const mx = Math.floor(x / sim.M);
            const my = Math.floor(y / sim.M);
            if (tool === "stamp") {
                const pts = rotatePts(PATTERNS[stampName] || PATTERNS.glider, stampRot);
                for (const [dx, dy] of pts) {
                    const tx = (((mx + dx) % sim.MW) + sim.MW) % sim.MW;
                    const ty = (((my + dy) % sim.MH) + sim.MH) % sim.MH;
                    sim.macro[ty * sim.MW + tx] = 1;
                }
                latchMetaHardware();
                return;
            }
            const mKey = `m:${mx},${my}`;
            if (mKey === lastPainted) return;
            lastPainted = mKey;
            sim.macro[my * sim.MW + mx] = val ? 1 : 0;
            latchMetaHardware();
            return;
        }

        if (tool === "stamp" && sim.kind !== "1d") {
            stampPattern2D(PATTERNS[stampName] || PATTERNS.glider, x, y, stampRot, 1);
            recountLive();
            return;
        }

        const key = `${x},${y}`;
        if (key === lastPainted) return;
        lastPainted = key;
        if (sim.kind === "1d") {
            const targetRow = Math.min(sim.gen - 1, sim.H - 1);
            setCell(x, Math.max(0, y <= targetRow ? y : 0), val ? 1 : 0);
        } else {
            setCell(x, y, val);
        }
        recountLive();
    }

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("pointerdown", (e) => {
        if (e.button === 1 || e.button === 2 || e.shiftKey) {
            dragMode = "pan";
            panStart = { x: e.clientX, y: e.clientY, ox: cam.ox, oy: cam.oy };
            canvas.setPointerCapture(e.pointerId);
            return;
        }
        if (e.button === 0) {
            dragMode = "paint";
            lastPainted = "";
            canvas.setPointerCapture(e.pointerId);
            applyEditAt(e.clientX, e.clientY, false);
            render();
        }
    });

    canvas.addEventListener("pointermove", (e) => {
        const pt = screenToCell(e.clientX, e.clientY);
        cursorCell = { x: pt.x, y: pt.y, inside: true };

        if (dragMode === "pan") {
            cam.ox = panStart.ox + (e.clientX - panStart.x);
            cam.oy = panStart.oy + (e.clientY - panStart.y);
            render();
            return;
        }
        if (dragMode === "paint" && tool !== "stamp") {
            applyEditAt(e.clientX, e.clientY, false);
            render();
            return;
        }
        if (!running) render();
    });

    canvas.addEventListener("pointerup", () => {
        dragMode = null;
        lastPainted = "";
    });

    canvas.addEventListener("pointerleave", () => {
        cursorCell.inside = false;
        if (!running) render();
    });

    canvas.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.16 : 1 / 1.16;
            zoomAt(e.clientX, e.clientY, factor);
            render();
        },
        { passive: false }
    );

    /* ===================== CONTROL WIRING ===================== */
    function setTool(t) {
        tool = t;
        document.querySelectorAll(".tool-btn").forEach((b) => {
            b.classList.toggle("active", b.dataset.tool === t);
        });
        document.getElementById("stamp-wrap").hidden = t !== "stamp";
    }

    elPreset.addEventListener("change", () => selectPreset(elPreset.value));
    elSeed.addEventListener("change", () => loadSeed(elSeed.value));
    document.getElementById("seed-btn").addEventListener("click", () => loadSeed(elSeed.value));

    elPlay.addEventListener("click", () => {
        running = !running;
        elPlay.textContent = running ? "Running" : "Paused";
        elPlay.classList.toggle("active", running);
    });

    document.getElementById("step-btn").addEventListener("click", () => {
        stepSim();
        render();
    });

    elMacroBtn.addEventListener("click", () => {
        if (sim.kind === "meta") {
            stepMacroFull();
            render();
        }
    });

    document.getElementById("soup-btn").addEventListener("click", () => {
        if (sim.kind === "meta") {
            for (let i = 0; i < sim.macro.length; i++) sim.macro[i] = Math.random() < 0.28 ? 1 : 0;
            sim.macroGen = 0;
            sim.microTick = 0;
            latchMetaHardware();
        } else if (sim.kind === "1d") {
            sim.cells.fill(0);
            sim.gen = 1;
            for (let x = 0; x < sim.W; x++) setCell(x, 0, Math.random() < 0.45 ? 1 : 0);
            for (let k = 0; k < 24; k++) step1D();
        } else {
            const p = sim.kind === "wire" ? 0 : 0.26;
            for (let y = 0; y < sim.H; y++) {
                for (let x = 0; x < sim.W; x++) {
                    if (sim.kind === "wire") {
                        setCell(x, y, 0);
                    } else {
                        setCell(x, y, Math.random() < p ? 1 : 0);
                    }
                }
            }
            if (sim.kind === "wire") buildWireworldCircuit("ww-xor");
            sim.gen = 0;
            recountLive();
        }
        render();
    });

    document.getElementById("clear-btn").addEventListener("click", () => {
        if (sim.kind === "meta") {
            sim.macro.fill(0);
            sim.macroGen = 0;
            sim.microTick = 0;
            latchMetaHardware();
        } else {
            sim.cells.fill(0);
            sim.age.fill(0);
            sim.gen = sim.kind === "1d" ? 1 : 0;
            sim.liveCount = 0;
            sim.births = 0;
            sim.deaths = 0;
        }
        render();
    });

    const elSpeed = document.getElementById("speed-slider");
    elSpeed.addEventListener("input", () => {
        fps = Number(elSpeed.value);
        document.getElementById("speed-val").textContent = String(fps);
    });

    document.getElementById("palette-btn").addEventListener("click", () => {
        fluxPalette = !fluxPalette;
        render();
    });

    document.getElementById("zoom-out-btn").addEventListener("click", () => {
        zoomAt(viewW * 0.5, viewH * 0.5, 0.72);
        render();
    });
    document.getElementById("zoom-in-btn").addEventListener("click", () => {
        zoomAt(viewW * 0.5, viewH * 0.5, 1.42);
        render();
    });
    document.getElementById("zoom-fit-btn").addEventListener("click", () => {
        fitCamera(1);
        render();
    });
    elInspectBtn.addEventListener("click", () => {
        // Find first alive metacell and zoom straight into its B3/S23 internals
        let targetX = 5, targetY = 4;
        for (let my = 0; my < sim.MH; my++) {
            let found = false;
            for (let mx = 0; mx < sim.MW; mx++) {
                if (sim.macro[my * sim.MW + mx] === 1) {
                    targetX = mx;
                    targetY = my;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        zoomToMetacell(targetX, targetY, 6.8);
        render();
    });

    document.querySelectorAll(".tool-btn").forEach((b) => {
        b.addEventListener("click", () => setTool(b.dataset.tool));
    });

    document.getElementById("stamp-sel").addEventListener("change", (e) => {
        stampName = e.target.value;
        setTool("stamp");
    });

    document.getElementById("rot-btn").addEventListener("click", () => {
        stampRot = (stampRot + 1) & 3;
        render();
    });

    document.getElementById("scale-macro-btn").addEventListener("click", () => {
        editMetaScale = "macro";
        document.getElementById("scale-macro-btn").classList.add("active");
        document.getElementById("scale-micro-btn").classList.remove("active");
    });
    document.getElementById("scale-micro-btn").addEventListener("click", () => {
        editMetaScale = "micro";
        document.getElementById("scale-micro-btn").classList.add("active");
        document.getElementById("scale-macro-btn").classList.remove("active");
    });

    document.getElementById("apply-rule-btn").addEventListener("click", () => {
        if (parseRuleString(elRuleInput.value)) {
            syncCustomControls();
        }
    });
    elRuleInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && parseRuleString(elRuleInput.value)) {
            syncCustomControls();
        }
    });

    elStates.addEventListener("change", () => {
        sim.states = Number(elStates.value);
        if (sim.kind === "brain" || sim.kind === "wire") sim.kind = "2d";
        syncCustomControls();
    });
    elNbr.addEventListener("change", () => {
        sim.nbr = elNbr.value;
        if (sim.kind === "brain" || sim.kind === "wire") sim.kind = "2d";
        syncCustomControls();
    });
    elWrap.addEventListener("change", () => {
        sim.wrap = elWrap.value === "wrap";
        syncCustomControls();
    });

    elW1DNum.addEventListener("input", () => {
        const v = Math.max(0, Math.min(255, Number(elW1DNum.value) || 0));
        sim.rule1d = v;
        renderW1DTable();
        updateRuleEquation();
    });
    document.getElementById("w1d-rand-btn").addEventListener("click", () => {
        sim.rule1d = Math.floor(Math.random() * 256);
        elW1DNum.value = String(sim.rule1d);
        renderW1DTable();
        updateRuleEquation();
    });

    document.getElementById("save-rule-btn").addEventListener("click", () => {
        const rawName = document.getElementById("save-name").value.trim();
        const defName = sim.kind === "1d"
            ? `Custom Rule ${sim.rule1d}`
            : sim.kind === "meta"
            ? `Meta ${formatBSString()}`
            : `Custom ${formatBSString()}`;
        const label = rawName || defName;
        const id = "custom-" + Date.now();
        customPresets[id] = {
            kind: sim.kind === "1d" ? "1d" : sim.kind === "meta" ? "meta" : "2d",
            name: label,
            B: [...sim.B],
            S: [...sim.S],
            states: sim.states,
            nbr: sim.nbr,
            wrap: sim.wrap,
            rule1d: sim.rule1d,
            seeds: sim.kind === "1d"
                ? [["w1d-single", "Impulse Seed"], ["w1d-rand", "Random Initial Row"]]
                : sim.kind === "meta"
                ? [["meta-glider", "Macro Glider"], ["meta-soup", "Macro Soup"]]
                : [["gosper-and-eaters", "Gosper Gun Seed"], ["rpent-classic", "R-Pentomino"], ["soup-25", "Random Soup (25%)"]],
        };
        saveCustomRules();
        refreshSavedPresetsDropdown();
        activePresetId = id;
        elPreset.value = id;
        elDelBtn.hidden = false;
        document.getElementById("save-name").value = "";
    });

    elDelBtn.addEventListener("click", () => {
        if (!customPresets[activePresetId]) return;
        delete customPresets[activePresetId];
        saveCustomRules();
        selectPreset("life");
    });

    window.addEventListener("keydown", (e) => {
        if (e.target.closest && e.target.closest("input, select, textarea")) return;
        if (e.code === "Space") {
            e.preventDefault();
            elPlay.click();
        } else if (e.key === "." || e.key === "s" || e.key === "S") {
            stepSim();
            render();
        } else if (e.key === "r" || e.key === "R") {
            stampRot = (stampRot + 1) & 3;
            render();
        } else if (e.key === "h" || e.key === "H") {
            setTimeout(() => {
                fitCamera(1);
                render();
            }, 30);
        }
    });

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        viewW = window.innerWidth;
        viewH = window.innerHeight;
        canvas.width = Math.round(viewW * DPR);
        canvas.height = Math.round(viewH * DPR);
        canvas.style.width = viewW + "px";
        canvas.style.height = viewH + "px";
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        fitCamera(1);
        render();
    }

    /* ===================== LOOP & BOOT ===================== */
    let lastTickTime = performance.now();
    function frame(now) {
        if (running) {
            const interval = 1000 / Math.max(1, fps);
            if (now - lastTickTime >= interval) {
                const steps = Math.min(4, Math.floor((now - lastTickTime) / interval));
                lastTickTime += steps * interval;
                for (let k = 0; k < steps; k++) stepSim();
                render();
            }
        }
        requestAnimationFrame(frame);
    }

    initBSToggles();
    refreshSavedPresetsDropdown();
    window.addEventListener("resize", resize);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * DPR);
    canvas.height = Math.round(viewH * DPR);
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    selectPreset(activePresetId);
    render();
    requestAnimationFrame(frame);
})();
