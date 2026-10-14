// -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
// deslop webui logic. the sidebar tab is a compact dashboard with a
// start/resume button; the actual reviewing happens in the deslop_review
// modal, which simulates the CLI's interactive mode one marker at a time.
// opening a marker hands over to the coder module's editor modal (the
// coderPanel store) and re-opens the review banner once the editor closes,
// just like returning from $EDITOR does in the terminal.
(function () {
    const API = "/api/ext/deslop";
    const PANEL_SEL = "[data-deslop='panel']";
    const RV_SEL = "[data-deslop-rv]";
    const POLL_MS = 90000;

    let lastState = null;
    let editorWatch = null;

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    // sweep target: deslop never inherits the sandbox selected in the coder
    // sidebar. the panel picks its own sandbox + folder (folders only) from
    // two dropdowns. targetSandbox "" = the server-side default scan_path.
    let sandboxes = [];
    let dirsCache = {};     // sandbox -> { dirs, truncated }
    let targetSandbox = "";
    let targetDir = "";     // "" = whole sandbox
    let userPicked = false; // once the user picks, state stops steering

    function targetPath() {
        if (!targetSandbox) return "";
        return targetDir ? targetSandbox + "/" + targetDir : targetSandbox;
    }

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    async function fetchJSON(url, opts) {
        try {
            const res = await fetch(url, opts);
            const json = await res.json();
            if (!json || !json.success) {
                return { error: (json && json.data) || "request failed" };
            }
            return json.data;
        } catch (err) {
            return { error: String(err) };
        }
    }

    // -- sidebar dashboard ---------------------------------------------------

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    // rollup rows live in ONE grid per section (.deslop-rollup): the label
    // column sizes to the widest label in that section, so bars all start at
    // the same x with no dead space after short names (the old fixed 55%
    // name column left a big gap next to labels like "2026-10").
    function rollup(title, pairs) {
        if (!pairs || !pairs.length) return "";
        const top = pairs[0][1] || 1;
        let html =
            '<div class="deslop-group">' +
            '<div class="deslop-sec">' + esc(title) + "</div>" +
            '<div class="deslop-rollup">';
        for (const pair of pairs.slice(0, 6)) {
            const pct = Math.max(4, Math.round((100 * pair[1]) / top));
            html +=
                '<span class="deslop-name" title="' + esc(pair[0]) + ": " + pair[1] + '">' + esc(pair[0]) + "</span>" +
                '<span class="deslop-track"><span class="deslop-fill" style="width:' + pct + '%"></span></span>' +
                '<span class="deslop-count">' + pair[1] + "</span>";
        }
        html += "</div></div>";
        return html;
    }

    // months read best oldest->newest (the CLI's chrono section), so unlike
    // the other rollups we keep calendar order: cap to the latest 12 and
    // scale the bars to the biggest month shown, not the first one.
    function rollupMonths(pairs) {
        if (!pairs || !pairs.length) return "";
        const shown = pairs.slice(-12);
        let top = 1;
        for (const pair of shown) top = Math.max(top, pair[1]);
        let html =
            '<div class="deslop-group">' +
            '<div class="deslop-sec">by month</div>' +
            '<div class="deslop-rollup">';
        for (const pair of shown) {
            const pct = Math.max(4, Math.round((100 * pair[1]) / top));
            html +=
                '<span class="deslop-name" title="' + esc(pair[0]) + ": " + pair[1] + '">' + esc(pair[0]) + "</span>" +
                '<span class="deslop-track"><span class="deslop-fill months" style="width:' + pct + '%"></span></span>' +
                '<span class="deslop-count">' + pair[1] + "</span>";
        }
        html += "</div></div>";
        return html;
    }

    function buildPanel(st) {
        if (!st) return '<div class="deslop-loading">sweeping for slop...</div>';
        if (st.error) return '<div class="deslop-error">' + esc(st.error) + "</div>";

        const rootLabel = st.root_sandbox
            ? st.root_sandbox + (st.root_rel ? "/" + st.root_rel : "")
            : st.root.split("/").filter(Boolean).pop() || st.root;

        let html =
            '<div class="deslop-head">' +
            '<span class="deslop-root" title="' + esc(st.root) + '">' + esc(rootLabel) + "</span>" +
            '<button type="button" class="deslop-refresh" data-deslop-refresh title="force a fresh sweep">&#8635;</button>' +
            "</div>" +
            '<div class="deslop-chips">' +
            '<span class="deslop-chip slop">' + st.slop + " slop</span>" +
            '<span class="deslop-chip reviewed">' + st.reviewed + " reviewed</span>" +
            (st.malformed ? '<span class="deslop-chip malformed">' + st.malformed + " broken</span>" : "") +
            "</div>";

        if (st.slop === 0 && st.malformed === 0) {
            html += '<div class="deslop-clean">✨ clean! nothing left to review</div>';
        } else {
            html +=
                '<button type="button" class="deslop-start" data-deslop-start>' +
                (st.session_active ? "▶ resume review" : "▶ start review (" + (st.slop + st.malformed) + " markers)") +
                "</button>";
        }

        html += rollup("by model", st.by_model);
        html += rollupMonths(st.by_month);
        html += rollup("worst dirs", st.by_dir);
        return html;
    }

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    // -- target pickers ---------------------------------------------------------
    // the dropdown chrome is built once per panel element and survives
    // dashboard repaints (polling would otherwise wipe a half-open dropdown).

    function ensureChrome(el) {
        if (el.querySelector(".deslop-target")) return;
        el.innerHTML =
            '<div class="deslop-target">' +
            '<select class="deslop-select" data-deslop-sandbox title="coder sandbox to sweep"></select>' +
            '<select class="deslop-select" data-deslop-dir title="folder inside the sandbox"></select>' +
            "</div>" +
            '<div class="deslop-body"></div>';
        paintTarget();
    }

    function paintTarget() {
        document.querySelectorAll(PANEL_SEL).forEach((el) => {
            if (!el.querySelector(".deslop-target")) { ensureChrome(el); return; }
            const sb = el.querySelector("[data-deslop-sandbox]");
            const dir = el.querySelector("[data-deslop-dir]");

            let html = '<option value="">default scan path</option>';
            for (const name of sandboxes) {
                html += '<option value="' + esc(name) + '">' + esc(name) + "</option>";
            }
            sb.innerHTML = html;
            sb.value = targetSandbox;

            const cached = dirsCache[targetSandbox];
            let dhtml = '<option value="">whole sandbox</option>';
            if (cached) {
                for (const d of cached.dirs) {
                    dhtml += '<option value="' + esc(d.path) + '">' + "· ".repeat(Math.max(0, d.depth - 1)) + esc(d.name) + "</option>";
                }
                if (cached.truncated) dhtml += '<option disabled>(folder list capped)</option>';
            }
            dir.innerHTML = dhtml;
            dir.value = targetDir;
            dir.disabled = !targetSandbox;
        });
    }

    async function loadDirs(sandbox) {
        if (!sandbox || dirsCache[sandbox]) return;
        const data = await fetchJSON(API + "/dirs?sandbox=" + encodeURIComponent(sandbox));
        if (data.error) { console.error("[deslop] dirs:", data.error); return; }
        dirsCache[sandbox] = { dirs: data.dirs || [], truncated: !!data.truncated };
    }

    function renderPanel(st) {
        lastState = st;
        // before any explicit pick, mirror whatever the server actually swept
        if (st && !userPicked && st.root_sandbox && st.root_sandbox !== targetSandbox) {
            targetSandbox = st.root_sandbox;
            targetDir = st.root_rel || "";
            loadDirs(targetSandbox).then(paintTarget);
        }
        document.querySelectorAll(PANEL_SEL).forEach((el) => {
            ensureChrome(el);
            el.querySelector(".deslop-body").innerHTML = buildPanel(st);
        });
        paintTarget();
    }

    async function refreshPanel(force) {
        const path = targetPath();
        let st;
        if (force) {
            st = await fetchJSON(API + "/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: path }),
            });
        } else {
            st = await fetchJSON(API + "/state" + (path ? "?path=" + encodeURIComponent(path) : ""));
        }
        renderPanel(st);
    }

    // -- review modal ----------------------------------------------------------

    function reviewHTML(p) {
        if (p.error) return '<div class="deslop-error">' + esc(p.error) + "</div>";
        if (!p.active) return '<div class="deslop-clean">no active review session. start one from the sidebar tab.</div>';

        if (p.done) {
            return (
                '<pre class="deslop-summary' + (p.interrupted ? " interrupted" : "") + '">' + esc(p.summary) + "</pre>" +
                '<div class="deslop-actions"><button type="button" class="deslop-btn-big" data-deslop-rv="close">close</button></div>'
            );
        }

        const status =
            "file " + p.file_index + "/" + p.file_total +
            " · cleaned " + p.cleaned +
            " · removed " + p.removed +
            " · stamped " + p.stamped +
            (p.skipped ? " · skipped " + p.skipped : "");

        let ctx = "";
        for (const line of p.context) {
            ctx +=
                '<div class="deslop-cl' + (line.current ? " current" : "") + '">' +
                '<span class="deslop-ln">' + line.n + "</span>" +
                "<span>" + esc(line.text) + "</span></div>";
        }

        const meta = p.malformed
            ? "malformed marker - fix it in the editor"
            : [p.marker_model, p.marker_date].filter(Boolean).join(" · ");

        let html =
            '<div class="deslop-rv-status">' + esc(status) + "</div>" +
            '<div class="deslop-rv-file" title="' + esc(p.file) + '">' + esc(p.file_rel) +
            '<span class="deslop-badge">' + p.markers_left + " left</span></div>" +
            '<div class="deslop-code">' + ctx + "</div>" +
            (meta ? '<div class="deslop-rv-meta">' + esc(meta) + "</div>" : "") +
            (p.verdict ? '<div class="deslop-verdict">' + esc(p.verdict) + "</div>" : "") +
            (p.nag ? '<div class="deslop-nag">' + esc(p.nag) + "</div>" : "") +
            '<div class="deslop-actions">' +
            (p.sandbox
                ? '<button type="button" class="deslop-btn-big" data-deslop-rv="open" data-sandbox="' + esc(p.sandbox) +
                  '" data-rel="' + esc(p.rel) + '" data-line="' + p.line + '">✎ open in editor</button>'
                : '<span class="deslop-rv-meta" title="outside every coder sandbox - open it manually">outside sandboxes</span>') +
            (p.malformed
                ? ""
                : '<button type="button" class="deslop-btn-big ok" data-deslop-rv="stamp">✓ stamp reviewed</button>') +
            '<button type="button" class="deslop-btn-big" data-deslop-rv="continue">→ done editing</button>' +
            '<button type="button" class="deslop-btn-big" data-deslop-rv="skip">» skip file</button>' +
            '<button type="button" class="deslop-btn-big quit" data-deslop-rv="quit">✕ quit</button>' +
            "</div>";
        return html;
    }

    function renderReview(p) {
        const html = reviewHTML(p);
        document.querySelectorAll(RV_SEL).forEach((el) => { el.innerHTML = html; });
    }

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-14)
    function showRvError(msg) {
        console.error("[deslop]", msg);
        document.querySelectorAll(RV_SEL).forEach((el) => {
            let box = el.querySelector(".deslop-rv-err");
            if (!box) {
                box = document.createElement("div");
                box.className = "deslop-error deslop-rv-err";
                el.appendChild(box);
            }
            box.textContent = msg;
        });
    }

    // autoOpen: hand straight over to the coder editor at the marker line,
    // like the CLI's interactive mode dropping into $EDITOR. the reopen
    // after the editor closes must NOT auto-open (that would loop).
    function openReviewModal(p, autoOpen) {
        if (!window.Alpine) return;
        Alpine.store("ui").openModal("deslop_review");
        // the modal body lives inside an x-if template: it only exists once
        // Alpine has flushed. renderReview is idempotent, so a second tick
        // is harmless and covers slower mounts.
        renderReview(p);
        requestAnimationFrame(() => renderReview(p));
        setTimeout(() => renderReview(p), 80);
        if (autoOpen && p && p.active && !p.done && p.sandbox) {
            setTimeout(() => openInCoder(p.sandbox, p.rel, p.line), 150);
        }
    }

    async function reviewAction(action) {
        const p = await fetchJSON(API + "/review/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: action }),
        });
        renderReview(p);
        refreshPanel(false);
        // next marker: banner first, then straight into the editor for it
        if (p && p.active && !p.done && p.sandbox) {
            setTimeout(() => openInCoder(p.sandbox, p.rel, p.line), 150);
        }
    }

    // -- coder editor handoff -----------------------------------------------------

    async function openInCoder(sandbox, rel, line) {
        console.log("[deslop] open request:", sandbox, rel, "line", line);
        if (!sandbox || !rel) { showRvError("this file lives outside every coder sandbox - open it manually"); return; }
        if (!window.Alpine) { showRvError("alpine not loaded"); return; }
        const panel = Alpine.store("coderPanel");
        if (!panel) { showRvError("coder module store missing - is the coder module enabled?"); return; }

        try {
            // same handoff the git sidebar uses (git.js editFile): assign directly,
            // because switchSandbox() no-ops while the store's sandbox list is still
            // empty (it only loads when the coder tab mounts). the tree reload is
            // fire-and-forget: openFile doesn't need it.
            if (panel.sandbox !== sandbox) {
                panel.sandbox = sandbox;
                panel.onSandboxChange();
            }
            await panel.openFile({ path: rel }, line || 0);
            console.log("[deslop] openFile resolved, modal now:", Alpine.store("ui").currentModal);
        } catch (err) {
            console.error("[deslop] openFile threw:", err);
            showRvError("opening in the editor failed: " + (err && err.message ? err.message : err));
            return;
        }

        // the coder modal replaces the review modal (one modal at a time).
        // like returning from $EDITOR: re-open the banner once it closes.
        // note: closeModal() sets currentModal to null, NOT "" - check falsy.
        if (editorWatch) clearInterval(editorWatch);
        editorWatch = setInterval(async () => {
            const ui = Alpine.store("ui");
            if (!ui) { clearInterval(editorWatch); editorWatch = null; return; }
            if (ui.currentModal === "coder_file") return; // still editing
            clearInterval(editorWatch);
            editorWatch = null;
            if (ui.currentModal) return; // user went to some other modal
            const p = await fetchJSON(API + "/review/current");
            if (p && p.active) openReviewModal(p, false);
        }, 400);
    }

    // -- wiring ---------------------------------------------------------------------

    document.addEventListener("click", async (ev) => {
        const start = ev.target.closest("[data-deslop-start]");
        if (start) {
            ev.preventDefault();
            start.disabled = true;
            const p = await fetchJSON(API + "/review/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: targetPath() }) });
            start.disabled = false;
            if (!p.error) openReviewModal(p, true);
            return;
        }

        const rv = ev.target.closest("[data-deslop-rv]");
        if (rv && rv.getAttribute("data-deslop-rv")) {
            ev.preventDefault();
            const action = rv.getAttribute("data-deslop-rv");
            if (action === "open") {
                openInCoder(rv.getAttribute("data-sandbox"), rv.getAttribute("data-rel"), parseInt(rv.getAttribute("data-line"), 10));
            } else if (action === "close") {
                if (window.Alpine) Alpine.store("ui").closeModal();
                refreshPanel(false);
            } else {
                rv.disabled = true;
                await reviewAction(action);
            }
            return;
        }

        const rf = ev.target.closest("[data-deslop-refresh]");
        if (rf) {
            ev.preventDefault();
            rf.disabled = true;
            refreshPanel(true).finally(() => { rf.disabled = false; });
        }
    });

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    // dropdown picks: sandbox first, folder second. changing the sandbox
    // resets the folder pick and loads that sandbox's folder list; either
    // pick triggers a fresh sweep of the new target.
    document.addEventListener("change", async (ev) => {
        const sb = ev.target.closest("[data-deslop-sandbox]");
        if (sb) {
            userPicked = true;
            targetSandbox = sb.value;
            targetDir = "";
            paintTarget();
            if (targetSandbox) await loadDirs(targetSandbox);
            paintTarget();
            refreshPanel(true);
            return;
        }
        const dir = ev.target.closest("[data-deslop-dir]");
        if (dir) {
            userPicked = true;
            targetDir = dir.value;
            refreshPanel(true);
        }
    });

    // the sidebar tab may mount after our first fetch: repaint it when it shows up
    const observer = new MutationObserver(() => {
        document.querySelectorAll(PANEL_SEL).forEach((el) => {
            if (el.dataset.deslopDone !== "1") {
                el.dataset.deslopDone = "1";
                ensureChrome(el);
                el.querySelector(".deslop-body").innerHTML = buildPanel(lastState);
            }
        });
    });

    async function boot() {
        observer.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll(PANEL_SEL).forEach((el) => { el.dataset.deslopDone = "1"; });
        // sandbox list for the dropdowns (the dirs payload doubles as it when
        // no sandbox is given). failures are quiet: the dashboard still works.
        const data = await fetchJSON(API + "/dirs");
        if (!data.error) sandboxes = data.sandboxes || [];
        paintTarget();
        refreshPanel(false);
        setInterval(() => refreshPanel(false), POLL_MS);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
