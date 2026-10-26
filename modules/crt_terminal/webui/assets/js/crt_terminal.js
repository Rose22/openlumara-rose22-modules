/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-26) harness:openlumara
   crt_terminal: makes the terminal actually work.
   - intercepts local commands (settings/help/clear/crt/about) by wrapping
     $store.chat.send, so they never reach the AI
   - settings command (and F1) opens the real settings modal on top, which is
     how you disable this module
   - BIOS boot screen, WebAudio beeps, live phosphor/mode switching, and a
     MutationObserver that keeps 'clear' applied across Alpine's virtualized
     turn rendering. */
(function () {
    "use strict";

    var LS_MODE = "crt_mode";
    var LS_PHOSPHOR = "crt_phosphor";
    var SS_BOOTED = "crt_booted";

    var PHOSPHOR_LABELS = {
        green: "P1 GREEN",
        amber: "P3 AMBER",
        cyan: "CYAN",
        white: "P4 WHITE"
    };

    var BOOT_LINES = [
        "OPENLUMARA BIOS v2.06  (C) 1986-1998 LUMARA SYSTEMS",
        "CPU: AMD STRIX HALO APU ................ OK",
        "@MEM",
        "DETECTING MASS STORAGE ................. OK",
        "LOADING OPENLUMARA.SYS ................. OK",
        "CHECKING /DEV/MEMORY ................... OK",
        "CHECKING /DEV/CHAT ..................... OK",
        "CHECKING /DEV/MODULES .................. OK",
        "INITIALIZING NEURAL LINK ............... OK",
        "CALIBRATING PHOSPHOR ARRAY ............. OK",
        "",
        "CRT_TERMINAL.SYS v3.2 LOADED",
        "TYPE 'HELP' FOR COMMANDS.  TYPE 'SETTINGS' TO CONFIGURE.",
        ""
    ];

    var FORTUNES = [
        "A computer once beat me at chess, but it was no match for me at kick boxing.",
        "The best way to accelerate a terminal is at 9.8 m/s per second.",
        "There are two hard things in computer science: cache invalidation, naming things, and off-by-one errors.",
        "Never trust a computer you can't throw out a window.",
        "The phosphor is strong with this one.",
        "Real programmers don't comment their code. It was hard to write, it should be hard to understand.",
        "Deleted code is debugged code.",
        "A user interface is like a joke. If you have to explain it, it's not that good.",
        "Walks are like functions: if you have to walk more than 3 blocks, use recursion (a bike).",
        "The internet: since 1995, a place where people who don't know you tell you that you're wrong.",
        "Your reflexes are fine. It's the buffering that's killing you.",
        "Fortune unavailable: /dev/fortune is on fire. Have another smoothie instead."
    ];

    var HELP_TEXT =
        "LOCAL TERMINAL COMMANDS (never sent to the AI):\n" +
        "  settings              OPEN SETTINGS UI (disable this module from there)\n" +
        "  help                  THIS SCREEN\n" +
        "  clear                 CLEAR THE SCREEN  (^L)\n" +
        "  stop                  INTERRUPT THE CURRENT GENERATION  (^C)\n" +
        "  fortune               WISDOM, SERVED AMBER OR GREEN\n" +
        "  testcard              SERVICE TEST PATTERN (ESC OR Q TO EXIT)\n" +
        "  osd                   ON-SCREEN DISPLAY: BRIGHTNESS / CONTRAST\n" +
        "  crt on | crt off      TOGGLE THE CRT SKIN\n" +
        "  crt green|amber|cyan|white   SWITCH PHOSPHOR\n" +
        "  about                 SHOW THE BANNER\n" +
        "HOTKEYS: F1=SETTINGS  F2=HELP  ^L=CLEAR  ^C=STOP";

    var cfg = null;
    var audioCtx = null;
    var clearCount = 0;
    var lastChat = null;

    /* ---------- helpers ---------- */

    function $(id) { return document.getElementById(id); }

    function storeGet(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
    }

    function storeSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode, whatever */ }
    }

    function modeOn() {
        return document.documentElement.classList.contains("crt-on");
    }

    function currentPhosphor() {
        return storeGet(LS_PHOSPHOR, null) || (cfg && cfg.phosphor) || "green";
    }

    function updateStatusBar() {
        var el = $("crt-status-phosphor");
        if (el) el.textContent = "PHOSPHOR: " + (PHOSPHOR_LABELS[currentPhosphor()] || "P1 GREEN");
    }

    /* ---------- audio ---------- */

    function getCtx() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch (e) { return null; }
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
        return audioCtx;
    }

    function ensureAudio() {
        if (!cfg || !cfg.sounds) return null;
        return getCtx();
    }

    function blip(freq, duration, gainValue) {
        var ctx = ensureAudio();
        if (!ctx) return;

        // ride the webui's master SFX volume so the volume slider works
        // (bare identifier: AudioManager is a lexical const, not on window)
        var vol = 1;
        if (typeof AudioManager !== "undefined" && typeof AudioManager.volume === "number") {
            vol = AudioManager.volume;
        }

        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(gainValue * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }

    function bell() { blip(880, 0.18, 0.04); }
    function clicky() { blip(1400, 0.015, 0.012); }
    function thunk() { blip(180, 0.06, 0.05); }   /* Enter: heavy clack */
    function tick() { blip(950, 0.02, 0.02); }    /* Backspace: dry tick */

    /* floppy drive seek: filtered noise sweep + a head-load click */
    function floppySeek() {
        var ctx = ensureAudio();
        if (!ctx) return;
        var vol = typeof AudioManager !== "undefined" &&
            typeof AudioManager.volume === "number" ? AudioManager.volume : 1;
        var dur = 0.18;
        var buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        var src = ctx.createBufferSource();
        src.buffer = buffer;
        var bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 5;
        bp.frequency.setValueAtTime(1500, ctx.currentTime);
        bp.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + dur);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0.05 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        src.connect(bp).connect(gain).connect(ctx.destination);
        src.start();
        setTimeout(function () { blip(2100, 0.008, 0.02 * vol); }, 130);
    }

    /* ---------- flyback whine ---------- */

    var whineOsc = null;

    function startWhine() {
        if (!cfg.whine || whineOsc) return;
        var ctx = getCtx();
        if (!ctx) return;

        var vol = 1;
        if (typeof AudioManager !== "undefined" && typeof AudioManager.volume === "number") {
            vol = AudioManager.volume;
        }

        /* the real thing: one thin magnetostriction tone at the PAL line
           frequency (15.625 kHz; NTSC was 15.734). no subharmonics — a
           mid-frequency sine there is an alarm, not a TV. faint by
           design; adult ears hear little to none, which is accurate. */
        whineOsc = ctx.createOscillator();
        var gain = ctx.createGain();
        whineOsc.frequency.value = 15625;
        gain.gain.value = 0.012 * vol;
        whineOsc.connect(gain).connect(ctx.destination);
        whineOsc.start();
    }

    function stopWhine() {
        if (!whineOsc) return;
        try { whineOsc.stop(); } catch (e) { /* already dead */ }
        whineOsc = null;
    }

    /* ---------- message sound replacement ---------- */

    /* square-wave beeps in place of the webui's soft synth sounds.
       while CRT mode is active every audio type is forced on, overriding
       the per-sound toggles from the audio settings (the original play()
       is skipped entirely, so its isSoundEnabled gate never applies). */
    function crtSound(id) {
        if (id === "send_message") {
            blip(740, 0.06, 0.05);
            setTimeout(function () { blip(520, 0.07, 0.04); }, 65);
        } else if (id === "response_start") {
            blip(520, 0.06, 0.05);
            setTimeout(function () { blip(760, 0.09, 0.05); }, 65);
        } else if (id === "completion") {
            bell();
        } else if (id === "reasoning_end") {
            blip(660, 0.1, 0.03);
            setTimeout(function () { blip(880, 0.14, 0.03); }, 110);
        } else if (id === "typing" || id === "typewriter") {
            clicky();
        } else if (id === "token") {
            blip(2200, 0.008, 0.006);
        } else {
            return false;
        }
        return true;
    }

    var procTimer = null;

    function crtProcessingLoop() {
        if (procTimer) return;
        blip(196, 0.25, 0.03);
        procTimer = setInterval(function () { blip(196, 0.25, 0.03); }, 2000);
    }

    function crtProcessingStop() {
        if (procTimer) { clearInterval(procTimer); procTimer = null; }
    }

    function hookAudio() {
        // NOTE: AudioManager is a top-level const in utils/audio.js, which
        // means it is NOT a property of window (const/let globals live in the
        // script-level lexical scope). Reference it as a bare identifier.
        if (typeof AudioManager === "undefined") return;

        var origPlay = AudioManager.play;
        AudioManager.play = function (id) {
            if (cfg.sounds && modeOn() && crtSound(id)) return;
            return origPlay.apply(AudioManager, arguments);
        };

        var origProc = AudioManager.playProcessingSound;
        AudioManager.playProcessingSound = function () {
            if (cfg.sounds && modeOn()) { crtProcessingLoop(); return; }
            return origProc.apply(AudioManager, arguments);
        };

        var origProcStop = AudioManager.stopProcessingSound;
        AudioManager.stopProcessingSound = function () {
            crtProcessingStop();
            return origProcStop.apply(AudioManager, arguments);
        };
    }

    /* ---------- mode + phosphor ---------- */

    function applyMode(on) {
        var root = document.documentElement;
        storeSet(LS_MODE, on);

        if (on) {
            var p = currentPhosphor();
            root.classList.remove("crt-green", "crt-amber", "crt-cyan", "crt-white");
            root.classList.add("crt-on", "crt-" + p);
            if (cfg.scanlines && cfg.scanlines !== "off") {
                root.classList.add("crt-scan-" + cfg.scanlines);
            }
            if (cfg.flicker) root.classList.add("crt-flicker");
            if (cfg.glow) root.classList.add("crt-glow");
            if (cfg.distortion && cfg.distortion !== "off") {
                root.classList.add("crt-dist-" + cfg.distortion);
            }
            if (cfg.aspect_4_3) root.classList.add("crt-43");
            if (cfg.interlace) root.classList.add("crt-interlace");
            if (cfg.simple_chain) root.classList.add("crt-simple-status");
            relocateInput();
        } else {
            root.classList.remove("crt-on", "crt-flicker", "crt-glow",
                "crt-scan-low", "crt-scan-medium", "crt-scan-high",
                "crt-dist-subtle", "crt-dist-classic", "crt-dist-heavy",
                "crt-43", "crt-interlace", "crt-simple-status");
            restoreInput();
            stopWhine();
            /* no filter cleanup needed: the OSD rule is gated on crt-on,
               which was just removed */
        }
        applyDamp(on);
        if (window.CRT_CURSOR_SYNC) window.CRT_CURSOR_SYNC();
        updateStatusBar();
    }

    function setPhosphor(p) {
        storeSet(LS_PHOSPHOR, p);
        var root = document.documentElement;
        root.classList.remove("crt-green", "crt-amber", "crt-cyan", "crt-white");
        root.classList.add("crt-" + p);
        updateStatusBar();
    }

    function showOffToast() {
        var toast = document.createElement("div");
        toast.id = "crt-off-toast";
        toast.textContent = "CRT TERMINAL DEACTIVATED :: type 'crt on' to restore";
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 4000);
    }

    /* ---------- command output ---------- */

    /* local command output is transient: wiped when a real message is
       sent or the chat is switched (they live in #messages, outside
       Alpine's x-for, so nothing else removes them) */
    function clearResponses() {
        var lines = document.querySelectorAll("#messages .crt-response");
        for (var i = 0; i < lines.length; i++) lines[i].remove();
    }

    /* the real input bar (#input) is relocated into #messages so the
       prompt sits in the transcript, always directly below the latest
       message, like a terminal at the end of its scrollback */
    var inputHome = null;

    function relocateInput() {
        var messages = $("messages");
        var input = $("input");
        if (!messages || !input) return;
        if (messages.contains(input)) return;
        if (!inputHome) {
            inputHome = { parent: input.parentNode, next: input.nextSibling };
        }
        messages.appendChild(input);
        messages.scrollTop = messages.scrollHeight;
    }

    function restoreInput() {
        var input = $("input");
        if (!input || !inputHome) return;
        if (input.parentNode === inputHome.parent) return;
        inputHome.parent.insertBefore(input, inputHome.next);
    }

    function printResponse(text) {
        var messages = $("messages");
        if (!messages) return;
        var line = document.createElement("div");
        line.className = "crt-response";
        line.textContent = text;

        // keep the relocated prompt the very last line
        var anchor = $("input");
        if (anchor && anchor.parentNode === messages) {
            messages.insertBefore(line, anchor);
        } else {
            messages.appendChild(line);
        }
        messages.scrollTop = messages.scrollHeight;
        bell();
    }

    /* ---------- clear (survives Alpine's virtualized rendering) ---------- */

    /* NOTE: applyClear doubles as the #messages MutationObserver callback
       (watchClear), so it must never remove anything — printing a response
       would retrigger it and wipe its own line. Sweeping the module's own
       .crt-response lines happens in the clear command itself. */
    function applyClear() {
        var turns = document.querySelectorAll("#messages [data-turn-index]");
        for (var i = 0; i < turns.length; i++) {
            var idx = Number(turns[i].dataset.turnIndex);
            turns[i].style.display = (clearCount && idx < clearCount) ? "none" : "";
        }
    }

    function watchClear() {
        var messages = $("messages");
        if (!messages) return;
        new MutationObserver(applyClear).observe(messages, { childList: true, subtree: true });
    }

    /* floppy seek every time a tool call card appears: the AI "reading disk" */
    function watchFloppy() {
        var messages = $("messages");
        if (!messages) return;
        new MutationObserver(function (mutations) {
            if (!(cfg.sounds && modeOn())) return;
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var n = added[j];
                    if (n.nodeType !== 1) continue;
                    if ((n.classList && n.classList.contains("tool-call-card")) ||
                        (n.querySelector && n.querySelector(".tool-call-card"))) {
                        floppySeek();
                        return;
                    }
                }
            }
        }).observe(messages, { childList: true, subtree: true });
    }

    /* ---------- commands ---------- */

    function parseCommand(text) {
        if (typeof text !== "string") return null;
        var t = text.trim().toLowerCase();
        if (!t || t.indexOf("\n") !== -1) return null;

        t = t.replace(/^\//, "");

        if (t === "settings") return "settings";
        if (t === "help" || t === "?") return "help";
        if (t === "clear" || t === "cls") return "clear";
        if (t === "stop") return "stop";
        if (t === "fortune") return "fortune";
        if (t === "testcard") return "testcard";
        if (t === "osd") return "osd";
        if (t === "about" || t === "ver") return "about";
        if (t === "crt") return "crt";
        if (t.indexOf("crt ") === 0) return "crt:" + t.slice(4).trim();
        return null;
    }

    function runCommand(cmd) {
        if (cmd === "settings") {
            printResponse("LAUNCHING SETTINGS.EXE ...");
            Alpine.store("ui").openModal("settings");
            return true;
        }
        if (cmd === "help") {
            printResponse(HELP_TEXT);
            return true;
        }
        if (cmd === "clear") {
            var turns = Alpine.store("chat").turnHistory || [];
            clearCount = turns.length;
            clearResponses(); /* blank screen: module's own lines go too */
            applyClear();
            return true;
        }
        if (cmd === "stop") {
            // same socket message the (hidden) STOP button sends
            if (typeof simpleSocketSend === "function") {
                simpleSocketSend({ "type": "stop" });
                printResponse("INTERRUPT SENT (^C)");
            } else {
                printResponse("NO SOCKET CHANNEL AVAILABLE");
            }
            return true;
        }
        if (cmd === "fortune") {
            printResponse(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]);
            return true;
        }
        if (cmd === "testcard") {
            openTestcard();
            return true;
        }
        if (cmd === "osd") {
            /* defer one tick: the Enter keydown that submitted this command
               is still bubbling to the document hookKeys listener, which
               would otherwise see osd.open=true and close it instantly */
            setTimeout(openOsd, 0);
            return true;
        }
        if (cmd === "about") {
            printResponse(
                "CRT-TERMINAL v3.2 :: OPENLUMARA MODULE 'crt_terminal'\n" +
                "PHOSPHOR: " + (PHOSPHOR_LABELS[currentPhosphor()] || "?") +
                " :: SCANLINES: " + ((cfg && cfg.scanlines) || "off").toUpperCase() +
                " :: DISTORTION: " + ((cfg && cfg.distortion) || "off").toUpperCase() +
                " :: ASPECT: " + (cfg && cfg.aspect_4_3 ? "4:3" : "16:9") +
                " :: MODE: " + (modeOn() ? "ONLINE" : "OFFLINE")
            );
            return true;
        }
        if (cmd === "crt") {
            printResponse("CRT MODE: " + (modeOn() ? "ONLINE" : "OFFLINE") +
                " :: TRY 'crt on', 'crt off' OR 'crt <phosphor>'");
            return true;
        }
        if (cmd.indexOf("crt:") === 0) {
            var sub = cmd.slice(4);
            if (sub === "on") {
                applyMode(true);
                powerOn();
                /* defer: the Enter keydown submitting this command is still
                   bubbling, and the boot's skip-on-any-key listener would
                   finish it before it ever paints (same trap as the OSD) */
                setTimeout(function () { runBoot(true); }, 0);
                startWhine();
                focusInput();
            } else if (sub === "off") {
                powerOff(function () {
                    applyMode(false);
                    showOffToast();
                });
            } else if (PHOSPHOR_LABELS[sub]) {
                setPhosphor(sub);
                printResponse("PHOSPHOR SWITCHED: " + PHOSPHOR_LABELS[sub]);
            } else {
                printResponse("UNKNOWN: crt " + sub + " :: TRY on/off/green/amber/cyan/white");
            }
            return true;
        }
        return false;
    }

    /* ---------- boot screen ---------- */

    function runBoot(manual) {
        var boot = $("crt-boot");
        var textEl = $("crt-boot-text");
        if (!boot || !textEl) return;

        var mode = cfg.boot_sequence;
        if (mode === "off" || mode === false) return;
        /* anything that is not "every" (including a legacy saved true)
         * behaves as firstrun. a manual power-on ('crt on') always boots
         * unless boot_sequence is off — you flipped the switch, you get
         * the POST. */
        if (!manual && mode !== "every") {
            try {
                if (sessionStorage.getItem(SS_BOOTED)) return;
                sessionStorage.setItem(SS_BOOTED, "1");
            } catch (e) { /* no session storage: boot anyway */ }
        }

        /* POST success beep */
        blip(1000, 0.12, 0.05);

        var done = false;
        function finish() {
            if (done) return;
            done = true;
            boot.classList.remove("crt-boot-running");
            document.removeEventListener("keydown", finish);
            boot.removeEventListener("click", finish);
            /* the terminal is ready: hand the keyboard to the prompt */
            setTimeout(focusInput, 60);
        }

        boot.classList.add("crt-boot-running");
        document.addEventListener("keydown", finish);
        boot.addEventListener("click", finish);

        var li = 0, ci = 0, out = "";

        /* @MEM: the classic POST memory count, spinning up in real time */
        function memPhase() {
            var total = 262144;
            var shown = 0;
            out += "MEMORY TEST: ";
            function count() {
                if (done) return;
                shown += 16384;
                if (shown >= total) {
                    var pad = "                    ".slice(0, Math.max(0, 7 - String(total).length));
                    out += pad + total + "K ... OK";
                    textEl.textContent = out;
                    li++;
                    ci = 0;
                    setTimeout(step, 120);
                    return;
                }
                var str = String(shown) + "K";
                out = out.replace(/[^\n]*$/, str);
                textEl.textContent = out;
                setTimeout(count, 28);
            }
            textEl.textContent = out;
            setTimeout(count, 150);
        }

        function step() {
            if (done) return;
            if (li >= BOOT_LINES.length) { finish(); return; }

            var line = BOOT_LINES[li];
            if (line === "@MEM") { memPhase(); return; }
            if (ci < line.length) {
                var burst = Math.min(line.length, ci + 3);
                out += line.slice(ci, burst);
                ci = burst;
                textEl.textContent = out;
                setTimeout(step, 10);
            } else {
                out += "\n";
                textEl.textContent = out;
                li++;
                ci = 0;
                setTimeout(step, 90);
            }
        }
        step();
    }

    function focusInput() {
        var ta = $("user-input");
        if (!ta || !modeOn()) return;
        ta.focus(); /* scrolls the relocated prompt into view at the bottom */
    }

    /* ---------- power on/off + cold-cathode warmup ---------- */

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function powerOn() {
        if (reduceMotion) return;
        var root = document.documentElement;
        root.classList.remove("crt-warmup");
        void root.offsetWidth; /* restart the animation */
        root.classList.add("crt-warmup");
        setTimeout(function () { root.classList.remove("crt-warmup"); }, 2700);
    }

    function powerOff(then) {
        if (reduceMotion) { then(); return; }
        var root = document.documentElement;
        root.classList.add("crt-poweroff");
        setTimeout(function () {
            root.classList.remove("crt-poweroff");
            then();
        }, 700);
    }

    /* ---------- service test card ---------- */

    function testcardOpen() {
        return document.documentElement.classList.contains("crt-testcard-open");
    }
    function openTestcard() {
        document.documentElement.classList.add("crt-testcard-open");
    }
    function closeTestcard() {
        document.documentElement.classList.remove("crt-testcard-open");
    }

    /* ---------- OSD menu ---------- */

    var osd = { open: false, item: 0, b: 5, c: 5 };

    function loadOsd() {
        var saved = storeGet("crt_osd", null);
        if (saved && typeof saved.b === "number" && typeof saved.c === "number") {
            osd.b = Math.min(10, Math.max(0, saved.b));
            osd.c = Math.min(10, Math.max(0, saved.c));
        }
    }

    /* the OSD filter is a CSS rule gated on html.crt-on (injected pre-paint
       by the head script), targeting #main-wrapper + #crt-boot. it is
       ALWAYS applied while the class is on — no per-state juggling, and
       the power-on/off animations on #main can never override it. */
    function applyOsd() {
        var st = document.getElementById("crt-osd-style");
        if (!st) {
            st = document.createElement("style");
            st.id = "crt-osd-style";
            document.head.appendChild(st);
        }
        var brightness = 0.6 + osd.b * 0.08;   /* 0.6 .. 1.4 */
        var contrast = 0.7 + osd.c * 0.06;     /* 0.7 .. 1.3 */
        /* neutral: no filter at all, so it never creates a containing
           block or compositing layer for nothing */
        if (osd.b === 5 && osd.c === 5) { st.textContent = ""; return; }
        st.textContent = "html.crt-on #main-wrapper, html.crt-on #crt-boot { filter: brightness(" +
            brightness.toFixed(2) + ") contrast(" + contrast.toFixed(2) + "); }";
    }

    function renderOsd() {
        var el = $("crt-osd");
        if (!el) return;
        var items = [["BRIGHTNESS", osd.b], ["CONTRAST", osd.c]];
        var html = '<div class="crt-osd-title">LUMARA OSD</div>';
        for (var i = 0; i < items.length; i++) {
            var bar = "";
            for (var j = 0; j < 10; j++) bar += j < items[i][1] ? "\u2588" : "\u2591";
            html += '<div class="crt-osd-item' +
                (i === osd.item ? " crt-osd-selected" : "") + '">'
                + items[i][0] + " [" + bar + "]</div>";
        }
        html += '<div class="crt-osd-help">UP/DOWN SELECT&nbsp;&nbsp;LEFT/RIGHT ADJUST&nbsp;&nbsp;ESC EXIT</div>';
        el.innerHTML = html;
    }

    function openOsd() {
        osd.open = true;
        osd.item = 0;
        renderOsd();
        document.documentElement.classList.add("crt-osd-open");
    }

    function closeOsd() {
        osd.open = false;
        document.documentElement.classList.remove("crt-osd-open");
        storeSet("crt_osd", { b: osd.b, c: osd.c });
    }

    function osdKey(key) {
        var delta = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
        if (key === "ArrowUp") osd.item = 0;
        else if (key === "ArrowDown") osd.item = 1;
        else if (delta) {
            if (osd.item === 0) osd.b = Math.min(10, Math.max(0, osd.b + delta));
            else osd.c = Math.min(10, Math.max(0, osd.c + delta));
            applyOsd();
        } else { closeOsd(); return; }
        renderOsd();
    }

    /* ---------- underscore cursor ---------- */

    /* the textarea's own text and caret are made transparent; an overlay
       mirror with identical typography renders the visible text with the
       blinking underscore INLINE at the caret, so the cursor can never
       desync from typing, arrows, clicks or Alpine clears */
    function installCaret() {
        var ta = $("user-input");
        var wrapper = ta && ta.parentNode;
        if (!ta || !wrapper) return;

        var mirror = document.createElement("div");
        mirror.className = "crt-mirror";
        wrapper.insertBefore(mirror, ta);

        var cursor = document.createElement("span");
        cursor.className = "crt-cursor";
        cursor.textContent = "_";

        var PROPS = ["fontFamily", "fontSize", "fontWeight", "fontStyle",
            "lineHeight", "letterSpacing", "wordSpacing", "textTransform",
            "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
            "borderTopWidth", "borderLeftWidth"];

        var lastValue = null, lastPos = -1, lastFocused = null;

        function sync() {
            if (!modeOn()) {
                mirror.style.display = "none";
                lastValue = null; lastPos = -1; lastFocused = null;
                return;
            }
            mirror.style.display = "block";

            /* geometry + typography: match the textarea box exactly so the
               mirrored text lands pixel-perfect over the (invisible) real */
            var st = window.getComputedStyle(ta);
            for (var i = 0; i < PROPS.length; i++) {
                mirror.style[PROPS[i]] = st[PROPS[i]];
            }
            mirror.style.boxSizing = st.boxSizing;
            mirror.style.left = ta.offsetLeft + "px";
            mirror.style.top = ta.offsetTop + "px";
            mirror.style.width = ta.offsetWidth + "px";
            mirror.style.height = ta.offsetHeight + "px";

            var focused = document.activeElement === ta;
            var pos = focused && ta.selectionStart !== null
                ? ta.selectionStart : ta.value.length;

            /* rebuild content only when something actually changed, so the
               blink animation is not restarted every animation frame */
            if (ta.value !== lastValue || pos !== lastPos || focused !== lastFocused) {
                lastValue = ta.value; lastPos = pos; lastFocused = focused;

                var before = document.createTextNode(ta.value.slice(0, pos));
                var after = document.createTextNode(ta.value.slice(pos));
                if (focused) {
                    mirror.replaceChildren(before, cursor, after);
                } else {
                    mirror.replaceChildren(before, after);
                }
            }
        }

        /* while focused, track with a rAF loop so the underscore can never
           lag behind typing, arrow keys, autocomplete or Alpine clears */
        var looping = false;
        function loop() {
            if (!modeOn() || document.activeElement !== ta) {
                looping = false;
                sync();
                return;
            }
            sync();
            requestAnimationFrame(loop);
        }

        ta.addEventListener("focus", function () {
            if (!looping) {
                looping = true;
                requestAnimationFrame(loop);
            }
        });
        ta.addEventListener("blur", function () { sync(); });
        ["input", "keyup", "click", "paste", "select"].forEach(function (ev) {
            ta.addEventListener(ev, function () { requestAnimationFrame(sync); });
        });

        window.CRT_CURSOR_SYNC = sync;
        sync();
    }

    /* ---------- spinner ticker ---------- */

    /* cycles crt-spin-0..3 so CSS can render the | / - \ bar cursor
       (CSS cannot animate content, so the class does the turning) */
    function startSpinner() {
        var i = 0;
        setInterval(function () {
            var root = document.documentElement;
            root.classList.remove("crt-spin-0", "crt-spin-1",
                "crt-spin-2", "crt-spin-3");
            root.classList.add("crt-spin-" + (i % 4));
            i++;
        }, 120);
    }

    /* ---------- kill smooth scrolling ---------- */

    /* CSS handles scroll-behavior; this catches JS calls that explicitly
       request behavior:"smooth" (the core does it in the search modal).
       While the CRT is on, every smooth scroll becomes instant. */

    /* x-auto-scroll and the ui store are pure-JS lerp pumps: they animate
       scrollTop directly with behavior:"instant", so neither the CSS rule
       nor the scrollIntoView patch touches them. Their shared knob is
       window.AUTOSCROLL_DAMP (fraction of the gap closed per hop, read
       fresh every hop) and DAMP >= 1 means teleport. Force it while the
       CRT is on, restore the original value on crt off. */
    var savedDamp = null;

    function applyDamp(on) {
        if (on) {
            if (typeof window.AUTOSCROLL_DAMP === "number" &&
                window.AUTOSCROLL_DAMP < 1) {
                savedDamp = window.AUTOSCROLL_DAMP;
            }
            window.AUTOSCROLL_DAMP = 1;
        } else if (window.AUTOSCROLL_DAMP === 1) {
            window.AUTOSCROLL_DAMP = savedDamp === null ? 0.1 : savedDamp;
            savedDamp = null;
        }
    }

    function hookScroll() {
        var orig = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (options) {
            if (modeOn() && options && typeof options === "object" &&
                options.behavior === "smooth") {
                options = Object.assign({}, options, { behavior: "auto" });
            }
            return orig.call(this, options);
        };
    }

    /* ---------- wiring ---------- */

    function waitForAlpine(cb) {
        if (window.Alpine && Alpine.store("chat") && Alpine.store("ui")) { cb(); return; }
        setTimeout(function () { waitForAlpine(cb); }, 50);
    }

    function hookSend() {
        var chat = Alpine.store("chat");
        var original = chat.send.bind(chat);

        chat.send = function (text) {
            var cmd = parseCommand(text);
            if (cmd !== null) {
                chat.user_input = "";
                runCommand(cmd);
                return Promise.resolve();
            }
            // a real message scrolls the terminal: sweep the local output
            clearResponses();
            return original(text);
        };
    }

    function hookKeys() {
        document.addEventListener("keydown", function (event) {
            /* OSD owns the keys while it is open */
            if (osd.open) {
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
                     "Escape", "Enter", "q", "Q"].indexOf(event.key) !== -1) {
                    event.preventDefault();
                    osdKey(event.key);
                }
                return;
            }

            /* test card: ESC or Q dismisses */
            if (testcardOpen()) {
                if (event.key === "Escape" || event.key === "q" || event.key === "Q") {
                    event.preventDefault();
                    closeTestcard();
                }
                return;
            }

            if (event.key === "F1") {
                event.preventDefault();
                runCommand("settings");
                return;
            }
            if (event.key === "F2") {
                event.preventDefault();
                runCommand("help");
                return;
            }

            /* terminal muscle memory: ^L clear, ^C stop (selection copy wins) */
            if (modeOn() && (event.ctrlKey || event.metaKey)) {
                var k = event.key.toLowerCase();
                if (k === "l") {
                    event.preventDefault();
                    runCommand("clear");
                } else if (k === "c") {
                    var sel = window.getSelection();
                    if (sel && !sel.isCollapsed) return; /* let copy happen */
                    event.preventDefault();
                    runCommand("stop");
                }
            }
        });

        /* keyboard variety at the prompt + wake the whine context.
           the clicks are CRT furniture: silent when the mode is off or
           sounds are disabled. */
        document.addEventListener("keydown", function (event) {
            if (cfg.whine) getCtx();
            if (!(cfg.sounds && modeOn())) return;
            if (event.target && event.target.id === "user-input") {
                if (event.key === "Enter") thunk();
                else if (event.key === "Backspace") tick();
                else if (event.key.length === 1) clicky();
            }
        });

        // the send button is hidden, but core only sends on Enter for
        // desktop; make mobile Enter send too (through the wrapped send,
        // so terminal commands work there as well)
        var ta = $("user-input");
        if (ta) {
            ta.addEventListener("keydown", function (event) {
                if (event.key === "Enter" && !event.shiftKey && modeOn() &&
                    Alpine.store("ui").isMobile) {
                    var chat = Alpine.store("chat");
                    if (!chat.user_input) return;
                    event.preventDefault();
                    chat.send(chat.user_input);
                }
            });
        }
    }

    function watchChatSwitch() {
        setInterval(function () {
            var current = Alpine.store("chat").selectedChat;
            if (current !== lastChat) {
                lastChat = current;
                clearResponses();
                if (clearCount) { clearCount = 0; applyClear(); }
            }
            // keep the underscore in sync even when Alpine clears the
            // input programmatically (value changes fire no input event)
            if (window.CRT_CURSOR_SYNC) window.CRT_CURSOR_SYNC();
        }, 700);
    }

    function init() {
        updateStatusBar();
        hookSend();
        hookKeys();
        hookAudio();
        watchClear();
        watchFloppy();
        watchChatSwitch();
        installCaret();
        startSpinner();
        hookScroll();
        loadOsd();
        applyOsd();
        if (modeOn()) {
            relocateInput();
            runBoot();
            powerOn();
            startWhine();
            /* no boot (off / already run this session): focus right away;
               when boot does run, its finish() focuses after the POST */
            focusInput();
        }
    }

    /* config is inlined pre-paint by the head script; fetch as a fallback */
    if (window.CRT_CONFIG) {
        cfg = window.CRT_CONFIG;
        waitForAlpine(init);
    } else {
        fetch("/api/ext/crt_terminal/config")
            .then(function (r) { return r.json(); })
            .then(function (data) {
                cfg = data.data || data;
                window.CRT_CONFIG = cfg;
                waitForAlpine(init);
            })
            .catch(function (e) {
                console.warn("crt_terminal: no config, staying flat-panel:", e);
            });
    }
})();
