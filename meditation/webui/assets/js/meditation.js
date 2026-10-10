/* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
   guided meditation overlay engine: a breathing circle at center with
   particles that flow outward on the inhale and drift back on the
   exhale, binaural beats drifting alpha -> theta with session elapsed
   time, crossfading ambient sound loops, and the kokoro neural guide
   voice (browser speechSynthesis fallback).

const MD_PREF_VOICES = ['libritts'];
/* -- the worker script is fetched through the HTTP cache even on hard
   refresh: bump v= every time kokoro-worker.js changes -- */
/* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
   the worker script is HTTP-cached even on hard refresh: bump v=
   EVERY time kokoro-worker.js changes
  (threaded wasm, ellipsis splitter, gen/render/render_stream/cancel) */
const MD_KOKORO_WORKER = '/ext-assets/meditation/kokoro/kokoro-worker.js?v=6';
const MD_KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const MD_KOKORO_VOICES = [
    'af_heart', 'af_alloy', 'af_aoede', 'af_bella', 'af_jessica', 'af_kore',
    'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
    'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael',
    'am_onyx', 'am_puck', 'am_santa',
    'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily',
    'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'
];
const MD_KOKORO_DEFAULT = 'af_nicole';
/* phones get a lighter render: capped DPR, tamed glow, fewer particles */
const MD_MOBILE = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth < 760;

