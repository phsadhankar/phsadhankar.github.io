// Shared behaviour for the simulation pages:
//   ?embed        -> hide every panel and seed a demo state (used for the previews on the home page)
//   drag a panel  -> move it around
//   [-] button    -> fold a panel down to its title
//   H             -> hide / show all panels
//   Esc, arrows   -> forwarded to the viewer when the page is framed
(function () {
    const root = document.documentElement;
    const embedded = new URLSearchParams(location.search).has("embed");
    if (embedded) root.classList.add("embed");

    const SELECTOR = ".info, .controls, .stats, .stats-box, .coords, .ui-panel, .overlay";

    function forwardKeys() {
        if (window.parent === window) return;
        document.addEventListener("keydown", (e) => {
            if (["Escape", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                window.parent.postMessage({ type: "sim-key", key: e.key }, "*");
            }
        });
    }

    function makePanel(panel) {
        panel.classList.add("panel");

        const fold = document.createElement("button");
        fold.type = "button";
        fold.className = "panel-fold";
        fold.setAttribute("aria-label", "Fold panel");
        fold.textContent = "–";
        panel.prepend(fold);

        fold.addEventListener("click", () => {
            const folded = panel.classList.toggle("folded");
            fold.textContent = folded ? "+" : "–";
            fold.setAttribute("aria-label", folded ? "Unfold panel" : "Fold panel");
        });

        let drag = null;

        panel.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            if (e.target.closest("input, button, select, textarea, a, label")) return;

            // switch from right/bottom anchoring to plain left/top once
            const r = panel.getBoundingClientRect();
            panel.style.position = "fixed";
            panel.style.left = r.left + "px";
            panel.style.top = r.top + "px";
            panel.style.right = "auto";
            panel.style.bottom = "auto";

            drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
            panel.setPointerCapture(e.pointerId);
            panel.classList.add("dragging");
        });

        panel.addEventListener("pointermove", (e) => {
            if (!drag) return;
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;
            panel.style.left = Math.min(Math.max(0, e.clientX - drag.dx), Math.max(0, maxX)) + "px";
            panel.style.top = Math.min(Math.max(0, e.clientY - drag.dy), Math.max(0, maxY)) + "px";
        });

        const stop = () => {
            drag = null;
            panel.classList.remove("dragging");
        };
        panel.addEventListener("pointerup", stop);
        panel.addEventListener("pointercancel", stop);
    }

    // Some simulations start empty. When they're shown as a preview, give them
    // something to look at.
    function seedDemo() {
        const page = location.pathname.split("/").pop();
        const click = (sel) => document.querySelector(sel)?.click();

        // a ghost hand that keeps stirring the canvas
        const ghost = (canvas, speed) => {
            const fire = (type, x, y) =>
                canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
            let t = 0;
            fire("mousedown", innerWidth / 2, innerHeight / 2);
            setInterval(() => {
                t += speed;
                fire(
                    "mousemove",
                    innerWidth * (0.5 + 0.28 * Math.sin(t * 1.3) * Math.cos(t * 0.4)),
                    innerHeight * (0.5 + 0.3 * Math.sin(t * 0.9 + 1))
                );
            }, 16);
        };

        const seeds = {
            "turbulence.html": () => click("#random"),
            "complex-flow.html": () => {
                const sel = document.querySelector("#flowType");
                if (sel) {
                    sel.value = "cylinder";
                    sel.dispatchEvent(new Event("change"));
                }
            },
            "conformal.html": () => {
                const sel = document.querySelector("#mapping-type");
                if (sel) {
                    sel.value = "square";
                    sel.dispatchEvent(new Event("change"));
                }
            },
            "pde-solver.html": () => {
                const sel = document.querySelector("#pde-type");
                if (sel) {
                    sel.value = "wave";
                    sel.dispatchEvent(new Event("change"));
                }
                const c = document.querySelector("canvas");
                for (const [fx, fy] of [[0.38, 0.42], [0.62, 0.56]]) {
                    c.dispatchEvent(new MouseEvent("mousedown", { clientX: innerWidth * fx, clientY: innerHeight * fy, bubbles: true }));
                    c.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                }
            },
            "inscribed-square.html": () => {
                click("#exampleBtn");
                setTimeout(() => click("#findBtn"), 250);
            },
            "navier-stokes.html": () => {
                const slider = document.querySelector("#vorticity");
                slider.value = slider.max;
                slider.dispatchEvent(new Event("input"));
                const c = document.querySelector("canvas");
                if (typeof velocityStep === "function" && typeof densityStep === "function") {
                    c.dispatchEvent(new MouseEvent("mousedown", { clientX: innerWidth * 0.35, clientY: innerHeight * 0.5, bubbles: true }));
                    for (let k = 1; k <= 24; k++) {
                        const t = k * 0.14;
                        c.dispatchEvent(new MouseEvent("mousemove", {
                            clientX: innerWidth * (0.5 + 0.28 * Math.sin(t * 1.3) * Math.cos(t * 0.4)),
                            clientY: innerHeight * (0.5 + 0.3 * Math.sin(t * 0.9 + 1)),
                            bubbles: true
                        }));
                        addForces();
                        velocityStep(u, v, u_prev, v_prev, viscosity, 0.1);
                        densityStep(dens, dens_prev, u, v, 0, 0.1);
                        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { u_prev[i][j] = v_prev[i][j] = dens_prev[i][j] = 0; }
                    }
                    c.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                }
                ghost(c, 0.14);
            },
            // let the attractor run ahead so the butterfly is already drawn
            "lorenz.html": () => {
                click("#add-particle");
                click("#add-particle");
                particles.forEach((p) => {
                    for (let i = 0; i < 2600; i++) p.update(0.008);
                });
            },
        };

        requestAnimationFrame(() => seeds[page]?.());
    }

    function init() {
        forwardKeys();
        if (embedded) {
            seedDemo();
            return;
        }

        document.querySelectorAll(SELECTOR).forEach(makePanel);

        document.addEventListener("keydown", (e) => {
            if (e.target.closest && e.target.closest("input, select, textarea")) return;
            if (e.key === "h" || e.key === "H") root.classList.toggle("panels-hidden");
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
