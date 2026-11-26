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

    const navLinks = [...document.querySelectorAll(".pad-nav a")];
    const setNav = (activeHref) => {
        navLinks.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === activeHref));
    };

    /* ---------- flatten all simulations across research disciplines ---------- */

    const ALL = [];
    let fig = 0;
    const letters = "ABCDEFGH";

    DISCIPLINES.forEach((d) => {
        d.totalSims = 0;
        d.branches.forEach((b) => {
            b.sims.forEach((s) => {
                s.fig = ++fig;
                s.section = d.id;
                d.totalSims++;
                ALL.push(s);
            });
        });
    });

    /* ---------- build 4-pole singularity atlas ---------- */

    const atlasGrid = $("#atlas-grid");
    if (atlasGrid) {
        atlasGrid.innerHTML = DISCIPLINES.map(
            (d) => `
      <a class="basin" href="#${d.id}" data-discipline="${d.id}" data-hot>
        <span class="basin-meta"><span class="sym">${esc(d.roman)} · ${esc(d.sym)}</span><span>${String(d.totalSims).padStart(2, "0")} labs</span></span>
        <h3>${esc(d.name)}</h3>
        <p>${esc(d.tagline)}</p>
        <span class="basin-go">Enter sheet →</span>
      </a>`
        ).join("");
    }

    /* ---------- live plate previews ---------- */

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

    function wirePlates(root) {
        root.querySelectorAll(".plate").forEach((plate) => {
            const arm = () => {
                clearTimeout(liveTimer);
                liveTimer = setTimeout(() => startLive(plate), canHover ? 120 : 0);
            };
            if (canHover) plate.addEventListener("pointerenter", arm);
            plate.addEventListener("focus", arm);
            plate.addEventListener("pointerleave", stopLive);
            plate.addEventListener("blur", stopLive);
            plate.addEventListener("click", (e) => {
                const v = $("#viewer");
                v.style.setProperty("--ox", (e.clientX || innerWidth / 2) + "px");
                v.style.setProperty("--oy", (e.clientY || innerHeight / 2) + "px");
            });
        });
    }

    window.addEventListener("resize", () => {
        if (!livePlate) return;
        const iframe = $("iframe", livePlate);
        if (iframe) fit($(".frame", livePlate), iframe);
    });

    /* ---------- render separated software archive vs research discipline sheets ---------- */

    let activeSheetId = "";

    function renderCrumbs(activeId) {
        $("#crumb-tabs").innerHTML = DISCIPLINES.map(
            (d) => `<a href="#${d.id}" class="${d.id === activeId ? "on" : ""}">${esc(d.roman)} · ${esc(d.name)}</a>`
        ).join("");
    }

    function renderSoftware() {
        if (activeSheetId === "software" && document.body.dataset.view === "software") return;
        stopLive();
        activeSheetId = "software";
        document.body.dataset.view = "software";
        setNav("#software");

        $("#sheet-name").textContent = "Software";
        $("#soft-rail").innerHTML = `
          <span class="sec-no">Code</span>
          <h2>Software</h2>
          <p>Engineering repositories, satellite flight code, ML pipelines, and standalone software projects.</p>
          <div class="filters" id="sub-filters" role="group" aria-label="Filter"></div>
          <p class="more"><a href="https://github.com/phsadhankar?tab=repositories" target="_blank" rel="noopener">All on GitHub ↗</a></p>
        `;
        $("#soft-body").innerHTML = `<div class="ledger" id="sub-ledger"></div>`;
        const ledger = $("#sub-ledger");
        ledger.innerHTML = SOFTWARE.map(
            (p) => `
          <a class="row" href="${esc(p.url)}" target="_blank" rel="noopener" data-tags="${p.tags.join(" ")}">
            <h4>${esc(p.name)}${p.live ? '<span class="badge">LIVE</span>' : ""}</h4>
            <span class="txt">${esc(p.text)}</span>
            <span class="stack">${esc(p.stack)}</span>
            <span class="go">↗</span>
          </a>`
        ).join("");

        const filters = $("#sub-filters");
        filters.innerHTML = FILTERS.map(
            ([fid, label], i) => `<button type="button" data-f="${fid}" aria-pressed="${i === 0}">${label}</button>`
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

        document.title = "Software — Pruthviraj Sadhankar";
        window.scrollTo({ top: 0, behavior: "instant" });
    }

    function renderDiscipline(id) {
        if (activeSheetId === id && document.body.dataset.view === "discipline") return;
        stopLive();
        activeSheetId = id;
        document.body.dataset.view = "discipline";
        setNav("");
        renderCrumbs(id);

        const d = DISCIPLINES.find((x) => x.id === id);
        if (!d) return;

        $("#sheet-name").textContent = `${d.roman} ${d.name}`;
        $("#sub-rail").innerHTML = `
          <span class="sec-no">§ ${esc(d.roman)}</span>
          <h2>${esc(d.name)}</h2>
          <p>${esc(d.desc)}</p>
          <code class="eq">${esc(d.eq)}</code>
          <p class="how">Hover any plate to run a live preview. Click to open full screen where panels fold or hide with <kbd>H</kbd>.</p>
        `;

        const branchesHtml = d.branches
            .map((b, bi) => {
                const plates = b.sims
                    .map((s) => {
                        const n = String(s.fig).padStart(2, "0");
                        const style =
                            `--span:${s.span};--ar:${s.ar};--dy:${s.dy || 0}px` +
                            (s.start ? `;--start:${s.start}` : "");
                        return `
                  <a class="plate" href="#/${s.slug}" data-slug="${s.slug}" style="${style}">
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
            })
            .join("");

        const relatedSoft = SOFTWARE.filter((p) => p.tags.some((t) => d.softTags.includes(t)));
        const softHtml = relatedSoft.length
            ? `
          <div class="sub-software">
            <div class="branch-head">
              <span class="b-no">+</span>
              <h3>Related code &amp; repositories</h3>
              <span class="b-count">${relatedSoft.length} ${relatedSoft.length === 1 ? "repo" : "repos"}</span>
            </div>
            <div class="ledger">
              ${relatedSoft
                  .map(
                      (p) => `
                <a class="row" href="${esc(p.url)}" target="_blank" rel="noopener">
                  <h4>${esc(p.name)}${p.live ? '<span class="badge">LIVE</span>' : ""}</h4>
                  <span class="txt">${esc(p.text)}</span>
                  <span class="stack">${esc(p.stack)}</span>
                  <span class="go">↗</span>
                </a>`
                  )
                  .join("")}
            </div>
          </div>`
            : "";

        const subBody = $("#sub-body");
        subBody.innerHTML = branchesHtml + softHtml;
        wirePlates(subBody);
        document.title = `${d.name} — Pruthviraj Sadhankar`;
        window.scrollTo({ top: 0, behavior: "instant" });
    }

    function showHome(scrollTarget) {
        stopLive();
        activeSheetId = "";
        document.body.dataset.view = "home";
        $("#sheet-name").textContent = "Index";
        document.title = "Pruthviraj Sadhankar";
        if (scrollTarget === "top") {
            setNav("#atlas");
            window.scrollTo({ top: 0, behavior: "instant" });
        } else if (scrollTarget) {
            setNav("#" + scrollTarget);
            const el = document.getElementById(scrollTarget);
            if (el) el.scrollIntoView({ behavior: "smooth" });
        } else {
            setNav("#atlas");
        }
    }

    /* ---------- viewer ---------- */

    const viewer = $("#viewer");
    const vframe = $("#v-frame");
    let current = -1;
    let closeTimer = 0;

    function showSim(i) {
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
        const sec = ALL[i].section;
        if (document.body.dataset.view !== "discipline" && sec) {
            renderDiscipline(sec);
        }
        stopLive();
        clearTimeout(closeTimer);
        if (current !== i || !viewer.classList.contains("open")) showSim(i);
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
        closeTimer = setTimeout(() => {
            vframe.src = "about:blank";
            current = -1;
        }, 700);
    }

    function route() {
        const h = location.hash;
        const simMatch = h.match(/^#\/([\w-]+)/);
        if (simMatch) {
            openViewer(simMatch[1]);
            return;
        }
        closeViewer();

        const secId = h.replace(/^#/, "");
        if (secId === "software") {
            renderSoftware();
            return;
        }
        if (DISCIPLINES.some((d) => d.id === secId)) {
            renderDiscipline(secId);
            return;
        }
        showHome(["atlas", "record", "contact", "top"].includes(secId) ? secId : "");
    }

    function go(step) {
        const s = ALL[(current + step + ALL.length) % ALL.length];
        location.replace("#/" + s.slug);
    }

    $("#v-close").addEventListener("click", () => {
        const sec = ALL[current]?.section || activeSheetId || "atlas";
        history.replaceState(null, "", location.pathname + "#" + sec);
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

    /* ---------- record + toolbox on index sheet ---------- */

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

    $("#sets").innerHTML = TOOLBOX.map(
        (t) => `
      <div class="set">
        <span class="lhs">${esc(t.name)}</span> = <span class="brace">{</span>
        ${t.items.map((i) => `<span class="item">${esc(i)}</span>`).join(", ")}
        <span class="brace">}</span>
        <span class="card">|${esc(t.name)}| = ${t.items.length}</span>
      </div>`
    ).join("");

    /* ---------- home nav highlight ---------- */

    const io = new IntersectionObserver(
        (entries) => {
            if (document.body.dataset.view !== "home") return;
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                setNav("#" + en.target.id);
            });
        },
        { rootMargin: "-40% 0px -55% 0px" }
    );
    document.querySelectorAll(".home-only, .end").forEach((s) => io.observe(s));

    route();
})();
