(function () {
    const $ = (s, r = document) => r.querySelector(s);
    const esc = (s) =>
        String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

    /* ---------- header ---------- */

    $("#today").textContent = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    /* ---------- simulation plates ---------- */

    const ALL = [];
    let fig = 0;
    const letters = "ABCDEFGH";

    $("#sim-body").innerHTML = BRANCHES.map((b, bi) => {
        const plates = b.sims
            .map((s) => {
                s.fig = ++fig;
                ALL.push(s);
                const n = String(s.fig).padStart(2, "0");
                const style =
                    `--span:${s.span};--ar:${s.ar};--dy:${s.dy || 0}px` + (s.start ? `;--start:${s.start}` : "");
                return `
          <a class="plate" href="#/${s.slug}" data-slug="${s.slug}" data-hot style="${style}">
            <div class="mat">
              <div class="frame">
                <img src="assets/posters/${s.slug}.jpg" alt="" />
                <span class="tag">Fig. ${n}</span>
                <span class="state"><span class="idle">Hover to run</span><span class="run">Live</span></span>
              </div>
            </div>
            <div class="cap">
              <h4>${esc(s.title)}</h4>
              <code class="eq">${esc(s.eq)}</code>
              <p>${esc(s.note)}</p>
            </div>
          </a>`;
            })
            .join("");
        return `
      <div class="branch">
        <div class="branch-head">
          <span class="b-no">${letters[bi]}</span>
          <h3>${esc(b.name)}</h3>
          <span class="b-count">${b.sims.length} figs</span>
        </div>
        <div class="plates">${plates}</div>
      </div>`;
    }).join("");

    /* ---------- live previews ---------- */

    const canHover = matchMedia("(hover: hover)").matches;
    let livePlate = null;
    let liveTimer = 0;

    function fit(frame, iframe) {
        const s = Math.max(frame.clientWidth / 1280, frame.clientHeight / 800);
        iframe.style.transform = `scale(${s})`;
        iframe.style.left = (frame.clientWidth - 1280 * s) / 2 + "px";
        iframe.style.top = (frame.clientHeight - 800 * s) / 2 + "px";
    }

    function stopLive() {
        clearTimeout(liveTimer);
        if (!livePlate) return;
        livePlate.classList.remove("live");
        livePlate.querySelector("iframe")?.remove();
        livePlate = null;
    }

    function startLive(plate) {
        if (livePlate === plate) return;
        stopLive();
        livePlate = plate;
        const frame = $(".frame", plate);
        const iframe = document.createElement("iframe");
        iframe.title = "";
        iframe.tabIndex = -1;
        iframe.setAttribute("aria-hidden", "true");
        iframe.src = `pages/${plate.dataset.slug}.html?embed`;
        fit(frame, iframe);
        iframe.addEventListener("load", () => {
            iframe.classList.add("on");
            plate.classList.add("live");
        });
        frame.append(iframe);
    }

    document.querySelectorAll(".plate").forEach((plate) => {
        const arm = () => {
            clearTimeout(liveTimer);
            liveTimer = setTimeout(() => startLive(plate), canHover ? 120 : 0);
        };
        if (canHover) plate.addEventListener("pointerenter", arm);
        plate.addEventListener("focus", arm);
        plate.addEventListener("pointerleave", stopLive);
        plate.addEventListener("blur", stopLive);
        plate.addEventListener("click", (e) => {
            // the viewer grows out of the spot you clicked
            const v = $("#viewer");
            v.style.setProperty("--ox", (e.clientX || innerWidth / 2) + "px");
            v.style.setProperty("--oy", (e.clientY || innerHeight / 2) + "px");
        });
    });

    window.addEventListener("resize", () => {
        if (!livePlate) return;
        const iframe = $("iframe", livePlate);
        if (iframe) fit($(".frame", livePlate), iframe);
    });

    /* ---------- viewer ---------- */

    const viewer = $("#viewer");
    const vframe = $("#v-frame");
    let current = -1;
    let closeTimer = 0;

    function show(i) {
        const s = ALL[(i + ALL.length) % ALL.length];
        current = ALL.indexOf(s);
        $("#v-fig").textContent = "Fig. " + String(s.fig).padStart(2, "0");
        $("#v-title").textContent = s.title;
        $("#v-eq").textContent = s.eq;
        $("#v-open").href = `pages/${s.slug}.html`;
        document.title = s.title + " — Pruthviraj Sadhankar";
        vframe.src = `pages/${s.slug}.html`;
    }

    function openViewer(slug) {
        const i = ALL.findIndex((s) => s.slug === slug);
        if (i < 0) return;
        stopLive();
        clearTimeout(closeTimer);
        if (current !== i || !viewer.classList.contains("open")) show(i);
        document.body.classList.add("locked");
        viewer.setAttribute("aria-hidden", "false");
        viewer.classList.add("open");
        setTimeout(() => vframe.focus(), 400);
    }

    function closeViewer() {
        if (!viewer.classList.contains("open")) return;
        viewer.classList.remove("open");
        viewer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("locked");
        document.title = "Pruthviraj Sadhankar";
        closeTimer = setTimeout(() => {
            vframe.src = "about:blank";
            current = -1;
        }, 700);
    }

    function route() {
        const m = location.hash.match(/^#\/([\w-]+)/);
        if (m) openViewer(m[1]);
        else closeViewer();
    }

    function go(step) {
        const s = ALL[(current + step + ALL.length) % ALL.length];
        location.replace("#/" + s.slug);
    }

    $("#v-close").addEventListener("click", () => {
        // swap the route in place so Back never leaves the site
        history.replaceState(null, "", location.pathname + "#sims");
        route();
    });
    $("#v-prev").addEventListener("click", () => go(-1));
    $("#v-next").addEventListener("click", () => go(1));

    function key(k) {
        if (!viewer.classList.contains("open")) return;
        if (k === "Escape") $("#v-close").click();
        if (k === "ArrowLeft") go(-1);
        if (k === "ArrowRight") go(1);
    }

    document.addEventListener("keydown", (e) => key(e.key));
    window.addEventListener("message", (e) => {
        if (e.data && e.data.type === "sim-key") key(e.data.key);
    });
    window.addEventListener("hashchange", route);

    /* ---------- software ledger ---------- */

    const ledger = $("#ledger");
    ledger.innerHTML = SOFTWARE.map(
        (p) => `
      <a class="row" href="${esc(p.url)}" target="_blank" rel="noopener" data-tags="${p.tags.join(" ")}">
        <h4>${esc(p.name)}${p.live ? '<span class="badge">LIVE</span>' : ""}</h4>
        <span class="txt">${esc(p.text)}</span>
        <span class="stack">${esc(p.stack)}</span>
        <span class="go">↗</span>
      </a>`
    ).join("");

    const filters = $("#filters");
    filters.innerHTML = FILTERS.map(
        ([id, label], i) => `<button type="button" data-f="${id}" aria-pressed="${i === 0}">${label}</button>`
    ).join("");

    filters.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        filters.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        const f = b.dataset.f;
        ledger.querySelectorAll(".row").forEach((r) => {
            r.hidden = f !== "all" && !r.dataset.tags.split(" ").includes(f);
        });
    });

    /* ---------- record ---------- */

    const entries = (list) =>
        list
            .map(
                (e) => `
      <article class="entry">
        <div class="when">${esc(e.when)}</div>
        <div>
          <h4>${esc(e.role)}</h4>
          <p class="org">${esc(e.org)}</p>
          <ul>${e.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        </div>
      </article>`
            )
            .join("");

    $("#experience").innerHTML = entries(RECORD);
    $("#education").innerHTML = entries(SCHOOLS);

    /* ---------- toolbox as sets ---------- */

    $("#sets").innerHTML = TOOLBOX.map(
        (t) => `
      <div class="set">
        <span class="lhs">${esc(t.name)}</span> = <span class="brace">{</span>
        ${t.items.map((i) => `<span class="item">${esc(i)}</span>`).join(", ")}
        <span class="brace">}</span>
        <span class="card">|${esc(t.name)}| = ${t.items.length}</span>
      </div>`
    ).join("");

    /* ---------- nav highlight ---------- */

    const links = [...document.querySelectorAll(".pad-nav a")];
    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id));
            });
        },
        { rootMargin: "-40% 0px -55% 0px" }
    );
    document.querySelectorAll(".sheet, .end").forEach((s) => io.observe(s));

    route();
})();