const MD_clamp = (n, a, b) => Math.min(Math.max(n, a), b);
const MD_lerp = (a, b, t) => a + (b - a) * t;
const MD_smooth = (t) => t * t * (3 - 2 * t);
const MD_layerAlpha = (L, now) => {
    const f = MD_clamp((now - L.start) / L.dur, 0, 1);
    const e = f * f * (3 - 2 * f);
    return L.from + (L.to - L.from) * e;
};
const MD_centerClean = (t) => String(t || '')
    .replace(/```[a-z]*|```/gi, ' ')
    .replace(/[*_~`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const MD_mixColor = (a, b, t) => {
    const ex = (s) => { s = String(s); return s.length === 4 ? '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3] : s; };
    const pa = parseInt(ex(a).slice(1), 16), pb = parseInt(ex(b).slice(1), 16);
    if (isNaN(pa) || isNaN(pb)) return b;
    const r = Math.round(MD_lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    const g = Math.round(MD_lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    const bl = Math.round(MD_lerp(pa & 255, pb & 255, t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
};
const MD_rgba = (col, a) => {
    if (typeof col === 'string' && col.charAt(0) === '#') {
        let hex = col.slice(1);
        if (hex.length === 3) hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        const n = parseInt(hex.slice(0, 6), 16);
        if (!isNaN(n)) return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + a.toFixed(3) + ')';
    }
    return col;
};
/* breath phase label exactly as requested: "4 in", "hold for 7",
   "out for 8" - seconds remaining, rounded up */
const MD_phaseLabel = (name, rem) => {
    const s = Math.max(1, Math.ceil(rem));
    if (name === 'in') return s + ' in';
    if (name === 'out') return 'out for ' + s;
    return 'hold for ' + s;
};

document.addEventListener('alpine:init', () => {
    Alpine.data('bhMedita', () => ({
        active: false,
        ending: false,
        endSecs: 30,
        maxOpacity: 0.95,
        subject: 'Rosie',
        intensity: 0,
        intSent: false,
        pattern: { in: 4, hold: 7, out: 8, hold_out: 0 },
        patternKey: '',
        breathT0: 0,
        phase: 'in',
        phaseRem: 4,
        scale: 0,
        scene: {
            color_core: '#9fd8ff', color_glow: '#7b9cff', color_bg: '#0d1530',
            color_text: '#ffffff', particles: 1, vignette: -1, bloom: -1,
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               scene modes, breathing-center shapes and optional layers */
            mode: 'calm', shape: 'circle', dust: 0, horizon: 0
        },
        sceneT: null,
        envs: {},
        prevMode: 'calm', envMix: 1,
        prevShape: 'circle', shapeMix: 1,

        _dust: [],
        bin: { on: false, auto: true, mode: 'binaural', base: 220, beat: 10, vol: 28 },
        amb: { on: false, track: '', vol: 35 },
        ambEnabled: true,
        tracks: [],
        ambPlaylist: [],
        ambIdx: 0,
        events: [],
        speakLoop: null,
        binOk: true,
        /* breath_sounds from module settings: the synthesized inhale sigh */
        breathSnd: true,
        noiseBuf: null,
        muted: false,
        endMsg: '',
        startedAt: 0,
        speakQueue: [],
        speechRenders: {},
        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
           v5 politeness: genActive = a live line
           is still SYNTHESIZING. background renders serialize (bgRid)
           and never run while genActive - CPU theft from live speech
           was the regression that made the old code feel faster */
        genActive: false,
        bgQueue: [],
        bgRid: '',
        lastPollAt: 0,
        speakingNow: false,
        speakGen: 0,
        kokoroSrcs: [],
        kokoroInitWaiters: [],
        kokoroSeq: 0,
        kokoroState: 'off',
        kokoroMsg: '',
        kokoroEngine: '',
        ttsEngine: 'kokoro',
        defaultVoice: 'af_nicole',
        lastPhase: '',
        phaseFrac: 0,
        phaseDur: 4,

        init() {
            mdComp = this;
            this.canvas = this.$refs.cv;
            this.off = document.createElement('canvas');
            this.octx = this.off.getContext('2d');
            this.poll();
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               Rosie's latency fix: warm the neural
               voice at PAGE LOAD, not at session start, so the first guide
               line never waits ~25s on model init inside the worker */
            const mdBootWarm = () => {
                try {
                    if (this.enginePref() === 'kokoro' && !this.muted && this.kokoroState === 'off') this.kokoroReady().catch(() => {});
                } catch (e) {}
            };
            setTimeout(() => {
                if (window.requestIdleCallback) requestIdleCallback(mdBootWarm); else mdBootWarm();
            }, 4000);
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               4x poll cadence while a session lives (throttled to 1/sec
               inside poll() when idle): the old flat 1s tick added up to a
               full second of dead air to every line arrival */
            this.pollT = setInterval(() => this.poll(), 250);
            this.onRefresh = () => this.poll();
            window.addEventListener('md-refresh', this.onRefresh);
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
               a refresh mid-line loses the speaking=false POST (fetches die
               on unload) and the server flag sticks true, hanging every
               later speak call: announce idle the moment a fresh page boots */
            fetch('/api/ext/meditation/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ speaking: false })
            }).catch(() => {});
            /* browsers only allow audio after a gesture: retry any
               pending playback the first time she touches the page */
            this.onGesture = () => {
                const c = this.ensureAudio();
                if (c && c.state === 'suspended') c.resume().catch(() => {});
                this.ambKick();
            };
            window.addEventListener('pointerdown', this.onGesture);
            /* escape gently fades the meditation out */
            this.onKey = (e) => this.meditaKeys(e);
            window.addEventListener('keydown', this.onKey);
            /* narration from the live chat stream onto the overlay */
            try { this.stopStreamWatch = Alpine.effect(() => this.syncCenterText()); } catch (e) {}
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               auto-end: watch the webui stream store; when the AI's turn
               completes (state returns to idle) mid-session it stopped
               guiding - tell the module to fade everything out gently */
            this._prevStream = 'idle';
            this._endSent = false;
            this._idleTimer = null;
            try {
                this.stopIdleWatch = Alpine.effect(() => {
                    const s = Alpine.store('stream');
                    const st = (s && s.state) || 'idle';
                    const prev = this._prevStream;
                    this._prevStream = st;
                    /* every stream phase change is a hint that tool events
                       just landed server-side: fetch now instead of waiting
                       out the next 250ms tick */
                    if (st !== prev && (this.active || this.speakingNow || this.speakQueue.length)) this.poll();
                    if (st !== 'idle') {
                        this._endSent = false;
                        if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null; }
                        return;
                    }
                    if (prev === 'idle' || this._endSent) return;
                    if (!this.active || this.ending) return;
                    /* small grace so a brief state blip can't cut a turn */
                    this._idleTimer = setTimeout(() => {
                        this._idleTimer = null;
                        if (!this.active || this.ending || this._endSent) return;
                        if (this._prevStream !== 'idle') return;
                        this._endSent = true;
                        fetch('/api/ext/meditation/control', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ending: true, secs: 30, reason: 'AI finished streaming' })
                        }).catch(() => { this._endSent = false; });
                        this.poll();
                    }, 3000);
                });
            } catch (e) {}
            this.parts = [];
            this.ripples = [];
            this.centerLayers = [];
            this.centerText = '';
            this.centerGate = 0;
            const step = () => { this.draw(); this.raf = requestAnimationFrame(step); };
            step();
        },
        destroy() {
            clearInterval(this.pollT);
            if (this.speakT) clearInterval(this.speakT);
            cancelAnimationFrame(this.raf);
            window.removeEventListener('md-refresh', this.onRefresh);
            window.removeEventListener('pointerdown', this.onGesture);
            window.removeEventListener('keydown', this.onKey);
            if (this.stopStreamWatch) { try { this.stopStreamWatch(); } catch (e) {} }
            if (this._idleTimer) clearTimeout(this._idleTimer);
            if (this.stopIdleWatch) { try { this.stopIdleWatch(); } catch (e) {} }
            this.stopBinaural();
            this.ambStopAll();
            if (this.kokoroTts) { try { this.kokoroTts.terminate(); } catch (e) {} }
        },

        /* ---------------- polling + state ---------------- */
        poll() {
            /* idle overlay keeps the old 1/sec rhythm; an active session
               (or anything mid-playback) rides every 250ms tick */
            const now = Date.now();
            if (!this.active && !this.speakingNow && !this.speakQueue.length && now - this.lastPollAt < 1000) return;
            this.lastPollAt = now;
            fetch('/api/ext/meditation/state')
                .then((r) => r.json())
                .then((j) => { this.applyState(((j && j.data) || {})); this.syncCenterText(); })
                .catch(() => {});
        },
        applyState(d) {
            const wasActive = this.active;
            this.maxOpacity = d.max_opacity || 0.95;
            this.subject = d.subject || 'Rosie';
            this.binOk = d.binaurals_enabled !== false;
            this.breathSnd = d.breath_sounds !== false;
            this.ttsEngine = d.tts_engine || 'kokoro';
            this.defaultVoice = d.default_voice || 'af_nicole';
            this.active = !!d.active;
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               warm the synth the moment a session goes live: worker spawn
               + model load (several seconds!) hides under the session's
               opening moments instead of delaying the first spoken line */
            if (this.active && !this.kokoroTts && this.enginePref() === 'kokoro') {
                try { const c = this.mdActx(); if (c && c.state === 'suspended') c.resume().catch(() => {}); } catch (e) {}
                this.kokoroReady();
            }
            this.ending = !!d.ending && this.active;
            this.endSecs = d.end_secs || 30;
            if (d.pattern) {
                const key = [d.pattern.in, d.pattern.hold, d.pattern.out, d.pattern.hold_out].join('/');
                if (key !== this.patternKey) {
                    /* pattern changed: restart the breath clock so the
                       circle re-syncs cleanly on the next breath */
                    this.pattern = d.pattern;
                    this.patternKey = key;
                    this.breathT0 = Date.now() / 1000;
                }
            }
            if (d.scene) this.sceneT = d.scene;
            if (d.binaural) this.bin = d.binaural;
            if (!this.active || this.muted || !this.binOk || !this.bin.on) this.stopBinaural();
            else this.startBinaural();
            this.ambEnabled = d.ambient_enabled !== false;
            const newSpeak = d.speak || null;
            const speakChanged = JSON.stringify(newSpeak) !== JSON.stringify(this.speakLoop);
            this.speakLoop = newSpeak;
            if (speakChanged) this.restartSpeakLoop();
            /* ambient tracks + selection */
            const tracks = d.tracks || [];
            const amb = d.ambient || { on: false, track: '', vol: 35 };
            const ambKey = tracks.join('|') + '#' + (this.ambEnabled ? 1 : 0) + '#' + amb.on + '#' + amb.track;
            if (ambKey !== this._ambKey) {
                this._ambKey = ambKey;
                this.tracks = tracks;
                this.amb = amb;
                this.buildPlaylist(amb);
            } else {
                this.amb = Object.assign({}, amb, { track: this.amb.track });
                this.ambVolRamp();
            }
            if (this.active && !wasActive) {
                this.breathT0 = Date.now() / 1000;
                this.startedAt = Date.now() / 1000;
                this.intSent = false;
                this.endMsg = '';
                if (this.enginePref() === 'kokoro') this.kokoroReady().catch(() => {});
            }
            if (!this.active) {
                this.ambStopAll();
                if (wasActive) this.speakStopAll();
            }
            for (const ev of (d.events || [])) {
                if (ev.t === 'speak') this.speakNow(ev);
                else if (ev.t === 'speak_stop') this.speakStopAll();
                else if (ev.t === 'end_words') this.bhCenterCommit(ev.text || '');
            }
            document.body.setAttribute('data-medita', this.active ? 'on' : 'off');
            /* ending fade-back: reveal the hidden UI slowly */
            if (this.active && this.ending) {
                document.body.setAttribute('data-medita-ending', 'on');
                document.documentElement.style.setProperty('--md-end-dur', Math.max(2, this.endSecs) + 's');
            } else {
                document.body.removeAttribute('data-medita-ending');
            }
        },
        opacity() {
            if (!this.active) return 0;
            return this.maxOpacity * this.intensity;
        },

        /* ---------------- breath clock ---------------- */
        breathTick(nowSec) {
            const p = this.pattern;
            const phases = [];
            if (p.in > 0) phases.push(['in', p.in]);
            if (p.hold > 0) phases.push(['hold', p.hold]);
            if (p.out > 0) phases.push(['out', p.out]);
            if (p.hold_out > 0) phases.push(['hold_out', p.hold_out]);
            if (!phases.length) { this.phase = 'in'; this.phaseRem = 4; this.scale = 0; return phases; }
            const total = phases.reduce((s, x) => s + x[1], 0);
            let t = (nowSec - this.breathT0) % total;
            if (t < 0) t += total;
            let name = 'in', dur = 4, local = 0;
            for (const ph of phases) {
                if (t < ph[1]) { name = ph[0]; dur = ph[1]; local = t; break; }
                t -= ph[1];
            }
            const f = local / dur;
            let sc = this.scale;
            if (name === 'in') sc = MD_smooth(f);
            else if (name === 'hold') sc = 1;
            else if (name === 'out') sc = 1 - MD_smooth(f);
            else sc = 0;
            this.phase = name;
            this.phaseRem = dur - local;
            this.phaseDur = dur;
            this.phaseFrac = f;
            this.scale = sc;
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
               fraction through the whole breath cycle - the infinity
               shape rides this so its tracer loops exactly once per
               breath (inhale = right lobe, exhale = left lobe) */
            this._breathCyc = (nowSec - this.breathT0) / total;
            return phases;
        },

        /* ---------------- particles ---------------- */
        buildParticles(w, h) {
            const want = Math.round((MD_MOBILE ? 70 : 150) * MD_clamp(this.sceneT ? this.sceneT.particles : 1, 0.01, 2));
            const maxR = Math.hypot(w, h) * 0.56;
            while (this.parts.length > want) this.parts.pop();
            while (this.parts.length < want) {
                this.parts.push({
                    a: Math.random() * Math.PI * 2,
                    rB: 0.18 + Math.pow(Math.random(), 0.7) * 1.0,
                    drift: (Math.random() - 0.5) * 0.05,
                    par: 0.35 + Math.random() * 0.9,
                    sz: 0.6 + Math.random() * 2.2,
                    tw: Math.random() * Math.PI * 2,
                    twS: 0.3 + Math.random() * 1.1,
                    hue: Math.random()
                });
            }
            this.partsMaxR = maxR;
        },

        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
           environment layers per scene mode: starfield, petals, deep
           sea, snowfall, rain, glitterfall, runes, nebula
           and sky paint behind the breathing field;
           calm and fireflies have no environment (fireflies instead
           re-style the main particle field). each mode keeps its own
           lazily-built item state and crossfades on switch. */
        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
           pre-rendered sprites: fluffy multi-lobe clouds and a glassy
           raindrop bead, drawn once offscreen for cheap reuse */
        cloudSprites() {
            if (this._cloudSpr) return this._cloudSpr;
            const mkp = seed => {
                const c = document.createElement('canvas');
                c.width = 256; c.height = 256;
                const g = c.getContext('2d');
                let s = seed;
                const rnd = () => { s = (s * 16807) % 2147483647; return (s % 1000) / 1000; };
                for (let i = 0; i < 8; i++) {
                    const bx = 128 + (rnd() - 0.5) * 150;
                    const by = 128 + (rnd() - 0.5) * 96;
                    const br = 34 + rnd() * 54;
                    const rg = g.createRadialGradient(bx, by, 0, bx, by, br);
                    rg.addColorStop(0, 'rgba(255,255,255,0.5)');
                    rg.addColorStop(0.55, 'rgba(255,255,255,0.24)');
                    rg.addColorStop(1, 'rgba(255,255,255,0)');
                    g.fillStyle = rg;
                    g.beginPath();
                    g.arc(bx, by, br, 0, Math.PI * 2);
                    g.fill();
                }
                return c;
            };
            this._cloudSpr = [mkp(12345), mkp(6789), mkp(4242)];
            return this._cloudSpr;
        },
        dropSprite() {
            if (this._dropSpr) return this._dropSpr;
            const c = document.createElement('canvas');
            c.width = 64; c.height = 64;
            const g = c.getContext('2d');
            const rg = g.createRadialGradient(26, 26, 2, 32, 32, 30);
            rg.addColorStop(0, 'rgba(255,255,255,0.28)');
            rg.addColorStop(0.62, 'rgba(215,228,226,0.10)');
            rg.addColorStop(0.88, 'rgba(25,45,50,0.40)');
            rg.addColorStop(1, 'rgba(25,45,50,0)');
            g.fillStyle = rg;
            g.beginPath();
            g.arc(32, 32, 30, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.5)';
            g.beginPath();
            g.ellipse(32, 44, 12, 6.5, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.7)';
            g.beginPath();
            g.ellipse(23, 20, 5, 3.4, -0.6, 0, Math.PI * 2);
            g.fill();
            this._dropSpr = c;
            return c;
        },
        envData(mode, w, h) {
            if (!this.envs[mode]) this.envs[mode] = { w: 0, h: 0, items: [], shots: [], stars: [] };
            const e = this.envs[mode];
            if (e.w !== w || e.h !== h) {
                e.w = w; e.h = h; e.items = []; e.stars = [];
                const mk = {
                    starfield: () => ({ x: Math.random() * w, y: Math.random() * h, sz: 0.4 + Math.pow(Math.random(), 1.7) * 2.6, tw: Math.random() * 6.28, twS: 0.25 + Math.random() * 0.9, big: Math.random() < 0.07 ? 1 : 0, col: Math.floor(Math.random() * 3) }),
                    petals: () => ({ x: Math.random() * w, y: Math.random() * h, vy: 12 + Math.random() * 22, wob: Math.random() * 6.28, wobS: 0.3 + Math.random() * 0.7, rot: Math.random() * 6.28, rotS: (Math.random() - 0.5) * 1.2, sz: 4 + Math.random() * 7, hue: Math.random() }),
                    deepsea: () => ({ x: Math.random() * w, y: Math.random() * h, vy: 10 + Math.random() * 26, wob: Math.random() * 6.28, r: 1.5 + Math.random() * 5 }),
                    snowfall: () => ({ x: Math.random() * w, y: Math.random() * h, vy: 6 + Math.random() * 14, wob: Math.random() * 6.28, wobS: 0.2 + Math.random() * 0.5, sz: 1 + Math.random() * 2.4 }),
                    rainfall: () => ({ x: Math.random() * w, y: Math.random() * h, vy: 600 + Math.random() * 380, len: 16 + Math.random() * 22, g: 0.5 + Math.random() * 0.5 }),
                    rain: () => (Math.random() < 0.08
                        ? { bl: 1, x: Math.random() * w, y: h * (0.15 + Math.random() * 0.8), sz: 40 + Math.random() * 130 }
                        : { x: Math.random() * w, y: Math.random() * h, r: 1.2 + Math.pow(Math.random(), 2.6) * 16, sl: Math.random() < 0.14 ? 1 : 0, vy: 6 + Math.random() * 22 }),
                    glitterfall: () => ({ x: Math.random() * w, y: Math.random() * h, vy: 10 + Math.random() * 22, wob: Math.random() * 6.28, wobS: 0.2 + Math.random() * 0.6, sz: 1.2 + Math.random() * 2.4, tw: Math.random() * 6.28, twS: 1.5 + Math.random() * 3, spin: Math.random() * 6.28, hue: Math.random() }),
                    runes: () => ({ ring: Math.floor(Math.random() * 3), ang: Math.random() * 6.28, tw: Math.random() * 6.28, g: Math.floor(Math.random() * 14), sz: 13 + Math.random() * 10 }),
                    nebula: () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.min(w, h) * (0.16 + Math.random() * 0.32), vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 5, col: Math.floor(Math.random() * 4), a: 0.10 + Math.random() * 0.09 }),
                    sky: () => ({ x: (Math.random() - 0.5) * 2.6, y: (Math.random() - 0.35) * 2.1, z: 0.1 + Math.random() * 1.5, sz: 0.09 + Math.random() * 0.16, sp: Math.floor(Math.random() * 3), streak: Math.random() < 0.18 ? 1 : 0 })
                };
                const counts = { starfield: MD_MOBILE ? 130 : 240, petals: MD_MOBILE ? 20 : 40, deepsea: MD_MOBILE ? 18 : 34, snowfall: MD_MOBILE ? 60 : 120, rain: MD_MOBILE ? 150 : 260, rainfall: MD_MOBILE ? 90 : 180, glitterfall: MD_MOBILE ? 160 : 320, runes: MD_MOBILE ? 9 : 16, nebula: MD_MOBILE ? 6 : 10, sky: MD_MOBILE ? 18 : 34 };
                if (mk[mode]) {
                    for (let i = 0; i < counts[mode]; i++) e.items.push(mk[mode]());
                }
                /* citylights environment removed 2026-10-10 at Rosie's request */
                if (mode === 'nebula') {
                    /* fixed cosmic palette: vivid magenta, cyan and
                       violet clouds that ignore the scene colors, plus
                       a dense twinkling starfield underneath */
                    const sn = MD_MOBILE ? 80 : 150;
                    for (let i = 0; i < sn; i++)
                        e.stars.push({ x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.3, tw: Math.random() * 6.28, twS: 0.4 + Math.random() * 1.8 });
                }
            }
            return e;
        },
        drawEnv(mode, mxa, w, h, t, dt, dp) {
            if (mxa <= 0.01 || dp <= 0.02) return;
            const o = this.octx;
            const a = mxa * dp;
            if (mode === 'starfield') {
                const e = this.envData('starfield', w, h);
                o.save();
                o.globalCompositeOperation = 'lighter';
                /* faint milky-way band slanting across the sky */
                o.save();
                o.translate(w / 2, h / 2);
                o.rotate(-0.55);
                const mw = o.createLinearGradient(0, -h * 0.17, 0, h * 0.17);
                mw.addColorStop(0, MD_rgba(this.scene.color_glow, 0));
                mw.addColorStop(0.5, MD_rgba(this.scene.color_text, a * 0.05));
                mw.addColorStop(1, MD_rgba(this.scene.color_glow, 0));
                o.fillStyle = mw;
                o.fillRect(-w, -h * 0.17, w * 2, h * 0.34);
                o.restore();
                for (const s of e.items) {
                    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * s.twS + s.tw));
                    const scol = s.col === 1 ? this.scene.color_glow : s.col === 2 ? '#ffffff' : this.scene.color_text;
                    if (s.big) {
                        /* bright star: halo plus a cross sparkle */
                        o.shadowColor = scol;
                        o.shadowBlur = MD_MOBILE ? 8 : 14;
                        o.strokeStyle = MD_rgba(scol, a * 0.45 * tw);
                        o.lineWidth = 1;
                        const ray = s.sz * 4.5 * (0.7 + 0.5 * tw);
                        o.beginPath();
                        o.moveTo(s.x - ray, s.y);
                        o.lineTo(s.x + ray, s.y);
                        o.moveTo(s.x, s.y - ray);
                        o.lineTo(s.x, s.y + ray);
                        o.stroke();
                        o.shadowBlur = 0;
                    }
                    o.fillStyle = MD_rgba(scol, a * (s.big ? 0.95 : 0.55) * tw * (0.75 + 0.25 * this.scale));
                    o.beginPath();
                    o.arc(s.x, s.y, s.big ? s.sz * 1.4 : s.sz, 0, Math.PI * 2);
                    o.fill();
                }
                for (let i = e.shots.length - 1; i >= 0; i--) {
                    const sh = e.shots[i];
                    const f = (performance.now() - sh.start) / 1400;
                    if (f >= 1) { e.shots.splice(i, 1); continue; }
                    const x = sh.x + sh.vx * f, y = sh.y + sh.vy * f;
                    const g = o.createLinearGradient(x, y, x - sh.vx * 0.32, y - sh.vy * 0.32);
                    g.addColorStop(0, MD_rgba('#ffffff', a * (1 - f)));
                    g.addColorStop(0.4, MD_rgba(this.scene.color_glow, a * 0.55 * (1 - f)));
                    g.addColorStop(1, MD_rgba(this.scene.color_glow, 0));
                    o.strokeStyle = g;
                    o.lineWidth = MD_MOBILE ? 2.5 : 3.5;
                    o.shadowColor = this.scene.color_glow;
                    o.shadowBlur = 10;
                    o.beginPath();
                    o.moveTo(x, y);
                    o.lineTo(x - sh.vx * 0.32, y - sh.vy * 0.32);
                    o.stroke();
                    o.shadowBlur = 0;
                    o.fillStyle = MD_rgba('#ffffff', a * 0.95 * (1 - f));
                    o.beginPath();
                    o.arc(x, y, 2.4, 0, Math.PI * 2);
                    o.fill();
                }
                o.restore();
            } else if (mode === 'petals') {
                const e = this.envData('petals', w, h);
                const flow = (this.scale - 0.5) * 2;
                o.save();
                for (const p of e.items) {
                    p.y += p.vy * dt * (1 - 0.45 * Math.max(flow, 0));
                    p.x += Math.sin(t * p.wobS + p.wob) * 14 * dt + flow * 10 * dt;
                    p.rot += p.rotS * dt;
                    if (p.y > h + 12) { p.y = -12; p.x = Math.random() * w; }
                    if (p.x > w + 12) p.x = -12;
                    if (p.x < -12) p.x = w + 12;
                    o.save();
                    o.translate(p.x, p.y);
                    o.rotate(p.rot);
                    o.fillStyle = MD_rgba(p.hue < 0.5 ? this.scene.color_glow : this.scene.color_core, a * 0.45);
                    /* teardrop petal: pointed at the stem, round at the tip */
                    o.beginPath();
                    o.moveTo(-p.sz, 0);
                    o.bezierCurveTo(-p.sz * 0.3, -p.sz * 0.85, p.sz * 0.7, -p.sz * 0.7, p.sz, 0);
                    o.bezierCurveTo(p.sz * 0.7, p.sz * 0.7, -p.sz * 0.3, p.sz * 0.85, -p.sz, 0);
                    o.closePath();
                    o.fill();
                    o.restore();
                }
                o.restore();
            } else if (mode === 'deepsea') {
                const e = this.envData('deepsea', w, h);
                o.save();
                /* soft caustic light shafts swaying from above */
                o.globalCompositeOperation = 'lighter';
                for (let i = 0; i < 3; i++) {
                    const sx = w * (0.22 + i * 0.28) + Math.sin(t * 0.07 + i * 2.1) * w * 0.06;
                    const g = o.createLinearGradient(sx, 0, sx + w * 0.05, h);
                    g.addColorStop(0, MD_rgba(this.scene.color_text, a * 0.05));
                    g.addColorStop(1, MD_rgba(this.scene.color_text, 0));
                    o.fillStyle = g;
                    o.beginPath();
                    o.moveTo(sx - w * 0.03, 0);
                    o.lineTo(sx + w * 0.03, 0);
                    o.lineTo(sx + w * 0.09, h);
                    o.lineTo(sx + w * 0.01, h);
                    o.closePath();
                    o.fill();
                }
                for (const b of e.items) {
                    b.y -= b.vy * dt * (1 + 0.4 * this.scale);
                    b.x += Math.sin(t * 0.8 + b.wob) * 8 * dt;
                    if (b.y < -8) { b.y = h + 8; b.x = Math.random() * w; }
                    o.strokeStyle = MD_rgba(this.scene.color_text, a * 0.3);
                    o.lineWidth = 1;
                    o.beginPath();
                    o.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                    o.stroke();
                    o.fillStyle = MD_rgba('#ffffff', a * 0.25);
                    o.beginPath();
                    o.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.5, b.r * 0.22), 0, Math.PI * 2);
                    o.fill();
                }
                o.restore();
            } else if (mode === 'snowfall') {
                const e = this.envData('snowfall', w, h);
                o.save();
                for (const s of e.items) {
                    s.y += s.vy * dt;
                    s.x += Math.sin(t * s.wobS + s.wob) * 10 * dt;
                    if (s.y > h + 6) { s.y = -6; s.x = Math.random() * w; }
                    o.fillStyle = MD_rgba(this.scene.color_text, a * 0.4);
                    o.beginPath();
                    o.arc(s.x, s.y, s.sz, 0, Math.PI * 2);
                    o.fill();
                }
                o.restore();
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
               six new environments: raindrops on glass, glitter, an orbiting
               magic circle of runes, nebula clouds */
            } else if (mode === 'rain') {
                const e = this.envData('rain', w, h);
                const DR = this.dropSprite();
                o.save();
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
                   blurred view through wet glass, tinted by the current
                   palette: bright core color up top, glow in the middle,
                   dark bg below, a few out-of-focus silhouettes */
                const bg = o.createLinearGradient(0, 0, w * 0.25, h);
                bg.addColorStop(0, MD_rgba(this.scene.color_core, a * 0.92));
                bg.addColorStop(0.5, MD_rgba(this.scene.color_glow, a * 0.92));
                bg.addColorStop(1, MD_rgba(this.scene.color_bg, a * 0.92));
                o.fillStyle = bg;
                o.fillRect(0, 0, w, h);
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
                   the rain pattern falls behind the glass, softened by a
                   translucent veil so it reads as blurred through it */
                const re = this.envData('rainfall', w, h);
                const slant = 0.5 + 0.15 * this.scale;
                for (const s of re.items) {
                    s.y += s.vy * dt;
                    s.x -= slant * s.vy * dt;
                    if (s.y > h + s.len) { s.y = -s.len; s.x = Math.random() * (w + 120); }
                    if (s.x < -60) s.x += w + 120;
                    if (s.x > w + 60) s.x -= w + 120;
                    const sx = s.len * slant;
                    o.strokeStyle = MD_rgba(this.scene.color_text, a * 0.32 * s.g);
                    o.lineWidth = 2;
                    o.beginPath();
                    o.moveTo(s.x + sx, s.y - s.len);
                    o.lineTo(s.x, s.y);
                    o.stroke();
                }
                const veil = o.createLinearGradient(0, 0, w * 0.25, h);
                veil.addColorStop(0, MD_rgba(this.scene.color_core, a * 0.34));
                veil.addColorStop(0.5, MD_rgba(this.scene.color_glow, a * 0.34));
                veil.addColorStop(1, MD_rgba(this.scene.color_bg, a * 0.34));
                o.fillStyle = veil;
                o.fillRect(0, 0, w, h);
                for (const s of e.items) {
                    if (!s.bl) continue;
                    const g = o.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.sz);
                    g.addColorStop(0, MD_rgba(this.scene.color_bg, a * 0.5));
                    g.addColorStop(1, MD_rgba(this.scene.color_bg, 0));
                    o.fillStyle = g;
                    o.beginPath();
                    o.arc(s.x, s.y, s.sz, 0, Math.PI * 2);
                    o.fill();
                }
                /* droplets sit on the glass; a few slowly slide down,
                   stretching as they go, speed easing on the exhale */
                for (const s of e.items) {
                    if (s.bl) continue;
                    if (s.sl) {
                        s.y += s.vy * dt * (0.4 + 0.6 * this.scale);
                        if (s.y > h + s.r) { s.y = -s.r * 2; s.x = Math.random() * w; }
                    }
                    const rh = s.sl ? s.r * 1.25 : s.r;
                    o.globalAlpha = a;
                    o.drawImage(DR, s.x - s.r, s.y - rh, s.r * 2, rh * 2);
                }
                o.globalAlpha = 1;
                o.restore();
            } else if (mode === 'glitterfall') {
                const e = this.envData('glitterfall', w, h);
                o.save();
                o.globalCompositeOperation = 'lighter';
                for (const s of e.items) {
                    const flow = (this.scale - 0.5) * 2;
                    s.y += s.vy * dt * (1 - 0.4 * Math.max(flow, 0));
                    s.x += Math.sin(t * s.wobS + s.wob) * 12 * dt + flow * 14 * dt;
                    if (s.y > h + 6) { s.y = -6; s.x = Math.random() * w; }
                    if (s.x > w + 8) s.x = -8;
                    if (s.x < -8) s.x = w + 8;
                    const twk = Math.max(0, Math.sin(t * s.twS + s.tw));
                    const br = 0.12 + 0.88 * twk * twk;
                    o.save();
                    o.translate(s.x, s.y);
                    o.rotate(Math.PI / 4 + Math.sin(t * 0.6 + s.spin) * 0.5);
                    o.fillStyle = MD_rgba(s.hue < 0.55 ? this.scene.color_core : '#ffd76b', a * 0.75 * br);
                    const d = s.sz * (0.7 + 0.6 * br);
                    o.fillRect(-d / 2, -d / 2, d, d);
                    o.restore();
                }
                o.restore();
            } else if (mode === 'runes') {
                const e = this.envData('runes', w, h);
                const GL = 'ᚠᚢᚦᚨᚱᚲᛃᛗᛟᛞ✧✦✶☾';
                const minWH = Math.min(w, h);
                o.save();
                o.globalCompositeOperation = 'lighter';
                o.textAlign = 'center';
                o.textBaseline = 'middle';
                for (const s of e.items) {
                    const spd = (s.ring % 2 === 0 ? 1 : -1) * (0.10 - s.ring * 0.022);
                    const ang = s.ang + t * spd;
                    const rad = minWH * (0.24 + s.ring * 0.10);
                    const x = w / 2 + Math.cos(ang) * rad;
                    const y = h / 2 + Math.sin(ang) * rad * 0.94;
                    const glow = 0.3 + 0.7 * Math.max(0, Math.sin(t * 0.7 + s.tw));
                    const al = a * (0.2 + 0.55 * this.scale) * glow;
                    o.shadowColor = this.scene.color_glow;
                    o.shadowBlur = MD_MOBILE ? 8 : 16;
                    o.fillStyle = MD_rgba(s.ring === 1 ? this.scene.color_glow : this.scene.color_core, al);
                    o.font = Math.round(s.sz * (0.85 + 0.3 * this.scale)) + 'px serif';
                    o.fillText(GL[s.g % GL.length], x, y);
                }
                o.restore();
            } else if (mode === 'nebula') {
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
                   cosmic rework: dense twinkling starfield underneath,
                   vivid fixed-palette clouds (magenta/cyan/violet/gold,
                   deliberately NOT palette-themed) with brighter cores */
                const e = this.envData('nebula', w, h);
                o.save();
                for (const s of e.stars) {
                    const tw = 0.35 + 0.65 * Math.sin(t * s.twS + s.tw);
                    o.fillStyle = MD_rgba('#ffffff', a * 0.75 * tw);
                    o.beginPath();
                    o.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                    o.fill();
                }
                o.globalCompositeOperation = 'lighter';
                const NEB = ['#ff5ec8', '#4dd8ff', '#9d5cff', '#ffd36e'];
                for (const b of e.items) {
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    if (b.x < -b.r) b.x = w + b.r;
                    if (b.x > w + b.r) b.x = -b.r;
                    if (b.y < -b.r) b.y = h + b.r;
                    if (b.y > h + b.r) b.y = -b.r;
                    const col = NEB[b.col % NEB.length];
                    const al = a * b.a * (0.75 + 0.55 * this.scale);
                    const g = o.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
                    g.addColorStop(0, MD_rgba(col, al));
                    g.addColorStop(0.5, MD_rgba(col, al * 0.45));
                    g.addColorStop(1, MD_rgba(col, 0));
                    o.fillStyle = g;
                    o.beginPath();
                    o.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                    o.fill();
                    const cg = o.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 0.3);
                    cg.addColorStop(0, MD_rgba('#ffffff', al * 0.35));
                    cg.addColorStop(1, MD_rgba('#ffffff', 0));
                    o.fillStyle = cg;
                    o.beginPath();
                    o.arc(b.x, b.y, b.r * 0.3, 0, Math.PI * 2);
                    o.fill();
                }
                o.restore();
            /* lanterns environment removed 2026-10-10 at Rosie's request */
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
               sky = pseudo-3D forward drift through cloud puffs toward a
               vanishing point */
            } else if (mode === 'sky') {
                const e = this.envData('sky', w, h);
                const SP = this.cloudSprites();
                const vx = w / 2, vy = h * 0.5;
                o.save();
                /* a real daytime sky: deep blue up top, pale at the
                   horizon, with a low sun glow sitting on it */
                const sg = o.createLinearGradient(0, 0, 0, h);
                sg.addColorStop(0, MD_rgba('#2f83d8', a));
                sg.addColorStop(0.55, MD_rgba('#9fd8f2', a * 0.95));
                sg.addColorStop(0.78, MD_rgba('#eaf9ff', a));
                sg.addColorStop(1, MD_rgba('#cfeef8', a * 0.9));
                o.fillStyle = sg;
                o.fillRect(0, 0, w, h);
                const sunX = w * 0.6, sunY = h * 0.6;
                const sun = o.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.min(w, h) * 0.55);
                sun.addColorStop(0, MD_rgba('#ffffff', a * (0.45 + 0.25 * this.scale)));
                sun.addColorStop(1, MD_rgba('#ffffff', 0));
                o.fillStyle = sun;
                o.fillRect(0, 0, w, h);
                /* fluffy sprite clouds drifting toward her; biased to
                   sit above and below the vanishing point like the
                   cloud bands in her reference, plus thin wisps */
                for (const c of e.items) {
                    c.z -= (0.05 + 0.07 * this.scale) * dt;
                    if (c.z < 0.06) { c.z = 1.6; c.x = (Math.random() - 0.5) * 2.6; c.y = (Math.random() - 0.35) * 2.1; }
                    const sx = vx + (c.x / c.z) * w * 0.42;
                    const sy = vy + (c.y / c.z) * h * 0.42;
                    const r = (c.sz / c.z) * Math.min(w, h) * 0.9;
                    if (sx < -r || sx > w + r || sy < -r || sy > h + r) continue;
                    const fade = Math.min(1, (1.6 - c.z) * 2.2) * Math.min(1, c.z * 5);
                    const al = 0.85 * fade;
                    if (al <= 0.02) continue;
                    o.globalAlpha = a * al;
                    const hh = c.streak ? r * 0.22 : r * 0.62;
                    o.drawImage(SP[c.sp % SP.length], sx - r, sy - hh, r * 2, hh * 2);
                }
                o.globalAlpha = 1;
                o.restore();
            }
        },

        /* optional layer: near-invisible dust motes drifting on their
           own slow currents, untouched by the breath */
        drawDust(w, h, t, dt, dp) {
            if (!this._dust.length) {
                const n = MD_MOBILE ? 30 : 55;
                for (let i = 0; i < n; i++) {
                    this._dust.push({
                        x: Math.random() * w, y: Math.random() * h,
                        vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 5,
                        sz: 0.6 + Math.random() * 1.3, tw: Math.random() * 6.28
                    });
                }
            }
            const o = this.octx;
            o.save();
            for (const m of this._dust) {
                m.x += m.vx * dt; m.y += m.vy * dt;
                if (m.x < -4) m.x = w + 4; if (m.x > w + 4) m.x = -4;
                if (m.y < -4) m.y = h + 4; if (m.y > h + 4) m.y = -4;
                const a = dp * 0.10 * (0.5 + 0.5 * Math.sin(t * 0.4 + m.tw));
                if (a <= 0.004) continue;
                o.fillStyle = MD_rgba(this.scene.color_text, a);
                o.beginPath();
                o.arc(m.x, m.y, m.sz, 0, Math.PI * 2);
                o.fill();
            }
            o.restore();
        },

        /* glide mode + shape crossfades toward their targets; called
           early in draw so environment and center stay in sync */
        sceneMixTick(dt) {
            const kx = Math.min(1, dt * 1.1);
            const wantMode = (this.sceneT && this.sceneT.mode) || 'calm';
            const wantShape = (this.sceneT && this.sceneT.shape) || 'circle';
            if (wantMode !== this.scene.mode) {
                if (this.prevMode !== wantMode) { this.prevMode = this.scene.mode; this.envMix = 0; }
                this.scene.mode = wantMode;
            }
            if (this.envMix < 1) this.envMix = Math.min(1, this.envMix + kx);
            if (wantShape !== this.scene.shape) {
                if (this.prevShape !== wantShape) { this.prevShape = this.scene.shape; this.shapeMix = 0; }
                this.scene.shape = wantShape;
            }
            if (this.shapeMix < 1) this.shapeMix = Math.min(1, this.shapeMix + kx);
        },

        /* breathing-center shapes with a soft crossfade between them */
        drawCenter(cx, cy, r, dp, t) {
            const o = this.octx;
            o.save();
            o.translate(cx, cy);
            if (this.shapeMix < 0.999 && this.prevShape !== this.scene.shape) {
                this.drawShape(this.prevShape, 1 - this.shapeMix, r, dp, t);
            }
            this.drawShape(this.scene.shape, this.shapeMix, r, dp, t);
            /* phase progress arc rides every shape */
            if (dp > 0.2) {
                const pr = r + 16 + 10 * this.scale;
                o.strokeStyle = MD_rgba(this.scene.color_text, 0.28 * dp);
                o.lineWidth = 3;
                o.beginPath();
                o.arc(0, 0, pr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.phaseFrac || 0));
                o.stroke();
            }
            o.restore();
        },
        drawShape(shape, sa, r, dp, t) {
            if (sa <= 0.01) return;
            const o = this.octx;
            o.save();
            o.globalAlpha = sa;
            if (shape === 'lotus') {
                const petals = 8;
                const open = 0.3 + 0.7 * this.scale;
                const L = r * (1.25 + 0.5 * this.scale);
                o.shadowColor = this.scene.color_glow;
                o.shadowBlur = MD_MOBILE ? 12 : 26;
                for (let i = 0; i < petals; i++) {
                    const ang = -Math.PI / 2 + (i / petals) * Math.PI * 2 + Math.sin(t * 0.4 + i) * 0.02;
                    const tipX = Math.cos(ang) * L * open;
                    const tipY = Math.sin(ang) * L * open;
                    const px = Math.cos(ang + Math.PI / 2) * r * 0.52 * open;
                    const py = Math.sin(ang + Math.PI / 2) * r * 0.52 * open;
                    const mid = 0.55;
                    o.fillStyle = MD_rgba(this.scene.color_core, 0.34 * dp);
                    o.strokeStyle = MD_rgba(this.scene.color_core, 0.8 * dp);
                    o.lineWidth = 1.5;
                    o.beginPath();
                    o.moveTo(0, 0);
                    o.quadraticCurveTo(Math.cos(ang) * L * mid + px, Math.sin(ang) * L * mid + py, tipX, tipY);
                    o.quadraticCurveTo(Math.cos(ang) * L * mid - px, Math.sin(ang) * L * mid - py, 0, 0);
                    o.fill();
                    o.stroke();
                }
                const core = o.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
                core.addColorStop(0, MD_rgba('#ffffff', 0.9 * dp));
                core.addColorStop(1, MD_rgba(this.scene.color_core, 0.15 * dp));
                o.fillStyle = core;
                o.beginPath();
                o.arc(0, 0, r * 0.42, 0, Math.PI * 2);
                o.fill();
            } else if (shape === 'circle') {
                /* circle: the original glowing disc. was an `else`
                   fallback until 2026-10-10 - it kept painting its
                   sphere under every new shape (Rosie spotted it) */
                o.shadowColor = this.scene.color_glow;
                o.shadowBlur = MD_MOBILE ? 18 : 42;
                const disc = o.createRadialGradient(0, 0, 0, 0, 0, r);
                disc.addColorStop(0, MD_rgba('#ffffff', 0.85 * dp));
                disc.addColorStop(0.55, MD_rgba(this.scene.color_core, 0.65 * dp));
                disc.addColorStop(1, MD_rgba(this.scene.color_core, 0.12 * dp));
                o.fillStyle = disc;
                o.beginPath();
                o.arc(0, 0, r, 0, Math.PI * 2);
                o.fill();
                o.shadowBlur = MD_MOBILE ? 8 : 18;
                o.strokeStyle = MD_rgba(this.scene.color_core, 0.9 * dp);
                o.lineWidth = 2;
                o.beginPath();
                o.arc(0, 0, r, 0, Math.PI * 2);
                o.stroke();
            }
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
               breathing-center shapes: flame, yantra, hexagram, infinity */
            if (shape === 'flame') {
                const fh = r * (1.15 + 0.55 * this.scale);
                const sway = Math.sin(t * 1.7) * 0.05 + Math.sin(t * 4.3 + 1.2) * 0.02;
                const drawBlaze = (h, w, fill) => {
                    o.beginPath();
                    o.moveTo(0, h * 0.62);
                    o.bezierCurveTo(w, h * 0.3, w * 0.85, -h * 0.25, sway * h, -h * 0.78);
                    o.bezierCurveTo(-w * 0.85, -h * 0.25, -w, h * 0.3, 0, h * 0.62);
                    o.closePath();
                    o.fillStyle = fill;
                    o.fill();
                };
                o.shadowColor = this.scene.color_glow;
                o.shadowBlur = MD_MOBILE ? 14 : 30;
                drawBlaze(fh, r * 0.72, MD_rgba(this.scene.color_glow, 0.5 * dp));
                o.shadowBlur = MD_MOBILE ? 6 : 12;
                drawBlaze(fh * 0.62, r * 0.42, MD_rgba(this.scene.color_core, 0.85 * dp));
                o.shadowBlur = 0;
                drawBlaze(fh * 0.34, r * 0.2, MD_rgba('#ffffff', 0.9 * dp));
                const bed = o.createRadialGradient(0, r * 0.5, 0, 0, r * 0.5, r * 0.55);
                bed.addColorStop(0, MD_rgba(this.scene.color_core, 0.5 * dp));
                bed.addColorStop(1, MD_rgba(this.scene.color_core, 0));
                o.fillStyle = bed;
                o.beginPath();
                o.arc(0, r * 0.5, r * 0.55, 0, Math.PI * 2);
                o.fill();
            }
            if (shape === 'yantra') {
                o.shadowColor = this.scene.color_glow;
                o.shadowBlur = MD_MOBILE ? 6 : 12;
                o.lineWidth = 1.4;
                o.strokeStyle = MD_rgba(this.scene.color_core, 0.8 * dp);
                const tri = (rad, up, al) => {
                    o.strokeStyle = MD_rgba(this.scene.color_core, al * dp);
                    o.beginPath();
                    for (let i = 0; i < 3; i++) {
                        const ang = (up ? -Math.PI / 2 : Math.PI / 2) + (i / 3) * Math.PI * 2;
                        const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
                        if (i === 0) o.moveTo(x, y); else o.lineTo(x, y);
                    }
                    o.closePath();
                    o.stroke();
                };
                const k = 0.82 + 0.18 * this.scale;
                tri(r * k, true, 0.85);
                tri(r * k * 0.62, true, 0.6);
                tri(r * k * 0.34, true, 0.45);
                tri(r * k * 0.86, false, 0.8);
                tri(r * k * 0.54, false, 0.55);
                tri(r * k * 0.26, false, 0.4);
                o.strokeStyle = MD_rgba(this.scene.color_glow, 0.35 * dp);
                o.beginPath();
                o.arc(0, 0, r * 1.02, 0, Math.PI * 2);
                o.stroke();
                o.shadowBlur = MD_MOBILE ? 8 : 16;
                o.fillStyle = MD_rgba('#ffffff', (0.55 + 0.4 * this.scale) * dp);
                o.beginPath();
                o.arc(0, 0, r * 0.07, 0, Math.PI * 2);
                o.fill();
            }
            if (shape === 'hexagram') {
                o.shadowColor = this.scene.color_glow;
                o.shadowBlur = MD_MOBILE ? 10 : 22;
                o.lineWidth = 2;
                const spin = t * 0.12;
                const tri2 = (rot, al) => {
                    o.strokeStyle = MD_rgba(this.scene.color_core, al * dp);
                    o.beginPath();
                    for (let i = 0; i < 3; i++) {
                        const ang = rot + (i / 3) * Math.PI * 2 - Math.PI / 2;
                        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
                        if (i === 0) o.moveTo(x, y); else o.lineTo(x, y);
                    }
                    o.closePath();
                    o.stroke();
                };
                tri2(spin, 0.85);
                tri2(-spin + Math.PI, 0.85);
                o.shadowBlur = MD_MOBILE ? 8 : 16;
                const hg = o.createRadialGradient(0, 0, 0, 0, 0, r * 0.4);
                hg.addColorStop(0, MD_rgba('#ffffff', (0.5 + 0.4 * this.scale) * dp));
                hg.addColorStop(1, MD_rgba(this.scene.color_core, 0));
                o.fillStyle = hg;
                o.beginPath();
                o.arc(0, 0, r * 0.4, 0, Math.PI * 2);
                o.fill();
            }
            /* snowflake shape removed 2026-10-10 at Rosie's request */
            /* hourglass shape removed 2026-10-10 at Rosie's request */
            if (shape === 'infinity') {
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
                   comet v2: the lit section is ONE continuous polyline
                   sampled at 720 points along the lemniscate (no integer
                   snapping, no segment gaps), stroked in three additive
                   passes - wide glow, mid glow, hot white core - with a
                   linear gradient fading tail->head across the chord so
                   the whole trail eases smoothly into the dark path. */
                const s2 = r * 1.05;
                const lp = f => {
                    const u = f * Math.PI * 2;
                    const d = 1 + Math.sin(u) * Math.sin(u);
                    return [(s2 * Math.cos(u)) / d, (s2 * Math.sin(u) * Math.cos(u)) / d];
                };
                o.shadowBlur = 0;
                o.strokeStyle = MD_rgba(this.scene.color_core, 0.22 * dp);
                o.lineWidth = 2;
                o.beginPath();
                for (let i = 0; i <= 144; i++) {
                    const pt = lp(i / 144);
                    if (i === 0) o.moveTo(pt[0], pt[1]); else o.lineTo(pt[0], pt[1]);
                }
                o.stroke();
                const cyc = (this._breathCyc === undefined) ? (t * 0.05 % 1) : this._breathCyc;
                const head = ((cyc % 1) + 1) % 1;
                const TAIL = 0.3;
                const N = MD_MOBILE ? 40 : 72;
                const pts = [];
                for (let k = 0; k <= N; k++) {
                    /* quadratic spacing: samples bunch near the head
                       where the curve moves fastest visually */
                    const f = (k / N) * (k / N);
                    pts.push(lp(head - TAIL + TAIL * f));
                }
                const hp = pts[N], tp = pts[0];
                o.globalCompositeOperation = 'lighter';
                o.lineCap = 'round';
                o.lineJoin = 'round';
                const trailStroke = (colA, gA) => {
                    const g = o.createLinearGradient(tp[0], tp[1], hp[0], hp[1]);
                    g.addColorStop(0, MD_rgba(colA, 0));
                    g.addColorStop(0.55, MD_rgba(colA, gA * 0.25 * dp));
                    g.addColorStop(1, MD_rgba(colA, gA * dp));
                    return g;
                };
                o.lineWidth = MD_MOBILE ? 8 : 12;
                o.strokeStyle = trailStroke(this.scene.color_glow, 0.5);

                o.beginPath();
                o.moveTo(pts[0][0], pts[0][1]);
                for (let k = 1; k <= N; k++) o.lineTo(pts[k][0], pts[k][1]);
                o.stroke();
                o.lineWidth = MD_MOBILE ? 4 : 6;
                o.strokeStyle = trailStroke(this.scene.color_glow, 0.85);
                o.beginPath();
                o.moveTo(pts[0][0], pts[0][1]);
                for (let k = 1; k <= N; k++) o.lineTo(pts[k][0], pts[k][1]);
                o.stroke();
                o.lineWidth = 2.4;
                o.strokeStyle = trailStroke('#ffffff', 0.95);
                o.beginPath();
                o.moveTo(pts[0][0], pts[0][1]);
                for (let k = 1; k <= N; k++) o.lineTo(pts[k][0], pts[k][1]);
                o.stroke();
                const hg = o.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], r * 0.3);
                hg.addColorStop(0, MD_rgba('#ffffff', 0.85 * dp));
                hg.addColorStop(0.35, MD_rgba(this.scene.color_glow, 0.4 * dp));
                hg.addColorStop(1, MD_rgba(this.scene.color_glow, 0));
                o.fillStyle = hg;
                o.beginPath();
                o.arc(hp[0], hp[1], r * 0.3, 0, Math.PI * 2);
                o.fill();
            }
            /* bell shape removed 2026-10-10 at Rosie's request */
            o.restore();
        },

        /* ---------------- narration mirror ---------------- */
        syncCenterText() {
            let s = null;
            try { s = Alpine.store('stream'); } catch (e) { return; }
            if (!s) return;
            void s.state;
            const um = s.userMsg;
            const uid = um ? String(um.index !== undefined ? um.index : (um.content || '')).slice(0, 60) : '';
            if (uid && uid !== this.lastUserMsgId) {
                this.lastUserMsgId = uid;
                this.pendingSeg = null;
                this.pendingText = '';
                if (this.centerText) this.bhCenterCommit('');
            }
            const segs = s.turn && s.turn.messages;
            if (!segs || !segs.length) {
                this.mdCommitPending();
                this.pendingSeg = null;
                return;
            }
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
               mirror ONLY the current message's content segment (Rosie's
               rule): tool_calls, reasoning and command segments never
               reach the center, and a message that is nothing but the
               start tool call - the session trigger - shows nothing */
            let seg = null;
            for (let i = segs.length - 1; i >= 0; i--) {
                const m = segs[i];
                if (m && m.type === 'content' && !m.is_cmd) { seg = m; break; }
            }
            if (seg) {
                if (this.pendingSeg && this.pendingSeg !== seg) this.mdCommitPending();
                this.pendingSeg = seg;
                this.pendingText = MD_centerClean(seg.content);
            } else {
                this.mdCommitPending();
                this.pendingSeg = null;
            }
        },
        mdCommitPending() {
            const t = this.pendingText;
            this.pendingText = '';
            if (t && t !== this.centerText) this.bhCenterCommit(t);
        },
        bhCenterCommit(text) {
            this.centerText = text;
            const now = performance.now();
            const kept = [];
            for (const L of this.centerLayers) {
                const a = MD_layerAlpha(L, now);
                if (a > 0.01) kept.push({ txt: L.txt, from: a, to: 0, start: now, dur: 750 });
            }
            if (text) kept.push({ txt: text, from: 0, to: 1, start: now, dur: 750 });
            this.centerLayers = kept;
        },

        /* ---------------- draw loop ---------------- */
        draw() {
            const cv = this.canvas;
            if (!cv) return;
            const dpr = Math.min(window.devicePixelRatio || 1, MD_MOBILE ? 1.5 : 2);
            const w = window.innerWidth, h = window.innerHeight;
            if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) {
                cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
                this.off.width = cv.width; this.off.height = cv.height;
                this.parts = [];
            }
            const c = cv.getContext('2d');
            const o = this.octx;
            o.setTransform(dpr, 0, 0, dpr, 0, 0);
            c.setTransform(dpr, 0, 0, dpr, 0, 0);
            c.clearRect(0, 0, w, h);
            const nowMs = performance.now();
            const dt = this.lastFrame ? Math.min(0.1, (nowMs - this.lastFrame) / 1000) : 0.016;
            this.lastFrame = nowMs;
            const t = Date.now() / 1000;
            const cx = w / 2, cy = h / 2;
            const now = performance.now();

            /* session intensity: eases in on start, drains to 0 in
               exactly endSecs when fading out; at 0 the overlay stops
               itself server-side */
            const intTarget = this.active && !this.ending ? 1 : 0;
            if (this.ending && !this.intFrom) this.intFrom = Math.max(this.intensity, 0.05);
            if (!this.ending) this.intFrom = 0;
            let k = 1 - Math.exp(-2.0 * dt);
            if (this.ending) k = 1 - Math.exp(-(Math.log(Math.max(this.intFrom, 0.05) / 0.02) / Math.max(5, this.endSecs)) * dt);
            this.intensity += (intTarget - this.intensity) * k;
            if (this.ending && this.intensity < 0.03 && !this.intSent) {
                this.intSent = true;
                this.speakStopAll();
                this.ambStopAll();
                this.stopBinaural();
                this.centerLayers = [];
                this.centerText = '';
                this.ripples = [];
                window.meditation.control({ active: false });
                this.endMsg = 'session ended · welcome back, ' + this.subject;
                setTimeout(() => { this.endMsg = ''; }, 5000);
            }
            if (!this.active && this.intensity < 0.005) { this.intensity = 0; return; }
            const dp = this.intensity;

            /* colors glide toward their targets */
            if (this.sceneT) {
                const kc = 1 - Math.exp(-1.6 * dt);
                for (const ck of ['color_core', 'color_glow', 'color_bg', 'color_text']) {
                    this.scene[ck] = MD_mixColor(this.scene[ck], this.sceneT[ck] || this.scene[ck], kc);
                }
                this.scene.particles += ((this.sceneT.particles || 1) - this.scene.particles) * kc;
                this.scene.vignette = this.sceneT.vignette;
                this.scene.bloom = this.sceneT.bloom;
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                   optional layers snap to their target values */
                for (const lk of ['dust', 'horizon']) {
                    if (this.sceneT[lk] !== undefined) this.scene[lk] = this.sceneT[lk];
                }
            }

            this.breathTick(t);
            this.applyBinaural();

            /* background: deep wash in the chosen color, near-solid at
               full intensity for a true full-screen escape */
            o.clearRect(0, 0, w, h);
            o.fillStyle = MD_rgba('#05070f', Math.min(1, 0.55 * dp + 0.25 * dp * dp));
            o.fillRect(0, 0, w, h);
            const bgGrad = o.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.62);
            bgGrad.addColorStop(0, MD_rgba(this.scene.color_bg, 0.95 * dp));
            bgGrad.addColorStop(1, MD_rgba(this.scene.color_bg, 0.35 * dp));
            o.fillStyle = bgGrad;
            o.fillRect(0, 0, w, h);

            const minWH = Math.min(w, h);

            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               scene-mode environments crossfade behind the field;
               optional dust motes and horizon glow; a warm sunrise
               rises from below during the ending as she returns */
            this.sceneMixTick(dt);
            if (this.prevMode !== this.scene.mode) this.drawEnv(this.prevMode, 1 - this.envMix, w, h, t, dt, dp);
            this.drawEnv(this.scene.mode, this.envMix, w, h, t, dt, dp);
            if (this.scene.dust > 0) this.drawDust(w, h, t, dt, dp);
            if (this.scene.horizon > 0) {
                const hg = o.createLinearGradient(0, h, 0, h * 0.6);
                hg.addColorStop(0, MD_rgba(this.scene.color_glow, (0.05 + 0.11 * this.scale) * dp));
                hg.addColorStop(1, MD_rgba(this.scene.color_glow, 0));
                o.fillStyle = hg;
                o.fillRect(0, 0, w, h);
            }
            if (this.ending) {
                const ep = MD_clamp(1 - this.intensity / Math.max(this.intFrom, 0.05), 0, 1);
                if (ep > 0.02) {
                    const sunY = h + minWH * 0.35 - ep * minWH * 0.62;
                    o.save();
                    o.globalCompositeOperation = 'lighter';
                    const sg = o.createRadialGradient(cx, sunY, 0, cx, sunY, minWH * 1.15);
                    sg.addColorStop(0, 'rgba(255, 196, 130, ' + (0.5 * ep * dp).toFixed(3) + ')');
                    sg.addColorStop(0.5, 'rgba(255, 158, 110, ' + (0.22 * ep * dp).toFixed(3) + ')');
                    sg.addColorStop(1, 'rgba(255, 158, 110, 0)');
                    o.fillStyle = sg;
                    o.fillRect(0, 0, w, h);
                    o.restore();
                }
            }

            /* particles: the whole field breathes with the circle -
               pushed outward on the inhale, drawn back on the exhale,
               with per-particle parallax so they streak past each other;
               in fireflies mode they wander lazily and blink instead,
               and every other mode restyles the field to match itself */
            this.buildParticles(w, h);
            const maxR = this.partsMaxR;
            const flow = (this.scale - 0.5) * 2;
            const ff = this.scene.mode === 'fireflies';
            o.save();
            o.globalCompositeOperation = 'lighter';
            for (const p of this.parts) {
                let x, y, a, col, sz, shape = 'dot';
                if (ff) {
                    p.a += p.drift * dt * 0.35;
                    const wob = Math.sin(t * 0.3 + p.tw) * 0.06;
                    const pr = Math.max(8, p.rB * maxR * (0.8 + 0.18 * this.scale * p.par + wob));
                    x = cx + Math.cos(p.a) * pr;
                    y = cy + Math.sin(p.a) * pr * 0.86;
                    const blink = Math.pow(Math.abs(Math.sin(t * 0.35 + p.tw)), 3);
                    a = dp * (0.05 + 0.8 * blink) * (0.45 + 0.55 * this.scale);
                    sz = p.sz * 1.7;
                    col = this.scene.color_glow;
                } else {
                    p.a += p.drift * dt * (1 + Math.abs(flow));
                    const pull = 0.62 + 0.55 * this.scale * p.par;
                    const wob = Math.sin(t * 0.5 + p.tw) * 0.03;
                    const pr = Math.max(8, p.rB * maxR * (pull + wob));
                    x = cx + Math.cos(p.a) * pr;
                    y = cy + Math.sin(p.a) * pr * 0.86;
                    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * p.twS + p.tw));
                    a = dp * tw * 0.55;
                    sz = p.sz * (0.7 + 0.5 * this.scale);
                    col = p.hue < 0.5 ? this.scene.color_glow : this.scene.color_core;
                    /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
                       theme the breathing particle field per scene mode:
                       each mode restyles color, size and shape */
                    const sm = this.scene.mode;
                    if (sm === 'starfield') { col = p.hue < 0.4 ? this.scene.color_text : this.scene.color_glow; }
                    else if (sm === 'petals') { shape = 'petal'; }
                    else if (sm === 'deepsea') { shape = 'bubble'; }
                    else if (sm === 'snowfall') { col = p.hue < 0.5 ? '#ffffff' : this.scene.color_text; sz *= 1.15; }
                    else if (sm === 'rain') { shape = 'bead'; }
                    else if (sm === 'glitterfall') { shape = 'glit'; col = p.hue < 0.55 ? this.scene.color_core : '#ffd76b'; }
                    else if (sm === 'runes') { if (p.hue < 0.18) shape = 'glyph'; }
                    /* nebula field = starfield-style crisp stars, only
                       the color mix leans cosmic (magenta/cyan) */
                    else if (sm === 'nebula') { col = p.hue < 0.3 ? '#ff6ec7' : p.hue < 0.55 ? '#6ee7ff' : p.hue < 0.8 ? this.scene.color_text : this.scene.color_glow; }
                    else if (sm === 'sky') { shape = 'puff'; }
                }
                if (shape === 'dot') {
                    /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
                       fireflies bloom: a wide soft halo rides the blink
                       so each firefly flares like a real light source */
                    if (ff) {
                        const hr = sz * 6.5;
                        const hg = o.createRadialGradient(x, y, 0, x, y, hr);
                        hg.addColorStop(0, MD_rgba(col, a * 0.5));
                        hg.addColorStop(0.4, MD_rgba(col, a * 0.16));
                        hg.addColorStop(1, MD_rgba(col, 0));
                        o.fillStyle = hg;
                        o.beginPath();
                        o.arc(x, y, hr, 0, Math.PI * 2);
                        o.fill();
                    }
                    o.fillStyle = MD_rgba(col, a);
                    o.beginPath();
                    o.arc(x, y, sz, 0, Math.PI * 2);
                    o.fill();
                } else if (shape === 'bubble') {
                    o.strokeStyle = MD_rgba(this.scene.color_text, a * 0.9);
                    o.lineWidth = 1;
                    o.beginPath();
                    o.arc(x, y, sz * 1.6, 0, Math.PI * 2);
                    o.stroke();
                    o.fillStyle = MD_rgba('#ffffff', a * 0.5);
                    o.beginPath();
                    o.arc(x - sz * 0.55, y - sz * 0.55, Math.max(0.5, sz * 0.35), 0, Math.PI * 2);
                    o.fill();
                } else if (shape === 'petal') {
                    o.save();
                    o.translate(x, y);
                    o.rotate(p.tw + t * 0.4);
                    o.fillStyle = MD_rgba(col, a);
                    const L = sz * 2.4, W = sz * 1.15;
                    o.beginPath();
                    o.moveTo(-L / 2, 0);
                    o.bezierCurveTo(-L * 0.15, -W, L * 0.35, -W * 0.85, L / 2, 0);
                    o.bezierCurveTo(L * 0.35, W * 0.85, -L * 0.15, W, -L / 2, 0);
                    o.closePath();
                    o.fill();
                    o.restore();
                } else if (shape === 'streak') {
                    o.strokeStyle = MD_rgba(col, a);
                    o.lineWidth = 1;
                    o.beginPath();
                    o.moveTo(x + sz * 1.3, y - sz * 2.6);
                    o.lineTo(x - sz * 1.3, y + sz * 2.6);
                    o.stroke();
                } else if (shape === 'bead') {
                    const bs = sz * 3.4;
                    o.save();
                    o.globalCompositeOperation = 'source-over';
                    o.globalAlpha = a;
                    o.drawImage(this.dropSprite(), x - bs, y - bs, bs * 2, bs * 2);
                    o.restore();
                } else if (shape === 'glit') {
                    const twk = Math.max(0, Math.sin(t * p.twS * 2 + p.tw));
                    const br = 0.15 + 0.85 * twk * twk;
                    o.save();
                    o.translate(x, y);
                    o.rotate(Math.PI / 4 + p.tw);
                    o.fillStyle = MD_rgba(col, Math.min(1, a * br * 1.6));
                    const d = sz * (0.8 + 0.7 * br);
                    o.fillRect(-d / 2, -d / 2, d, d);
                    o.restore();
                } else if (shape === 'glyph') {
                    o.save();
                    o.shadowColor = this.scene.color_glow;
                    o.shadowBlur = 10;
                    o.fillStyle = MD_rgba(col, Math.min(1, a * 1.3));
                    o.font = Math.round(sz * 6) + 'px serif';
                    o.textAlign = 'center';
                    o.textBaseline = 'middle';
                    o.fillText('✦✧ᚠᚱᛗ☾'[Math.floor(p.hue * 100) % 6], x, y);
                    o.restore();
                } else if (shape === 'puff') {
                    const ps = sz * 6;
                    o.save();
                    o.globalCompositeOperation = 'source-over';
                    o.globalAlpha = a * 0.9;
                    o.drawImage(this.cloudSprites()[Math.floor(p.hue * 3) % 3], x - ps, y - ps * 0.62, ps * 2, ps * 1.24);
                    o.restore();
                }
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
                   the faint radial motion streaks are gone - Rosie
                   found them noisy; the field now draws clean dots */
            }
            /* constellation threads layer removed 2026-10-10 at
               Rosie's request - no connecting lines, ever */
            o.restore();

            /* breathing center: shape crossfades (circle, lotus, flame,
               yantra, hexagram, infinity)
               with the phase progress arc */
            const baseR = minWH * 0.11;
            /* strong visible pulse: the disc nearly doubles between the
               empty hold and the full inhale */
            const r = baseR * (0.58 + 0.84 * this.scale);
            this.drawCenter(cx, cy, r, dp, t);

            /* soft ripple rings released on every phase change */
            if (this.phase !== this.lastPhase) {
                this.lastPhase = this.phase;
                this.ripples.push({ start: now, dur: 2600 });
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                   breath audio and shooting stars ride the same phase change */
                if (this.phase === 'in') {
                    this.playBreath('in');
                } else if (this.phase === 'out') {
                    this.playBreath('out');
                    if (this.scene.mode === 'starfield' && this.envs.starfield) {
                        const nShots = (Math.random() < 0.75 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0);
                        for (let si = 0; si < nShots; si++) {
                            this.envs.starfield.shots.push({
                                x: w * (0.1 + Math.random() * 0.8),
                                y: h * Math.random() * 0.35,
                                vx: (Math.random() < 0.5 ? -1 : 1) * (w * 0.26 + Math.random() * w * 0.22),
                                vy: h * 0.18 + Math.random() * h * 0.12,
                                start: now + si * 180
                            });
                        }
                    }
                }
            }
            for (let i = this.ripples.length - 1; i >= 0; i--) {
                const rp = this.ripples[i];
                const e = now - rp.start;
                if (e > rp.dur) { this.ripples.splice(i, 1); continue; }
                const f = e / rp.dur;
                o.strokeStyle = MD_rgba(this.scene.color_glow, (1 - f) * 0.35 * dp);
                o.lineWidth = 2 + (1 - f) * 3;
                o.beginPath();
                o.arc(cx, cy, r + 12 + f * minWH * 0.42, 0, Math.PI * 2);
                o.stroke();
            }
            /* phase countdown under the circle: "4 in" / "hold for 7"
               / "out for 8" */
            if (dp > 0.15 && this.active && !this.ending) {
                const fs = Math.round(MD_clamp(minWH * 0.052, 26, 46));
                o.save();
                o.textAlign = 'center';
                o.textBaseline = 'middle';
                o.font = '300 ' + fs + "px ui-sans-serif, system-ui, 'Segoe UI', sans-serif";
                if ('letterSpacing' in o) o.letterSpacing = '4px';
                const ly = cy + minWH * 0.30;
                o.shadowColor = MD_rgba(this.scene.color_glow, 0.9);
                o.shadowBlur = MD_MOBILE ? 10 : 22;
                o.fillStyle = MD_rgba(this.scene.color_text, 0.92 * dp);
                o.fillText(MD_phaseLabel(this.phase, this.phaseRem), cx, ly);
                if ('letterSpacing' in o) o.letterSpacing = '0px';
                o.restore();
            }

            /* narration layers (crossfading whole lines of guidance) */
            this.centerGate += ((this.active ? 1 : 0) - this.centerGate) * (1 - Math.exp(-4.5 * dt));
            if (this.centerLayers.length && this.centerGate > 0.01) {
                const fs = Math.round(MD_clamp(w * 0.024, 18, 28));
                const maxW = Math.min(w * 0.76, 880);
                const lh = fs * 1.7;
                o.save();
                o.textAlign = 'center';
                o.textBaseline = 'middle';
                o.font = '500 ' + fs + "px ui-sans-serif, system-ui, 'Segoe UI', sans-serif";
                const ny = cy - minWH * 0.26;
                for (let li = this.centerLayers.length - 1; li >= 0; li--) {
                    const L = this.centerLayers[li];
                    const a = MD_layerAlpha(L, now) * this.centerGate * dp;
                    if (a <= 0.01) {
                        if (L.to === 0) this.centerLayers.splice(li, 1);
                        continue;
                    }
                    const words = String(L.txt).split(/\s+/);
                    const lines = [];
                    let cur = '';
                    for (const wd of words) {
                        const test = cur ? cur + ' ' + wd : wd;
                        if (cur && o.measureText(test).width > maxW) { lines.push(cur); cur = wd; }
                        else cur = test;
                    }
                    if (lines.length || cur) lines.push(cur);
                    const y0 = ny - ((lines.length - 1) / 2) * lh;
                    for (let i = 0; i < lines.length; i++) {
                        o.shadowColor = MD_rgba(this.scene.color_glow, 0.8 * a);
                        o.shadowBlur = MD_MOBILE ? 14 : 34;
                        o.fillStyle = MD_rgba(this.scene.color_text, a);
                        o.fillText(lines[i], cx, y0 + i * lh);
                    }
                }
                o.restore();
            }

            /* -- AI GENERATED FIX (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               the whole scene was painting into the offscreen buffer but
               never composited onto the visible canvas: only the bloom
               and vignette (drawn directly on c) ever showed. copy the
               offscreen frame over before the atmosphere overlays. */
            c.drawImage(this.off, 0, 0, this.off.width, this.off.height, 0, 0, w, h);

            /* atmosphere: gentle vignette + bloom halo, auto by default */
            const vig = this.scene.vignette >= 0 ? this.scene.vignette / 100 : 0.55;
            const blo = this.scene.bloom >= 0 ? this.scene.bloom / 100 : 0.5;
            c.save();
            if (vig > 0.01 && dp > 0.05) {
                const g = c.createRadialGradient(cx, cy, minWH * 0.32, cx, cy, Math.hypot(w, h) * 0.62);
                g.addColorStop(0, 'rgba(0,0,0,0)');
                g.addColorStop(1, 'rgba(0,0,0,' + (vig * 0.65 * dp).toFixed(3) + ')');
                c.fillStyle = g;
                c.fillRect(0, 0, w, h);
            }
            if (blo > 0.01 && dp > 0.05) {
                c.globalCompositeOperation = 'lighter';
                const g2 = c.createRadialGradient(cx, cy, 0, cx, cy, minWH * (0.34 + 0.3 * this.scale));
                g2.addColorStop(0, MD_rgba(this.scene.color_glow, 0.16 * blo * dp));
                g2.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = g2;
                c.fillRect(0, 0, w, h);
            }
            c.restore();
        },

        /* ---------------- audio: binaural beats ---------------- */
        ensureAudio() {
            if (!this.audioCtx) {
                try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.audioCtx = null; }
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
            return this.audioCtx;
        },
        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
           synthesized breath: filtered wind noise swelling up through the
           inhale, a long falling sigh through the exhale. shares the
           binaural AudioContext, gated by the breath_sounds setting. */
        playBreath(who) {
            if (!this.active || this.ending || this.muted || !this.breathSnd) return;
            const c = this.ensureAudio();
            if (!c) return;
            if (!this.noiseBuf) {
                const len = Math.floor(c.sampleRate * 2);
                this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
                const d = this.noiseBuf.getChannelData(0);
                let last = 0;
                for (let i = 0; i < len; i++) {
                    const w = Math.random() * 2 - 1;
                    last = (last + 0.02 * w) / 1.02;
                    d[i] = last * 3.5;
                }
            }
            const dur = Math.max(1.2, this.phaseDur || 4);
            const t0 = c.currentTime + 0.02;
            const src = c.createBufferSource();
            src.buffer = this.noiseBuf;
            src.loop = true;
            const bp = c.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 0.8;
            const g = c.createGain();
            const peak = Math.max(0.02, 0.16 * this.opacity());
            if (who === 'in') {
                bp.frequency.setValueAtTime(280, t0);
                bp.frequency.linearRampToValueAtTime(780, t0 + dur);
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.7);
                g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
            } else {
                bp.frequency.setValueAtTime(720, t0);
                bp.frequency.linearRampToValueAtTime(240, t0 + dur);
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.linearRampToValueAtTime(peak * 0.9, t0 + dur * 0.25);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            }
            src.connect(bp);
            bp.connect(g);
            g.connect(c.destination);
            src.start(t0);
            src.stop(t0 + dur + 0.1);
        },
        startBinaural() {
            const c = this.ensureAudio();
            if (!c) return;
            if (!this.binNodes) {
                try {
                    const g = c.createGain();
                    g.gain.value = 0;
                    g.connect(c.destination);
                    const gBin = c.createGain(); gBin.gain.value = 1; gBin.connect(g);
                    const gIso = c.createGain(); gIso.gain.value = 0; gIso.connect(g);
                    const lo = c.createOscillator(), ro = c.createOscillator(), io = c.createOscillator();
                    const lp = c.createStereoPanner(), rp = c.createStereoPanner();
                    lo.type = 'sine'; ro.type = 'sine'; io.type = 'sine';
                    lp.pan.value = -1; rp.pan.value = 1;
                    lo.connect(lp); lp.connect(gBin);
                    ro.connect(rp); rp.connect(gBin);
                    const isoGate = c.createGain();
                    isoGate.gain.value = 0.5;
                    const lfo = c.createOscillator(), lfoDepth = c.createGain();
                    lfo.type = 'sine'; lfoDepth.gain.value = 0.5;
                    lfo.connect(lfoDepth); lfoDepth.connect(isoGate.gain);
                    io.connect(isoGate); isoGate.connect(gIso);
                    lo.start(); ro.start(); io.start(); lfo.start();
                    this.binNodes = { lo: lo, ro: ro, io: io, lfo: lfo, g: g, gBin: gBin, gIso: gIso };
                } catch (e) { return; }
            }
        },
        applyBinaural() {
            const c = this.audioCtx, n = this.binNodes;
            if (!c || !n) return;
            const mode = this.bin.mode || 'binaural';
            let base, beat, vol;
            if (this.ending || !this.active) {
                base = 250; beat = 14; vol = 0;
            } else if (this.bin.auto) {
                /* drift 10 Hz alpha down to 3 Hz theta over ~10 minutes
                   of session elapsed time */
                const el = this.startedAt ? (Date.now() / 1000 - this.startedAt) : 0;
                const prog = MD_clamp(el / 600, 0, 1);
                base = MD_lerp(220, 110, prog);
                beat = MD_lerp(10, 3, prog);
                vol = MD_lerp(0.03, 0.16, prog) * this.intensity;
            } else {
                base = this.bin.base || 220;
                beat = this.bin.beat || 10;
                vol = ((this.bin.vol || 0) / 100) * 0.35 * this.intensity;
            }
            if (!this.active || this.muted || !this.binOk || !this.bin.on) vol = 0;
            try {
                const t = c.currentTime;
                n.lo.frequency.setTargetAtTime(base, t, 1.5);
                n.ro.frequency.setTargetAtTime(base + beat, t, 1.5);
                n.io.frequency.setTargetAtTime(Math.max(40, base), t, 1.5);
                n.lfo.frequency.setTargetAtTime(beat, t, 1.5);
                n.gBin.gain.setTargetAtTime(mode === 'isochronic' ? 0 : 1, t, 0.6);
                n.gIso.gain.setTargetAtTime(mode === 'binaural' ? 0 : 1, t, 0.6);
                n.g.gain.setTargetAtTime(vol, t, 1.2);
            } catch (e) {}
        },
        stopBinaural() {
            if (!this.binNodes || !this.audioCtx) return;
            try { this.binNodes.g.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.8); } catch (e) {}
        },

        /* ---------------- ambient sound loops ---------------- */
        buildPlaylist(amb) {
            if (!this.ambEnabled || !amb.on || !this.tracks.length) {
                this.ambPlaylist = [];
                this.ambStopAll();
                return;
            }
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               no rotation: one track loops endlessly and gapless; 'auto'
               simply picks a random one so sessions vary */
            const want = String(amb.track || '').toLowerCase();
            let idx = -1;
            if (want && want !== 'auto' && want !== 'all') {
                const hit = this.tracks.filter((t) => t.toLowerCase() === want || t.toLowerCase().replace(/\.[a-z0-9]+$/, '') === want);
                if (hit.length) idx = this.tracks.indexOf(hit[0]);
            }
            if (idx < 0) idx = Math.floor(Math.random() * this.tracks.length);
            this.ambPlaylist = (idx >= 0 && idx < this.tracks.length) ? [idx] : [];
            this.ambIdx = 0;
            this.ambEnsure();
        },
        ambUrl(i) {
            return '/ext-assets/meditation/audio/' + encodeURIComponent(this.tracks[this.ambPlaylist[i] !== undefined ? this.ambPlaylist[i] : this.ambPlaylist[0]]);
        },
        ambEls() {
            if (!this._ambEls) {
                const mk = () => {
                    const a = new Audio();
                    a.preload = 'auto';
                    a.volume = 0;
                    a.loop = true;
                    return a;
                };
                this._ambEls = [mk(), mk()];
                this._ambCur = 0;
            }
            return this._ambEls;
        },
        ambEnsure() {
            const els = this.ambEls();
            const el = els[this._ambCur];
            const url = this.ambUrl(this.ambIdx);
            if (el.dataset.src !== url) {
                el.dataset.src = url;
                try { el.src = url; } catch (e) { return; }
            }
            el.loop = true;
            el.onended = null;
            this.ambKick();
            this.ambVolRamp();
        },
        ambKick() {
            /* autoplay policy: play() may reject until a gesture */
            if (!this._ambEls) return;
            const el = this._ambEls[this._ambCur];
            if (el && el.src && el.paused && this.amb && this.amb.on && this.active) {
                el.play().catch(() => {});
            }
        },
        /* ambNext / crossfade rotation removed: the chosen track now
           simply loops gapless forever */
        ambVolRamp() {
            if (!this._ambEls || !this.amb) return;
            const target = (this.amb.on && this.active && !this.ending && !this.muted) ? MD_clamp((this.amb.vol || 35) / 100, 0, 1) * 0.9 : 0;
            const el = this._ambEls[this._ambCur];
            if (el && !el.paused) {
                const from = el.volume, t0 = performance.now();
                const fade = () => {
                    const f = Math.min(1, (performance.now() - t0) / 1200);
                    if (!el.paused) el.volume = MD_lerp(from, target, f);
                    if (f < 1) requestAnimationFrame(fade);
                };
                fade();
            }
        },
        ambStopAll() {
            if (!this._ambEls) return;
            for (const el of this._ambEls) {
                const from = el.volume, t0 = performance.now();
                const fade = () => {
                    const f = Math.min(1, (performance.now() - t0) / 1800);
                    el.volume = from * (1 - f);
                    if (f < 1) requestAnimationFrame(fade);
                    else { try { el.pause(); } catch (e) {} }
                };
                fade();
            }
        },

        /* ---------------- guide voice: kokoro neural TTS ---------------- */
        enginePref() {
            const forced = localStorage.getItem('mdTtsEngine');
            if (forced === 'kokoro' || forced === 'webspeech') return forced;
            return this.ttsEngine || 'kokoro';
        },
        bhWorker() {
            if (this.kokoroTts) return this.kokoroTts;
            if (this.kokoroState === 'error') { this.mdLog('WORKER: unavailable, skipping spawn'); return null; }
            this._wSpawnAt = performance.now();
            this.mdLog('WORKER: spawning, model load begins (first init takes a while)');
            const w = new Worker(MD_KOKORO_WORKER, { type: 'module' });
            this.kokoroTts = w;
            this.kokoroInitWaiters = [];
            w.onmessage = (ev) => {
                const d = ev.data || {};
                if (d.action === 'inited') {
                    this.kokoroState = d.success ? 'ready' : 'error';
                    if (d.success) { this.kokoroEngine = d.engine || ''; this.kokoroMsg = ''; }
                    else { this.kokoroMsg = d.error || 'unknown'; }
                    const ws = this.kokoroInitWaiters.splice(0);
                    for (const fn of ws) fn(d.success ? w : null);
                    this.mdLog(d.success
                        ? 'WORKER: READY on ' + (d.engine || '?') + ' +' + Math.round(performance.now() - (this._wSpawnAt || 0)) + 'ms'
                        : 'WORKER: FAILED +' + Math.round(performance.now() - (this._wSpawnAt || 0)) + 'ms: ' + (d.error || '?'));
                } else if (d.action === 'chunk' || d.action === 'chunk_end' || d.action === 'chunk_err' || d.action === 'render_ok'
                    || d.action === 'render_chunk' || d.action === 'render_end' || d.action === 'render_err' || d.action === 'render_aborted') {
                    /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
                       render_end must be routed: the new worker terminates every
                       render_stream with it, and an unrouted render_end means the
                       prefetch item never settles and the speak queue stalls */
                    this.mdStreamMsg(d);
                }
            };
            w.onerror = (e) => {
                this.kokoroState = 'error';
                this.kokoroMsg = String((e && e.message) || 'worker error').slice(0, 140);
                this.mdLog('WORKER: crashed: ' + this.kokoroMsg);
                this.genActive = false;
                this.bgRid = '';
                try { w.terminate(); } catch (err) {}
                this.kokoroTts = null;
                const ws = this.kokoroInitWaiters.splice(0);
                for (const fn of ws) fn(null);
            };
            w.postMessage({ action: 'init', data: { modelId: MD_KOKORO_MODEL } });
            this.kokoroState = 'loading';
            return w;
        },
        mdLog(msg, info) { console.log('[md-speech]', msg, info === undefined ? '' : info); },
        mdPrev(t) { const s = String(t || ''); return '"' + s.slice(0, 28) + (s.length > 28 ? '..."' : '"'); },
        kokoroReady() {
            const w = this.bhWorker();
            if (!w) return Promise.resolve(null);
            if (this.kokoroState === 'ready') return Promise.resolve(w);
            return new Promise((resolve) => { this.kokoroInitWaiters.push(resolve); });
        },
        mdActx() {
            /* voice graph: dry + gentle convolution reverb -> slow pan
               -> out. meditation wants a soft hall around the voice */
            if (!this.kokoroCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                this.kokoroCtx = new AC();
                const c = this.kokoroCtx;
                this.kokoroGain = c.createGain();
                this.kokoroGain.gain.value = 0.9;
                this.kokoroGain.connect(c.destination);
                try {
                    const panner = c.createStereoPanner();
                    panner.connect(this.kokoroGain);
                    const lfo = c.createOscillator();
                    lfo.type = 'sine';
                    lfo.frequency.value = 0.05;
                    const lfoDepth = c.createGain();
                    lfoDepth.gain.value = 0.15;
                    lfo.connect(lfoDepth);
                    lfoDepth.connect(panner.pan);
                    lfo.start();
                    const mix = c.createGain();
                    mix.connect(panner);
                    const dry = c.createGain();
                    dry.gain.value = 1;
                    dry.connect(mix);
                    const conv = c.createConvolver();
                    const ir = c.createBuffer(2, Math.floor(c.sampleRate * 2.6), c.sampleRate);
                    for (let ch = 0; ch < 2; ch++) {
                        const data = ir.getChannelData(ch);
                        for (let i = 0; i < data.length; i++) {
                            const f = i / data.length;
                            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - f, 2.8) * (f < 0.01 ? f * 100 : 1);
                        }
                    }
                    conv.buffer = ir;
                    const wet = c.createGain();
                    wet.gain.value = 0.18;
                    conv.connect(wet);
                    wet.connect(mix);
                    this.kokoroVoiceIn = dry;
                    this.kokoroRevIn = conv;
                } catch (e) {
                    this.kokoroVoiceIn = this.kokoroGain;
                    this.kokoroRevIn = null;
                }
            }
            if (this.kokoroCtx.state === 'suspended') this.kokoroCtx.resume().catch(() => {});
            return this.kokoroCtx;
        },
        async kokoroSpeak(spec, onStart) {
            const t0 = performance.now();
            const w = await this.kokoroReady();
            if (!w) { this.mdLog('LIVE: no kokoro worker -> WEB fallback: ' + this.mdPrev(spec.text)); this.webSpeechNow(spec, null, onStart); return; }
            const raw = String(spec.voice || '').trim() || this.defaultVoice || localStorage.getItem('mdKokoroVoice') || MD_KOKORO_DEFAULT;
            const voice = MD_KOKORO_VOICES.indexOf(raw) >= 0 ? raw : MD_KOKORO_DEFAULT;
            const speed = MD_clamp((spec.rate || 92) / 100, 0.5, 2);
            const rid = 'r' + (this.kokoroSeq += 1);
            this.mdActx();
            this.mdLog('LIVE ' + this.mdPrev(spec.text) + ' rid=' + rid + ' voice=' + voice + ' speed=' + speed.toFixed(2));
            await new Promise((resolve, reject) => {
                const s = { rid: rid, resolve: resolve, reject: reject, nextT: 0, live: 0, done: false, started: false, onStart: onStart, t0: t0 };
                this.kokoroStream = s;
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                   the worker IS the priority queue now: live gen posts
                   straight away and cuts to the front; any in-flight
                   background render yields at its next sentence boundary */
                this.genActive = true;
                w.postMessage({ action: 'gen', data: { text: String(spec.text || ''), voice: voice, speed: speed, requestId: rid } });
                this.mdLog('LIVE rid=' + rid + ': gen posted +' + Math.round(performance.now() - t0) + 'ms (worker starts now)');
                /* diagnostic only - we never fall back to browser TTS */
                setTimeout(() => {
                    if (this.kokoroStream === s && !s.started) this.mdLog('LIVE rid=' + rid + ': SLOW, no first chunk 6s after post');
                }, 6000);
            });
        },
        /* wqRun/wqDone stay retired: the
           worker must never serialize - jobs start on arrival and share
           the CPU. politeness lives on THIS side: genActive + pumpBg
           keep background renders off the live synthesis path entirely. */
        mdStreamMsg(d) {
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               prefetch renders ride the same worker: resolve them from the
               render map before the live-stream rid check */
            const pr = this.speechRenders[d.requestId];
            if (pr) {
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                   the worker yielded this prefetch to a live line: re-post it.
                   its 90s timeout keeps running, so re-queues can't loop
                   forever. chunks already delivered are skipped by index on
                   the chunk path, so a re-render never doubles a sentence */
                if (d.action === 'render_aborted') {
                    /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                       yielded to live speech: hand the bg slot back and
                       re-queue at the FRONT. the pump restarts it the
                       moment the live line's SYNTHESIS is done (not its
                       playback), so it resumes when the CPU frees up
                       instead of fighting for it; 90s timeout still guards */
                    this.mdLog('PREFETCH rid=' + d.requestId + ': yielded to live speech, re-queued');
                    if (this.bgRid === d.requestId) this.bgRid = '';
                    if (this.speechRenders[d.requestId] === pr) {
                        if (this.bgQueue.indexOf(pr) < 0) this.bgQueue.unshift(pr);
                        this.pumpBg();
                    }
                    return;
                }
                /* streaming chunks accumulate and wake the player; the item
                   only settles on the terminal render_end/render_err */
                if (d.action === 'render_chunk') {
                    if (pr._seen && pr._seen[d.index]) return;
                    if (!pr._seen) pr._seen = {};
                    pr._seen[d.index] = 1;
                    try {
                        const ctx = this.mdActx();
                        const buf = ctx.createBuffer(1, Math.max(1, d.samples.length), d.sampleRate || 24000);
                        buf.copyToChannel(d.samples, 0);
                        pr.chunks.push(buf);
                        pr._n = (pr._n || 0) + 1;
                        if (pr._n === 1) this.mdLog('PREFETCH rid=' + d.requestId + ': FIRST chunk +' + Math.round(performance.now() - (pr.t0 || 0)) + 'ms after queueing');
                        pr.fire();
                    } catch (e) { pr.err = e; pr.fire(); }
                    return;
                }
                delete this.speechRenders[d.requestId];
                clearTimeout(pr.tmo);
                if (this.bgRid === d.requestId) { this.bgRid = ''; this.pumpBg(); }
                if (d.action === 'render_end') {
                    this.mdLog('PREFETCH rid=' + d.requestId + ': render_end +' + Math.round(performance.now() - (pr.t0 || 0)) + 'ms (' + (pr._n || 0) + ' chunk(s))');
                    pr.end = true;
                } else {
                    this.mdLog('PREFETCH rid=' + d.requestId + ': render_ERR: ' + (d.error || 'failed'));
                    pr.err = new Error(d.error || 'render failed');
                }
                pr.fire();
                return;
            }
            const s = this.kokoroStream;
            if (!s || s.rid !== d.requestId) return;
            if (d.action === 'chunk_err') {
                this.mdLog('LIVE rid=' + d.requestId + ': gen_ERR: ' + (d.error || 'gen failed'));
                if (this.kokoroStream === s) this.kokoroStream = null;
                this.genActive = false;
                this.pumpBg();
                s.reject(new Error(d.error || 'gen failed'));
                return;
            }
            if (d.action === 'chunk') {
                const ctx = this.mdActx();
                try {
                    const buf = ctx.createBuffer(1, d.samples.length, d.sampleRate || 24000);
                    buf.copyToChannel(d.samples, 0);
                    const src = ctx.createBufferSource();
                    src.buffer = buf;
                    src.connect(this.kokoroVoiceIn);
                    if (this.kokoroRevIn) src.connect(this.kokoroRevIn);
                    const t0 = Math.max(ctx.currentTime + 0.03, s.nextT);
                    src.start(t0);
                    s.nextT = t0 + buf.duration;
                    s.live += 1;
                    this.kokoroSrcs.push(src);
                    s._n = (s._n || 0) + 1;
                    this.mdLog('LIVE rid=' + d.requestId + ': chunk #' + s._n + (s._n === 1 ? ' FIRST +' + Math.round(performance.now() - (s.t0 || 0)) + 'ms' : ''));
                    /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                       first chunk scheduled: the voice is audibly under
                       way, release the blocked speak tool right this instant */
                    if (!s.started && s.onStart) { s.started = true; try { s.onStart(); } catch (e) {} }
                    src.onended = () => {
                        s.live -= 1;
                        const i = this.kokoroSrcs.indexOf(src);
                        if (i >= 0) this.kokoroSrcs.splice(i, 1);
                        if (s.done && s.live <= 0 && this.kokoroStream === s) { this.kokoroStream = null; s.resolve(); }
                    };
                } catch (e) {
                    if (this.kokoroStream === s) { this.kokoroStream = null; this.genActive = false; this.pumpBg(); s.reject(e); }
                }
                return;
            }
            this.mdLog('LIVE rid=' + d.requestId + ': synth done upstream +' + Math.round(performance.now() - (s.t0 || 0)) + 'ms (' + (s._n || 0) + ' chunk(s))');
            s.done = true;
            /* synthesis is done - background renders may now use the CPU
               freely while this line's audio plays out */
            this.genActive = false;
            this.pumpBg();
            if (s.live <= 0 && this.kokoroStream === s) { this.kokoroStream = null; s.resolve(); }
        },

        /* ---------------- speak queue + loop ---------------- */
        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
           speech handshake v2: the server-side speak
           tool now waits for the voice to go IDLE, not just to start. the
           ack (speaking=true) rides the DISPATCH instant so a still-loading
           kokoro engine keeps the tool waiting through model init, and
           speaking=false lands when the line has fully played out */
        syncSpeaking() {
            this.mdLog('HANDSHAKE: POST speaking=' + this.speakingNow);
            fetch('/api/ext/meditation/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ speaking: this.speakingNow })
            }).catch(() => {});
        },
        /* legacy audible-start signal: kept as a log marker only, the
           handshake above replaced the speech_start POST entirely */
        speechStarted() {
            this.mdLog('HANDSHAKE: line audible (ack already sent at dispatch)');
        },
        speakNow(spec) {
            this.mdLog('LINE IN: ' + this.mdPrev(spec.text) + ' | ' + (this.muted ? 'MUTED' : this.speakingNow ? 'busy, queue=' + this.speakQueue.length : 'idle -> dispatch now'));
            if (this.muted) { this.speechStarted(); return; }
            if (this.speakingNow) {
                if (this.speakQueue.length >= 12) { this.mdLog('DROPPED (queue overflow): ' + this.mdPrev(spec.text)); this.speechStarted(); return; }
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                   speech pipeline: while a line is still playing, render
                   THIS one off-stream right away so its audio is ready the
                   moment the queue reaches it - the synth wait hides under
                   the voice instead of gaping between lines */
                if (this.enginePref() === 'kokoro') {
                    this.mdLog('-> queued as PREFETCH, render starts immediately');
                    this.speakQueue.push(this.makePrefetch(spec));
                    return;
                }
                spec._qAt = performance.now();
                this.mdLog('-> queued plain (no prefetch)');
                this.speakQueue.push(spec);
                return;
            }
            this.speakDispatch(spec);
        },
        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
           streaming prefetch: the worker posts one chunk per sentence via
           render_stream, so playback starts at the FIRST chunk instead of
           waiting for the whole line; speed is baked into the synthesis
           exactly like the live path, so playback itself is never touched */
        makePrefetch(spec) {
            const item = {
                spec: spec, chunks: [], end: false, err: null, live: 0,
                nextT: 0, schedIdx: 0, playing: false, startedFired: false,
                started: false, onArrive: null, resolveFirst: null, tmo: null,
                t0: performance.now(), rid: ''
            };
            item.first = new Promise((res) => { item.resolveFirst = res; });
            item.fire = () => {
                if (item.playing && item.onArrive) { try { item.onArrive(); } catch (e) {} }
                if (!item.started && (item.chunks.length || item.end || item.err)) {
                    item.started = true;
                    if (item.resolveFirst) item.resolveFirst();
                }
            };
            this.kokoroReady().then((w) => {
                if (!w) { item.err = new Error('no kokoro worker'); item.fire(); return; }
                const raw = String(spec.voice || '').trim() || this.defaultVoice || localStorage.getItem('mdKokoroVoice') || MD_KOKORO_DEFAULT;
                const voice = MD_KOKORO_VOICES.indexOf(raw) >= 0 ? raw : MD_KOKORO_DEFAULT;
                const speed = MD_clamp((spec.rate || 92) / 100, 0.5, 2);
                const rid = 'p' + (this.kokoroSeq += 1);
                item.tmo = setTimeout(() => {
                    if (this.speechRenders[rid] !== item) return;
                    delete this.speechRenders[rid];
                    const qi = this.bgQueue.indexOf(item);
                    if (qi >= 0) this.bgQueue.splice(qi, 1);
                    if (this.bgRid === rid) { this.bgRid = ''; this.pumpBg(); }
                    this.mdLog('PREFETCH rid=' + rid + ': TIMEOUT after 90s');
                    item.err = new Error('prefetch render timeout');
                    item.fire();
                }, 90000);
                item.text = String(spec.text || ''); item.voice = voice; item.speed = speed;
                item.started = true;
                this.speechRenders[rid] = item;
                item.rid = rid;
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                   v5: prefetches enter a polite queue instead of posting
                   straight at the worker - while a live line synthesizes,
                   a background render steals CPU from the words she is
                   waiting to hear. the pump fires the moment upstream
                   synth finishes, hiding renders under playback */
                this.bgQueue.push(item);
                this.pumpBg();
            }).catch((e) => { item.err = e; item.fire(); });
            return item;
        },
        pumpBg() {
            /* one background render at a time (soonest-needed line
               first), and NEVER while a live line is synthesizing */
            if (this.genActive || this.bgRid) return;
            const w = this.bhWorker();
            if (!w) return;
            while (this.bgQueue.length) {
                const item = this.bgQueue.shift();
                if (!this.speechRenders[item.rid]) continue; /* timed out */
                this.bgRid = item.rid;
                w.postMessage({ action: 'render_stream', data: { text: item.text, voice: item.voice, speed: item.speed, requestId: item.rid } });
                this.mdLog('PREFETCH rid=' + item.rid + ': render_stream posted (bg slot free)');
                return;
            }
        },
        speakDispatch(entry) {
            const spec = (entry && entry.spec) ? entry.spec : entry;
            const gen = (this.speakGen += 1);
            const t0 = performance.now();
            this.speakingNow = true;
            /* ack the waiting speak tool the instant the line is taken */
            this.syncSpeaking();
            this.mdLog((entry && entry.spec ? 'DISPATCH PREFETCHED ' : 'DISPATCH LIVE ') + this.mdPrev(spec.text) + (entry && entry.spec && entry.t0 ? ' (prefetched ' + Math.round(t0 - entry.t0) + 'ms ago)' : ''));
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
               the handshake fires when the line is AUDIBLY UNDER WAY, not
               when it ends. once-guard: exactly zero or one post per
               dispatch, a late end signal must never release the NEXT say */
            let told = false;
            const started = () => { if (told) return; told = true; this.mdLog('AUDIBLE: ' + this.mdPrev(spec.text) + ' +' + Math.round(performance.now() - t0) + 'ms after dispatch'); this.speechStarted(); };
            const done = () => {
                if (this.speakGen !== gen) return;
                this.mdLog('COMPLETE: ' + this.mdPrev(spec.text) + ' total ' + Math.round(performance.now() - t0) + 'ms');
                /* safety: line resolved without ever signalling a start */
                started();
                this.speakingNow = false;
                /* release the waiting speak tool: this line is fully spoken */
                this.syncSpeaking();
                this.drainSpeakQueue();
            };
            /* prefetched line: stream its chunks through the voice chain
               the instant its turn comes up, even mid-render */
            if (entry && entry.spec) { this.playPrefetched(entry, started, done, gen); return; }
            if (this.enginePref() === 'kokoro') {
                this.kokoroSpeak(spec, started).then(done).catch((e) => {
                    console.warn('meditation kokoro speak failed, falling back:', e);
                    this.webSpeechNow(spec, done, started);
                });
                return;
            }
            this.webSpeechNow(spec, done, started);
        },
        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
           play a prefetched line as its chunks stream in: each sentence is
           queued gaplessly behind the last, so the voice starts at the
           first chunk; falls back to the live synth path if the render
           fails before anything plays. playback speed untouched */
        playPrefetched(item, started, done, gen) {
            const alive = () => this.speakGen === gen && this.active;
            const failLive = () => {
                this.mdLog('PREFETCH ' + (item.rid || '') + ': FAILED (' + ((item.err && item.err.message) || 'no audio') + ') -> live fallback');
                this.kokoroSpeak(item.spec, started).then(done).catch(() => this.webSpeechNow(item.spec, done, started));
            };
            const scheduleAll = () => {
                if (!alive()) return;
                const ctx = this.mdActx();
                while (item.schedIdx < item.chunks.length) {
                    const buf = item.chunks[item.schedIdx];
                    item.schedIdx += 1;
                    try {
                        const src = ctx.createBufferSource();
                        src.buffer = buf;
                        src.connect(this.kokoroVoiceIn);
                        if (this.kokoroRevIn) src.connect(this.kokoroRevIn);
                        const t0 = Math.max(ctx.currentTime + 0.03, item.nextT);
                        item.nextT = t0 + buf.duration;
                        item.live += 1;
                        src.onended = () => {
                            item.live -= 1;
                            const i = this.kokoroSrcs.indexOf(src);
                            if (i >= 0) this.kokoroSrcs.splice(i, 1);
                            if ((item.end || item.err) && item.live <= 0 && item.schedIdx >= item.chunks.length) done();
                        };
                        src.start(t0);
                        this.kokoroSrcs.push(src);
                    } catch (e) { done(); return; }
                    if (!item.startedFired) { item.startedFired = true; this.mdLog('PREFETCH ' + (item.rid || '') + ': PLAYBACK starts +' + Math.round(performance.now() - (item.t0 || 0)) + 'ms after queueing (' + item.chunks.length + ' chunk(s) in hand)'); started(); }
                }
                if (item.err && item.schedIdx === 0) { failLive(); return; }
                if (item.startedFired && (item.end || item.err) && item.live <= 0 && item.schedIdx >= item.chunks.length) done();
            };
            item.playing = true;
            item.onArrive = scheduleAll;
            scheduleAll();
            if (item.schedIdx === 0 && !item.end && !item.err) item.first.then(scheduleAll);
        },
        drainSpeakQueue() {
            if (this.speakingNow) return;
            if (this.muted || !this.active) {
                /* dropped lines release their waiting tool calls too */
                const dropped = this.speakQueue.length;
                this.speakQueue = [];
                if (dropped) this.mdLog('QUEUE: muted flush, ' + dropped + ' line(s) released');
                for (let i = 0; i < dropped; i++) this.speechStarted();
                return;
            }
            const next = this.speakQueue.shift();
            if (next) {
                const qa = next.t0 || next._qAt || 0;
                this.mdLog('QUEUE: pulling next ' + this.mdPrev((next.spec || next).text) + (qa ? ' (waited ' + Math.round(performance.now() - qa) + 'ms)' : ''));
                this.speakDispatch(next);
            }
        },
        webSpeechNow(spec, onDone, onStart) {
            const wt0 = performance.now();
            this.mdLog('WEB fallback: ' + this.mdPrev(spec.text));
            const finish = () => { this.mdLog('WEB utterance done (' + Math.round(performance.now() - wt0) + 'ms)'); if (onStart) onStart(); if (onDone) onDone(); };
            if (!('speechSynthesis' in window)) { finish(); return; }
            try {
                const u = new SpeechSynthesisUtterance(String(spec.text || ''));
                /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
                   the waiting tool wakes when the voice actually starts;
                   finish also covers lines that error out before ever
                   starting (the dispatch once-guard keeps it to one post) */
                u.onstart = () => { this.mdLog('WEB utterance STARTED +' + Math.round(performance.now() - wt0) + 'ms'); if (onStart) onStart(); };
                u.onend = finish;
                u.onerror = finish;
                u.rate = MD_clamp((spec.rate || 92) / 100, 0.6, 2);
                u.pitch = 0.85;
                u.volume = 0.9;
                const pickVoice = () => {
                    const vs = window.speechSynthesis.getVoices() || [];
                    if (!vs.length) return null;
                    if (spec.voice) {
                        const q = String(spec.voice).toLowerCase();
                        const exact = vs.find((vv) => vv.name.toLowerCase().includes(q));
                        if (exact) return exact;
                    }
                    for (const pref of MD_PREF_VOICES) {
                        const hit = vs.find((vv) => vv.name.toLowerCase().includes(pref));
                        if (hit) return hit;
                    }
                    return vs.find((vv) => /female|zira|samantha|victoria|karen|susan|fiona|moira|tessa|serena/i.test(vv.name)) || vs.find((vv) => (vv.lang || '').toLowerCase().startsWith('en')) || vs[0];
                };
                const v = pickVoice();
                if (v) {
                    u.voice = v;
                    window.speechSynthesis.speak(u);
                } else {
                    let done = false;
                    const fire = () => {
                        if (done) return;
                        done = true;
                        window.speechSynthesis.onvoiceschanged = null;
                        const v2 = pickVoice();
                        if (v2) u.voice = v2;
                        window.speechSynthesis.speak(u);
                    };
                    window.speechSynthesis.onvoiceschanged = fire;
                    setTimeout(fire, 1200);
                }
            } catch (e) { console.warn('meditation TTS failed:', e); finish(); }
        },
        speakStopAll() {
            this.mdLog('STOP: dropping queue (' + this.speakQueue.length + ' queued)');
            this.speakQueue = [];
            this.speakGen += 1;
            this.speakingNow = false;
            this.syncSpeaking();
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
               wipe the background prefetch too: drop the render map FIRST so
               the render_aborted from the cancel below is ignored, then tell
               the worker to stop burning synth time on dead lines */
            for (const rid of Object.keys(this.speechRenders)) {
                const it = this.speechRenders[rid];
                if (it && it.tmo) clearTimeout(it.tmo);
                delete this.speechRenders[rid];
            }
            this.bgQueue = [];
            this.bgRid = '';
            if (this.kokoroStream) {
                /* release the awaiting kokoroSpeak so its async chain
                   does not hang on a cancelled line */
                const s = this.kokoroStream;
                this.kokoroStream = null;
                this.genActive = false;
                this.pumpBg();
                try { s.resolve(); } catch (e) {}
            }
            if (this.kokoroTts) { try { this.kokoroTts.postMessage({ action: 'cancel' }); } catch (e) {} }
            for (const src of (this.kokoroSrcs || [])) { try { src.stop(); } catch (e) {} }
            this.kokoroSrcs = [];
            if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
        },
        restartSpeakLoop() {
            if (this.speakT) { clearInterval(this.speakT); this.speakT = null; }
            if (this.speakLoop && this.active && !this.muted) {
                this.speakT = setInterval(() => {
                    if (!this.speakLoop || !this.active || this.muted || this.ending) return;
                    if (this.speakingNow || this.speakQueue.length) return;
                    this.speakNow(this.speakLoop);
                }, (this.speakLoop.gap || 20) * 1000);
            }
        },

        /* ---------------- user actions ---------------- */
        endSession() {
            if (!this.active || this.ending) return;
            this.ending = true;
            this.intFrom = Math.max(this.intensity, 0.05);
            this.endSecs = 12;
            this.speakStopAll();
            this.speakLoop = null;
            this.ambStopAll();
            fetch('/api/ext/meditation/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ending: true, secs: 12 })
            }).catch(() => {});
        },
        meditaKeys(e) {
            if (!this.active || this.ending) return;
            if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
            const t = e.target;
            const editable = t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
            if (e.key === 'Escape' && !editable) {
                e.preventDefault();
                this.endSession();
            }
        }
    }));
});

/* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
   shared helper for the sidebar tab (no Alpine scope needed) -- */
let mdComp = null;
window.meditation = {
    comp() { return mdComp; },
    state() {
        return fetch('/api/ext/meditation/state?events=0').then((r) => r.json()).then((j) => ((j && j.data) || {})).catch(() => null);
    },
    control(payload) {
        return fetch('/api/ext/meditation/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(() => { window.dispatchEvent(new CustomEvent('md-refresh')); }).catch(() => {});
    },
    stop() {
        return fetch('/api/ext/meditation/stop', { method: 'POST' })
            .then(() => { window.dispatchEvent(new CustomEvent('md-refresh')); return true; })
            .catch(() => true);
    }
};
