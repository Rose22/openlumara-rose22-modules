// -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
// deslop webui logic. the sidebar tab is a compact dashboard with a
// start/resume button. reviewing happens in the coder editor: each flagged
// file opens ONCE with all of its pending markers highlighted (the same
// line-handle + F8 trick the git sidebar uses for diff points, via the
// coderPanel store), and a deslop side panel docks beside the editor with
// the marker list, session stats and the stamp/next/skip/quit actions.
// the deslop_review modal is kept for summaries and for files that live
// outside every coder sandbox.
(function () {
    const API = "/api/ext/deslop";
    const PANEL_SEL = "[data-deslop='panel']";
    const RV_SEL = "[data-deslop-rv]";
    const POLL_MS = 90000;
    const SIDE_MS = 500;

    let lastState = null;

    // review session: the latest banner from /review/*. the side panel and
    // the editor's marker highlights are both rendered from this.
    let session = null;
    let selIdx = 0;      // marker selected in the side panel
    let sideHost = null; // element appended to the coder modal's .coder-editor-split
    let sideNote = "";   // transient warning line inside the panel

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

    function openReviewModal(p) {
        if (!window.Alpine) return;
        Alpine.store("ui").openModal("deslop_review");
        // the modal body lives inside an x-if template: it only exists once
        // Alpine has flushed. renderReview is idempotent, so a second tick
        // is harmless and covers slower mounts.
        renderReview(p);
        requestAnimationFrame(() => renderReview(p));
        setTimeout(() => renderReview(p), 80);
    }

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    // -- review engine: one editor per file + a side panel --------------------
    // advance() is the single entry point after every session transition
    // (start / stamp / continue / skip). sandboxed files open in the coder
    // editor with their markers as F8 nav points; the modal only covers
    // summaries and files outside every sandbox.

    async function openFileFor(p) {
        const panel = Alpine.store("coderPanel");
        if (!panel) return false;
        // assign directly: switchSandbox() no-ops while the store's sandbox
        // list is still empty (it only loads when the coder tab mounts). the
        // tree reload is fire-and-forget: openFile doesn't need it.
        if (panel.sandbox !== p.sandbox) {
            panel.sandbox = p.sandbox;
            panel.onSandboxChange();
        }
        await panel.openFile({ path: p.rel }, p.line || 0, {
            adds: (p.markers || []).map((m) => m.line),
            dels: [],
            label: "deslop markers",
            kind: "deslop",
        });
        return true;
    }

    async function advance(p) {
        if (!p) return;
        sideNote = "";

        if (p.error) {
            session = null;
            detachSide();
            openReviewModal(p);
            return;
        }
        if (p.done || !p.active) {
            // session over (or nothing to do): summary in the modal
            session = null;
            detachSide();
            openReviewModal(p);
            refreshPanel(false);
            return;
        }
        if (!p.sandbox) {
            // outside every sandbox: fall back to the modal's context view
            session = p;
            detachSide();
            openReviewModal(p);
            return;
        }

        const panel = window.Alpine ? Alpine.store("coderPanel") : null;
        if (!panel) return;

        const sameFile = panel.editor && panel.editor.path === p.rel;
        if (panel.editor && panel.editor.dirty) {
            if (sameFile) {
                // a stamp rewrote the file on disk; never clobber unsaved
                // edits by re-fetching. keep the buffer, warn about the clash.
                session = p;
                selIdx = Math.min(selIdx, Math.max(0, (p.markers || []).length - 1));
                attachSide();
                renderSide();
                sideWarn("stamped on disk while this file has unsaved edits - saving now would undo the stamp. check the marker text in the editor.");
                refreshPanel(false);
                return;
            }
            if (!window.confirm("Unsaved changes in " + panel.editor.path + " will be lost. Open the next deslop file?")) return;
        }

        session = p;
        selIdx = 0;
        try {
            await openFileFor(p);
        } catch (err) {
            console.error("[deslop] openFile threw:", err);
            sideNote = "opening in the editor failed: " + (err && err.message ? err.message : err);
        }
        attachSide();
        renderSide();
        refreshPanel(false);
    }

    async function doAction(action, line) {
        const body = { action: action };
        if (line) body.line = line;
        const p = await fetchJSON(API + "/review/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        await advance(p);
    }

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    // -- side panel ------------------------------------------------------------
    // docked inside the coder modal's split row (the same slot the markdown
    // preview uses). a pump loop attaches/detaches it as the modal opens or
    // the session ends; Alpine's unmount takes it down with the modal too.

    function sideHTML(p) {
        if (!p) return '<div class="deslop-side-empty">no active session</div>';

        const status =
            "file " + p.file_index + "/" + p.file_total +
            " · cleaned " + p.cleaned +
            " · removed " + p.removed +
            " · stamped " + p.stamped +
            (p.skipped ? " · skipped " + p.skipped : "");

        let html =
            '<div class="deslop-side-head">' +
            '<span class="deslop-side-title" title="' + esc(p.root) + '">&#129529; deslop</span>' +
            '<span class="deslop-badge">' + (p.markers_left || 0) + " left</span>" +
            "</div>" +
            '<div class="deslop-side-file" title="' + esc(p.file) + '">' + esc(p.file_rel) + "</div>" +
            '<div class="deslop-side-status">' + esc(status) + "</div>" +
            '<div class="deslop-side-sec">markers in this file</div>' +
            '<div class="deslop-side-list">';

        const markers = p.markers || [];
        markers.forEach(function (m, i) {
            const meta = m.malformed ? "malformed" : [m.model, m.date].filter(Boolean).join(" · ");
            html +=
                '<button type="button" class="deslop-marker-row' + (i === selIdx ? " active" : "") + (m.malformed ? " malformed" : "") + '"' +
                ' data-deslop-marker="' + i + '" title="' + esc(m.raw) + '">' +
                '<span class="deslop-marker-line">:' + m.line + "</span>" +
                '<span class="deslop-marker-meta">' + esc(meta) + "</span>" +
                "</button>";
        });
        if (!markers.length) html += '<div class="deslop-side-empty">no pending markers here</div>';
        html += "</div>";

        const m = markers[selIdx];
        if (m) {
            html +=
                '<div class="deslop-side-sec">selected marker</div>' +
                '<pre class="deslop-side-detail">' + esc(m.raw) + "</pre>";
        }
        if (p.verdict) html += '<div class="deslop-verdict">' + esc(p.verdict) + "</div>";
        if (p.nag) html += '<div class="deslop-nag">' + esc(p.nag) + "</div>";
        if (sideNote) html += '<div class="deslop-nag">' + esc(sideNote) + "</div>";

        html +=
            '<div class="deslop-side-actions">' +
            '<button type="button" class="deslop-btn-big ok" data-deslop-side="stamp"' +
            (m && m.malformed ? ' disabled title="malformed - fix it in the editor"' : "") +
            '>\u2713 stamp</button>' +
            '<button type="button" class="deslop-btn-big" data-deslop-side="continue" title="re-check this file, then move to the next one">\u2192 done editing</button>' +
            '<button type="button" class="deslop-btn-big" data-deslop-side="skip">\u00bb skip file</button>' +
            '<button type="button" class="deslop-btn-big quit" data-deslop-side="quit">\u2715 quit</button>' +
            "</div>" +
            '<div class="deslop-side-hint">F8 / shift+F8 jumps between markers \u00b7 click a marker to jump to it</div>';
        return html;
    }

    function renderSide() {
        if (sideHost && sideHost.isConnected) sideHost.innerHTML = sideHTML(session);
    }

    // returns true when the panel was freshly attached (so the caller renders)
    function attachSide() {
        if (sideHost && sideHost.isConnected) return false;
        const split = document.querySelector(".coder-editor-modal .coder-editor-split");
        if (!split) return false;
        sideHost = document.createElement("div");
        sideHost.className = "deslop-side";
        split.appendChild(sideHost);
        return true;
    }

    function detachSide() {
        if (sideHost && sideHost.parentNode) sideHost.parentNode.removeChild(sideHost);
        sideHost = null;
    }

    function sideWarn(msg) {
        sideNote = msg;
        renderSide();
    }

    // -- wiring ---------------------------------------------------------------------

    document.addEventListener("click", async (ev) => {
        const start = ev.target.closest("[data-deslop-start]");
        if (start) {
            ev.preventDefault();
            start.disabled = true;
            const p = await fetchJSON(API + "/review/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: targetPath() }) });
            start.disabled = false;
            if (!p.error) await advance(p);
            else console.error("[deslop] review start:", p.error);
            return;
        }

        // side panel: marker row -> jump the editor to it (point index and
        // marker index match: deslop specs get one nav point per marker)
        const row = ev.target.closest("[data-deslop-marker]");
        if (row && sideHost && sideHost.contains(row)) {
            ev.preventDefault();
            const i = parseInt(row.getAttribute("data-deslop-marker"), 10);
            if (!isNaN(i) && session && session.markers && session.markers[i]) {
                selIdx = i;
                const panel = Alpine.store("coderPanel");
                if (panel && panel.diffGoTo) panel.diffGoTo(i);
                renderSide();
            }
            return;
        }

        // side panel actions
        const side = ev.target.closest("[data-deslop-side]");
        if (side && sideHost && sideHost.contains(side)) {
            ev.preventDefault();
            const action = side.getAttribute("data-deslop-side");
            side.disabled = true;
            if (action === "stamp") {
                const m = session && session.markers ? session.markers[selIdx] : null;
                await doAction("stamp", m ? m.line : null);
            } else {
                await doAction(action);
            }
            return;
        }

        const rv = ev.target.closest("[data-deslop-rv]");
        if (rv && rv.getAttribute("data-deslop-rv")) {
            ev.preventDefault();
            const action = rv.getAttribute("data-deslop-rv");
            if (action === "open") {
                // modal -> editor handoff (the editor replaces the modal)
                const p = await fetchJSON(API + "/review/current");
                if (!p.error) await advance(p);
            } else if (action === "close") {
                if (window.Alpine) Alpine.store("ui").closeModal();
                refreshPanel(false);
            } else {
                rv.disabled = true;
                await doAction(action);
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

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    // -- side panel pump + caret sync -------------------------------------------
    // the panel docks only beside the session's own file, so it follows the
    // coder modal open/close (Alpine unmounts take it down with the modal).
    setInterval(function () {
        if (!window.Alpine) return;
        const ui = Alpine.store("ui");
        const panel = Alpine.store("coderPanel");
        const want = !!(session && !session.done && session.sandbox
            && ui && ui.currentModal === "coder_file"
            && panel && panel.editor && panel.editor.path === session.rel);
        if (!want) {
            if (sideHost) detachSide();
            return;
        }
        const marked = panel.diff.active && panel.diff.kind === "deslop";
        if (!marked && panel.editor.cmReady && panel.editor.content && !panel.editor.dirty) {
            // session file opened without marks (e.g. manually after a page
            // reload): swap it back in with its markers as F8 nav points.
            // only when fully loaded and clean, so no edits are ever lost.
            openFileFor(session);
            return;
        }
        if (attachSide()) renderSide();
    }, SIDE_MS);

    // coder.js broadcasts the active marker when the caret crosses one
    window.addEventListener("deslop-caret", function (ev) {
        if (!session || !session.markers) return;
        const idx = ev.detail ? ev.detail.idx : -1;
        if (idx == null || idx < 0 || idx >= session.markers.length || idx === selIdx) return;
        selIdx = idx;
        renderSide();
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
        // a review session lives server-side and survives page reloads: pick
        // it back up so the panel can re-dock once the file is opened again
        const cur = await fetchJSON(API + "/review/current");
        if (!cur.error && cur.active && !cur.done && cur.sandbox) session = cur;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
