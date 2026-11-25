// Shared behaviour for the simulation pages:
//   ?embed        -> hide every panel (used for the live previews on the home page)
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

    function init() {
        forwardKeys();
        if (embedded) return;

        const panels = [...document.querySelectorAll(SELECTOR)];
        panels.forEach(makePanel);

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
