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
    let lastHistory = []; // finished review sessions (newest first)

    // review session: the latest banner from /review/*. the side panel and
    // the editor's marker highlights are both rendered from this.
    let session = null;
    let selIdx = 0;      // marker selected in the side panel
    let sideHost = null; // element appended to the coder modal's .coder-editor-split
    let sideNote = "";   // transient warning line inside the panel

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-25)
    // sweep target: deslop never inherits the sandbox selected in the coder
    // sidebar. the panel picks its own sandbox from a dropdown and the
    // folder from a lazy tree: each level is fetched from /dirs on demand
    // (with a has_children flag per row deciding the carets), so any depth
    // is reachable without shipping - or navigating - the whole listing.
    // targetSandbox "" = the server-side default scan_path.
    let sandboxes = [];
    let targetSandbox = "";
    let targetDir = "";     // "" = whole sandbox
    let userPicked = false; // once the user picks, state stops steering
    let treeKids = {};      // sandbox||rel -> { loaded, loading, dirs, truncated, error }
    let treeOpen = {};      // sandbox||rel -> true while expanded

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
        html += historyHTML(lastHistory);
        return html;
    }

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-25)
    // session history: one row per finished review session (complete or
    // interrupted), served from data/deslop/history.jsonl. the tooltip
    // unpacks duration + the per-file event trail.
    function histWhen(iso) {
        if (!iso) return "?";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
        const p = function (n) { return String(n).padStart(2, "0"); };
        return p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    }

    function histDur(sec) {
        sec = parseInt(sec, 10) || 0;
        if (sec < 60) return sec + "s";
        const m = Math.floor(sec / 60);
        if (m < 60) return m + "m";
        return Math.floor(m / 60) + "h " + (m % 60) + "m";
    }

    function historyHTML(items) {
        if (!items || !items.length) return "";
        let html =
            '<div class="deslop-group">' +
            '<div class="deslop-sec">session history</div>' +
            '<div class="deslop-hist">';
        for (const r of items) {
            const bits = [];
            if (r.files_cleaned) bits.push(r.files_cleaned + " cleaned");
            if (r.markers_stamped) bits.push(r.markers_stamped + " stamped");
            if (r.markers_removed) bits.push(r.markers_removed + " removed");
            if (r.files_skipped) bits.push(r.files_skipped + " skipped");
            const rootShort = String(r.root || "").split("/").filter(Boolean).pop() || "?";
            const events = r.events || [];
            const evLines = events.slice(0, 12).map(function (e) {
                return e.event + " " + (e.file || "") + (e.line ? ":" + e.line : "") + (e.count ? " x" + e.count : "");
            });
            const tip =
                (r.root || "?") + "\n" +
                (r.started_at || "?") + " \u2192 " + (r.ended_at || "?") + " (" + histDur(r.duration_s) + ")" +
                (r.interrupted ? " \u00b7 interrupted" : "") +
                (evLines.length ? "\n" + evLines.join("\n") : "") +
                (events.length > 12 ? "\n\u2026 " + (events.length - 12) + " more" : "");
            html +=
                '<div class="deslop-hist-row' + (r.interrupted ? " interrupted" : "") + '" title="' + esc(tip) + '">' +
                '<span class="deslop-hist-when">' + esc(histWhen(r.started_at)) + "</span>" +
                '<span class="deslop-hist-root">' + (r.interrupted ? "&#9888; " : "") + esc(rootShort) + "</span>" +
                '<span class="deslop-hist-sum">' + esc(bits.join(" \u00b7 ") || "no changes") + "</span>" +
                "</div>";
        }
        html += "</div></div>";
        return html;
    }

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-25) harness:openlumara
    // -- target pickers ---------------------------------------------------------
    // the chrome is built once per panel element and survives dashboard
    // repaints; the folder tree under the sandbox dropdown expands lazily,
    // one /dirs roundtrip per freshly opened level, so any depth is
    // reachable without turning the picker into a flat wall of names.

    function treeKey(rel) { return targetSandbox + "||" + rel; }

    function ensureChrome(el) {
        if (el.querySelector(".deslop-target")) return;
        el.innerHTML =
            '<div class="deslop-target">' +
            '<select class="deslop-select" data-deslop-sandbox title="coder sandbox to sweep"></select>' +
            '<div class="deslop-tree" data-deslop-tree></div>' +
            "</div>" +
            '<div class="deslop-body"></div>';
        paintTarget();
    }

    function paintTarget() {
        document.querySelectorAll(PANEL_SEL).forEach((el) => {
            if (!el.querySelector(".deslop-target")) { ensureChrome(el); return; }
            const sb = el.querySelector("[data-deslop-sandbox]");

            let html = '<option value="">default scan path</option>';
            for (const name of sandboxes) {
                html += '<option value="' + esc(name) + '">' + esc(name) + "</option>";
            }
            sb.innerHTML = html;
            sb.value = targetSandbox;

            const tree = el.querySelector("[data-deslop-tree]");
            if (tree) tree.innerHTML = paintTreeHtml();
        });
    }

    // depth-first rows of every expanded node, starting at rel's children.
    // carets only exist where the server saw a subfolder, so leaf folders
    // stay clean and clicking a caret can never open an empty node.
    function treeRows(rel, depth, out) {
        const node = treeKids[treeKey(rel)];
        if (!node || !node.loaded) return;
        for (const d of node.dirs) {
            const open = !!treeOpen[treeKey(d.path)];
            out.push(
                '<button type="button" class="deslop-tree-row' + (d.path === targetDir ? " selected" : "") + '"' +
                ' data-deslop-dir="' + esc(d.path) + '" style="padding-left:' + (depth * 14 + 6) + 'px"' +
                ' title="' + esc(d.path) + '">' +
                (d.has_children
                    ? '<span class="deslop-caret' + (open ? " open" : "") + '" data-deslop-toggle="' + esc(d.path) + '">&#9656;</span>'
                    : '<span class="deslop-caret pad"></span>') +
                '<span class="deslop-tree-name">' + esc(d.name) + "</span>" +
                "</button>");
            if (open) treeRows(d.path, depth + 1, out);
        }
    }

    function paintTreeHtml() {
        if (!targetSandbox) {
            return '<div class="deslop-tree-empty">pick a sandbox to browse folders</div>';
        }
        const out = [
            '<button type="button" class="deslop-tree-row root' + (targetDir === "" ? " selected" : "") + '"' +
            ' data-deslop-dir="" style="padding-left:6px" title="whole sandbox">' +
            '<span class="deslop-caret pad"></span><span class="deslop-tree-name">whole sandbox</span></button>',
        ];
        const root = treeKids[treeKey("")];
        if (!root || root.loading) {
            out.push('<div class="deslop-tree-note" style="padding-left:8px">loading folders...</div>');
        } else if (root.error) {
            out.push('<div class="deslop-tree-note err" style="padding-left:8px">' + esc(root.error) + "</div>");
        } else {
            treeRows("", 1, out);
            if (!root.dirs.length) out.push('<div class="deslop-tree-note" style="padding-left:8px">no subfolders</div>');
            if (root.truncated) out.push('<div class="deslop-tree-note" style="padding-left:8px">(level list capped)</div>');
        }
        return out.join("");
    }

    function paintTree() {
        document.querySelectorAll(PANEL_SEL).forEach((el) => {
            const host = el.querySelector("[data-deslop-tree]");
            if (host) host.innerHTML = paintTreeHtml();
        });
    }

    async function loadChildren(rel) {
        if (!targetSandbox) return;
        const key = treeKey(rel);
        const cached = treeKids[key];
        if (cached && (cached.loaded || cached.loading)) return;
        treeKids[key] = { loading: true, dirs: [], truncated: false };
        // the sandbox is frozen from the key: switching mid-flight must not
        // make a late reply paint another sandbox's folder into this slot
        const data = await fetchJSON(
            API + "/dirs?sandbox=" + encodeURIComponent(key.split("||")[0]) +
            "&path=" + encodeURIComponent(rel)
        );
        treeKids[key] = data.error
            ? { loaded: true, dirs: [], truncated: false, error: data.error }
            : { loaded: true, dirs: data.dirs || [], truncated: !!data.truncated };
        paintTree();
    }

    // load the root level; when a folder is already picked (e.g. the panel
    // mirrored a server-side root) also expand + preload its whole ancestor
    // chain so the selection is visible instead of hidden behind carets
    function ensureTreeRoot() {
        loadChildren("");
        if (!targetDir) return;
        const parts = targetDir.split("/");
        let acc = "";
        for (let i = 0; i < parts.length; i++) {
            acc = i === 0 ? parts[0] : acc + "/" + parts[i];
            treeOpen[treeKey(acc)] = true;
            loadChildren(acc);
        }
    }

    function renderPanel(st) {
        lastState = st;
        // before any explicit pick, mirror whatever the server actually swept
        if (st && !userPicked && st.root_sandbox && st.root_sandbox !== targetSandbox) {
            targetSandbox = st.root_sandbox;
            targetDir = st.root_rel || "";
            ensureTreeRoot();
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
        // session history rides along with every repaint; on failure keep
        // whatever was on screen rather than blanking the section
        const h = await fetchJSON(API + "/history?limit=6");
        if (!h.error) lastHistory = h.sessions || [];
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

        // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-25)
        // coder only fetches its module settings (vim/emacs/... keymap,
        // autosave) when the coder sidebar first mounts - deslop is often
        // the very first thing to open a file, which left the editor on
        // the standard keymap. bootstrap the settings before the editor
        // gets created so the editing-mode setting is always respected.
        if (!panel.sandboxes.length) await panel.loadSandboxes();

        // assign directly: the sandbox may not be in the store's list yet
        // (switchSandbox would no-op on an unknown name). the tree reload
        // is fire-and-forget: openFile doesn't need it.
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

        // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-25)
        // folder tree: the caret opens/closes a level (children fetched on
        // first open), the rest of the row picks it as the sweep target.
        const caret = ev.target.closest("[data-deslop-toggle]");
        if (caret && caret.closest("[data-deslop-tree]")) {
            ev.preventDefault();
            const rel = caret.getAttribute("data-deslop-toggle");
            const key = treeKey(rel);
            if (treeOpen[key]) {
                delete treeOpen[key];
                paintTree();
            } else {
                treeOpen[key] = true;
                paintTree();
                loadChildren(rel);
            }
            return;
        }

        const dirRow = ev.target.closest("[data-deslop-dir]");
        if (dirRow && dirRow.closest("[data-deslop-tree]")) {
            ev.preventDefault();
            userPicked = true;
            targetDir = dirRow.getAttribute("data-deslop-dir") || "";
            paintTree();
            refreshPanel(true);
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

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-25) harness:openlumara
    // sandbox dropdown pick: reset the folder, load the tree's root level
    // and sweep the new target. folder picks ride the tree rows instead
    // (click handler above), so only the sandbox lives here now.
    document.addEventListener("change", (ev) => {
        const sb = ev.target.closest("[data-deslop-sandbox]");
        if (!sb) return;
        userPicked = true;
        targetSandbox = sb.value;
        targetDir = "";
        paintTarget();
        ensureTreeRoot();
        refreshPanel(true);
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
        // (session.markers).length guard: after a live refresh absorbs the
        // last marker, the file legitimately shows zero marks - without it
        // the pump would reopen the file every tick trying to re-apply an
        // empty spec.
        if (!marked && (session.markers || []).length && panel.editor.cmReady && panel.editor.content && !panel.editor.dirty) {
            // session file opened without marks (e.g. manually after a page
            // reload): swap it back in with its markers as F8 nav points.
            // only when fully loaded and clean, so no edits are ever lost.
            openFileFor(session);
            return;
        }
        if (attachSide()) renderSide();
    }, SIDE_MS);

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-25)
    // live sync: coder.js broadcasts "coder-saved" after every successful
    // save (and revert). when the session's own file was the one written,
    // ask the server to refresh it: the refresh action re-snapshots the
    // file (absorbing marker removals into the session tally) WITHOUT
    // advancing, so the side panel list, the "x left" badge and the F8
    // nav points all track what just happened in the editor. the session
    // only moves on when the user presses "done editing".
    let syncing = false;
    let lastMarkerSig = "";

    async function refreshSession() {
        if (syncing) return;
        if (!session || session.done || !session.rel) return;
        syncing = true;
        let p;
        try {
            p = await fetchJSON(API + "/review/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "refresh" }),
            });
        } finally {
            syncing = false;
        }
        if (p.error) {
            // loud on purpose: a silent return here used to hide server-side
            // rejections (e.g. a module that was never restarted and does
            // not know the refresh action yet)
            console.error("[deslop] live refresh failed:", p.error);
            return;
        }
        if (p.done || !p.active) {
            // the session ended elsewhere (quit from another tab): drop the
            // panel and repaint the dashboard instead of leaving it stale
            session = null;
            detachSide();
            refreshPanel(false);
            return;
        }
        session = p;
        selIdx = Math.min(selIdx, Math.max(0, (p.markers || []).length - 1));

        // the 3s poll also runs this call - only repaint + re-mark when the
        // marker picture actually changed (and always right after the file
        // itself switched, where lastMarkerSig belongs to another file)
        // the sig covers line AND marker text, so an in-place edit of a
        // marker (model name, date, ...) repaints too, not just removals
        const sig = p.rel + "|" + (p.markers_left || 0) + "|" + (p.markers || []).map((m) => m.line + ":" + (m.raw || "")).join(";");
        const changed = sig !== lastMarkerSig;
        lastMarkerSig = sig;
        if (!changed) return;

        // re-mark the open buffer in place (same file: a reload would eat
        // the caret position and the undo history)
        const panel = window.Alpine ? Alpine.store("coderPanel") : null;
        if (panel && panel.setDiffMarks && panel.editor && panel.editor.path === p.rel) {
            const lines = (p.markers || []).map((m) => m.line);
            panel.setDiffMarks(lines.length ? {
                adds: lines,
                dels: [],
                label: "deslop markers",
                kind: "deslop",
            } : null);
        }
        renderSide();
        refreshPanel(false);
    }

    window.addEventListener("coder-saved", function (ev) {
        const d = ev.detail || {};
        if (!session || session.done) return;
        if (session.sandbox && d.sandbox && d.sandbox !== session.sandbox) return;
        if (d.path !== session.rel) return;
        lastMarkerSig = ""; // force a repaint of whatever just changed
        refreshSession();
    });

    // -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-25)
    // poll fallback for the save event: while the session file is open and
    // CLEAN, ask the server for a refresh every few seconds. saves normally
    // fire coder-saved (near-instant sync); this catches everything the
    // event can miss - and thanks to the server-side digest check plus the
    // marker-sig guard above, an unchanged file costs one small read and
    // zero repaints. never runs while the buffer is dirty (disk is mid-
    // edit territory; a save always clears dirty before we'd poll again).
    setInterval(function () {
        if (!window.Alpine) return;
        if (!session || session.done || syncing) return;
        const ui = Alpine.store("ui");
        const panel = Alpine.store("coderPanel");
        if (!ui || ui.currentModal !== "coder_file") return;
        if (!panel || !panel.editor || panel.editor.path !== session.rel) return;
        if (panel.editor.dirty || panel.editor.saving || !panel.editor.cmReady) return;
        refreshSession();
    }, 3000);

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
