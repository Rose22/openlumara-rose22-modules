/* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
   kokoro neural TTS worker: the
   model lives off the main thread so synthesis never freezes the UI.
   lives under assets/kokoro/ on purpose - the webui only auto-injects
   assets/js/*.js, and this file must NOT run on the main thread.
   rebuilt 2026-10-09 with latency tuning: ellipsis-aware splitter with
   smaller chunks (wasm first-sound is much sooner), webgpu probe logs
   and a crossOriginIsolated diagnostic.
   messages: {action:'init', data:{modelId, voicePath?}} ->
             {action:'inited', success, engine, error?}
             {action:'gen', data:{text, voice, speed, requestId}} ->
             {action:'chunk', requestId, index, samples, sampleRate} * N
             {action:'chunk_end', requestId} | {action:'chunk_err', requestId, error}
   streaming: text is split into sentence-ish chunks and each one is
   posted as raw Float32 samples the moment it is synthesized, so the
   first sounds land while later sentences are still rendering */

let tts = null;
let ready = false;
let engine = '';
let lastErr = null;
let currentRid = null;
/* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
   courtesy yield token for background renders. live gen bumps it so an
   in-flight render_stream quits at its next chunk boundary; it is NOT a
   queue (the serialized-queue design was a measured regression, see
   meditation v5) - jobs still start the instant they arrive. */
let bgToken = 0;
/* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
   master debug switch: BH_DEBUG=false silences every console.log
   tracer in this worker; console.warn diagnostics always survive */
const BH_DEBUG = true;
const bhLog = (...a) => { if (BH_DEBUG) console.log(...a); };

/* latency-first splitter, punctuation-preserving.
   -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
   fragments KEEP their ending punctuation: the old splitter cut "..."
   off the front fragment, so the model lost its breath cue and the
   first phrase came out intonation-flat. mechanics:
   - digit-dot-digit (3.5, 2.000) is shielded first so decimals never split
   - split points: end-of-sentence punctuation followed by whitespace,
     and any dot-run (2+ dots) or ellipsis char anywhere (built via
     fromCharCode so no unicode literals live in this file)
   - empties can't occur: dot-runs are consumed by the split match and
     every fragment is trimmed + filtered
   - first chunk stays tiny (fast first sound); later chunks go up to
     120 chars because every generate() call carries fixed overhead on
     wasm - one big chunk beats three small ones once audio is playing */
const BH_ELL = String.fromCharCode(8230) + String.fromCharCode(8279);
const BH_DEC_RE = new RegExp('(\\d)[.](\\d)', 'g');
const BH_SHLD = String.fromCharCode(1);
/* pure LOOKBEHIND for dot-runs: the split lands AFTER the dots, so each
   phrase keeps its own breath mark - "Hello... Rosie..." becomes
   ["Hello...", "Rosie..."], never a leading "..." on the next chunk */
/* the (?!\.) / negative guards are essential: without them the
   lookbehind also fires mid-run (after 2 of 3 dots), slicing the dot-run
   itself and leaving a lone "." fragment */
const BH_SPLIT_RE = new RegExp('(?<=[' + BH_ELL + ']+)(?![' + BH_ELL + '])|(?<=\\.{2,})(?!\\.)|(?<=[.!?])\\s+', 'g');
function bhSplit(text) {
    const shielded = String(text).replace(BH_DEC_RE, '$1' + BH_SHLD + '$2');
    const parts = shielded.split(BH_SPLIT_RE);
    /* one breath phrase per chunk (Rosie's spec): every ellipsis and every
       sentence end is a hard split, fragments are NOT merged - each phrase
       gets its own natural intonation contour, which is the point of the
       delivery. only guard: a lone fragment under ~15 chars (stray "ok"
       style debris) is folded into its neighbour so the model never
       renders a useless micro-chunk */
    const frags = [];
    for (let i = 0; i < parts.length; i += 1) {
        const p = String(parts[i] || '').split(BH_SHLD).join('.').trim();
        if (p) frags.push(p);
    }
    const out = [];
    for (let i = 0; i < frags.length; i += 1) {
        if (frags[i].length < 5) {
            if (out.length) { out[out.length - 1] = out[out.length - 1] + ' ' + frags[i]; continue; }
            if (i + 1 < frags.length) { frags[i + 1] = frags[i] + ' ' + frags[i + 1]; continue; }
        }
        out.push(frags[i]);
    }
    /* first chunk still a wall (a run-on with no punctuation anywhere)?
       cut at its first comma/colon so audio starts while the rest renders */
    if (out.length && out[0].length > 80) {
        const m = out[0].match(/^[^,;:]{40,80}[,;:]/);
        if (m) {
            const cut = m[0].length - 1;
            const head = out[0].slice(0, cut);
            out[0] = out[0].slice(cut + 1).trim();
            out.unshift(head);
        }
    }
    return out.length ? out : [String(text)];
}

/* pinned versions: stock kokoro-js 1.2.1 (all 28 v1.0 voices incl.
   af_nicole, fetched from the model repo - no voicePath needed);
   it wants transformers ^3.5.1, which pins a DEV onnxruntime-web
   string - do NOT sanitize it or jsDelivr 404s the dist. */
const LIB_ESM = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const TF_ESM = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/+esm';
const ORT_WASM_URLS = [
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/'
];

async function tryConfig(mod, modelId, voicePath, device, dtype) {
    const opts = { dtype: dtype, device: device };
    /* voicePath only matters for forks (e.g. the zh one); stock v1.0
       fetches its voices from the model repo automatically. */
    if (voicePath) opts.voicePath = voicePath;
    const inst = await mod.KokoroTTS.from_pretrained(modelId, opts);
    /* warm-up: some backends only truly fail on first inference */
    await inst.generate('ok', { voice: 'af_nicole', speed: 1 });
    return { inst: inst, name: device + '/' + dtype };
}

async function initAll(data) {
    /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
       ladder per Rosie's spec: webgpu/fp16 first (cheap capability check
       fails in ~130ms where unsupported), then the wasm quant ladder.
       no fp32 anywhere - far too heavy for a voice that must be quick */
    const tries = [
        { device: 'webgpu', dtype: 'fp16' },
        { device: 'wasm', dtype: 'q4' },
        { device: 'wasm', dtype: 'q8' },
        { device: 'wasm', dtype: 'fp16' }
    ];
    let gpuProbed = false;
    let gpuOk = false;
    const probeGpu = async () => {
        gpuProbed = true;
        if (!(typeof navigator !== 'undefined' && navigator.gpu && typeof navigator.gpu.requestAdapter === 'function')) {
            bhLog('[speak] worker: no navigator.gpu in this browser - CPU-only. try chrome/edge with hardware acceleration enabled');
            return;
        }
        /* ask explicitly for the discrete GPU: a default request can come
           back null on multi-GPU or freshly-started browser setups. then
           retry once after a beat: the GPU process may still be waking
           up, and Chrome caches a null adapter for the worker's lifetime */
        const probe = async (opts) => {
            try { return await navigator.gpu.requestAdapter(opts); } catch (e) { return null; }
        };
        let adapter = await probe({ powerPreference: 'high-performance' });
        if (!adapter) adapter = await probe({});
        if (!adapter) {
            bhLog('[speak] worker: adapter null, retrying in 5s (GPU process may still be waking up)...');
            await new Promise((r) => setTimeout(r, 5000));
            adapter = await probe({ powerPreference: 'high-performance' });
        }
        gpuOk = !!adapter;
        if (gpuOk) {
            bhLog('[speak] worker: webgpu adapter found - GPU tier armed');
        } else {
            bhLog('[speak] worker: requestAdapter() stayed null - Chrome refuses the GPU. check chrome://gpu (Hardware Acceleration must say enabled) and webgpureport.org; if this page is NOT opened as localhost or https, WebGPU is blocked by the browser: access it via http://localhost or enable unsafe-secure-origin for the LAN address');
        }
    };
    bhLog('[speak] worker: crossOriginIsolated=' + (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) + ' (false = wasm runs single-threaded)');
    const mod = await import(LIB_ESM);
    const tf = await import(TF_ESM);
    tf.env.allowLocalModels = false;
    /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
       threads, explicitly: with cross-origin isolation the wasm backend
       gets SharedArrayBuffer, but its default thread count is conservative.
       claim most of the machine and cap it there - every extra wasm thread
       carries its own stack, and quantized kokoro saturates well before
       8 threads pay for that memory. simd stays on regardless. */
    try {
        const wasm = tf.env.backends.onnx.wasm;
        const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
        const want = Math.max(1, Math.min(8, cores - 1));
        wasm.simd = true;
        wasm.numThreads = want;
        /* proxy lets ort keep the WASM instance off the worker's main
           thread, which is what makes multi-threaded inference actually
           parallel instead of time-sliced */
        try { wasm.proxy = true; } catch (e) {}
        bhLog('[speak] worker: wasm threads=' + want + ' of ' + cores + ' cores (simd=' + wasm.simd + ') crossOriginIsolated=' + (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated));
    } catch (e) {
        console.warn('[speak] worker: wasm thread config failed (staying single-threaded):', e);
    }
    /* onnxruntime-web resolves its .wasm binaries relative to the script
       by default; via a CDN + worker that lands on 404s ("no available
       backend found"). pin them to jsDelivr explicitly, first URL matching
       the pinned transformers version, second a stable fallback. */
    lastErr = null;
    for (const wasmBase of ORT_WASM_URLS) {
        try { tf.env.backends.onnx.wasm.wasmPaths = wasmBase; } catch (e) { console.warn('kokoro-worker: wasmPaths set failed:', e); }
        for (const c of tries) {
            if (c.device === 'webgpu') {
                /* one adapter probe per init; no adapter = skip straight
                   to the wasm ladder */
                if (!gpuProbed) await probeGpu();
                if (!gpuOk) continue;
            }
            const t0 = performance.now();
            try {
                const won = await tryConfig(mod, data.modelId, data.voicePath, c.device, c.dtype);
                tts = won.inst;
                engine = won.name + ' @ ort ' + wasmBase.split('/onnxruntime-web@')[1].split('/')[0];
                ready = true;
                bhLog('[speak] worker: won with ' + engine + ' after ' + Math.round(performance.now() - t0) + 'ms');
                return engine;
            } catch (e) {
                lastErr = e;
                console.warn('kokoro-worker config failed (' + c.device + '/' + c.dtype + ', ' + Math.round(performance.now() - t0) + 'ms): ' + String((e && e.message) || e).slice(0, 120));
            }
        }
    }
    throw (lastErr || new Error('no working kokoro config'));
}

self.onmessage = async function (e) {
    const d = e.data || {};
    if (d.action === 'init') {
        try {
            const eng = await initAll(d.data || {});
            self.postMessage({ action: 'inited', success: true, engine: eng });
        } catch (err) {
            ready = false;
            self.postMessage({ action: 'inited', success: false, error: String((err && err.message) || err).slice(0, 140) });
        }
    } else if (d.action === 'gen') {
        const rid = d.data.requestId;
        currentRid = rid;
        /* live speech outranks everything: bumping the token asks any
           in-flight background render to bow out at its next boundary */
        bgToken += 1;
        try {
            if (!ready || !tts) throw new Error('kokoro not initialized');
            const chunks = bhSplit(d.data.text);
            /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
               overlap proof: tReq anchors every worker line to the instant the
               gen request landed. the main thread's [speak +Nms] logs run ~1ms
               later off the same wall clock, so the two sets interleave in the
               console in true chronological order. RENDER START printing BEFORE
               the await, landing between the main thread's PLAY START lines for
               earlier chunks, IS the proof render+playback run concurrently. */
            const tReq = performance.now();
            bhLog('[speak] worker RENDER QUEUE opened: ' + chunks.length + ' phrase(s) [' + String(d.data.text || '').slice(0, 40) + ']');
            for (let i = 0; i < chunks.length; i += 1) {
                /* a newer line replaced us mid-stream: stop synthesizing */
                if (currentRid !== rid) return;
                const t1 = performance.now();
                bhLog('[speak] worker +' + Math.round(t1 - tReq) + 'ms RENDER START ' + (i + 1) + '/' + chunks.length + ' [' + String(chunks[i]).slice(0, 50) + ']');
                const audio = await tts.generate(String(chunks[i]), {
                    voice: d.data.voice,
                    speed: d.data.speed || 1
                });
                if (currentRid !== rid) return;
                const samples = audio.audio instanceof Float32Array ? audio.audio : new Float32Array(audio.audio);
                bhLog('[speak] worker +' + Math.round(performance.now() - tReq) + 'ms RENDER END ' + (i + 1) + '/' + chunks.length + ' synth=' + Math.round(performance.now() - t1) + 'ms audio=' + Math.round(samples.length / (audio.sampling_rate || 24000)) + 's -> posted');
                self.postMessage({ action: 'chunk', requestId: rid, index: i, samples: samples, sampleRate: audio.sampling_rate || 24000 }, [samples.buffer]);
            }
            self.postMessage({ action: 'chunk_end', requestId: rid });
        } catch (err) {
            self.postMessage({ action: 'chunk_err', requestId: rid, error: String((err && err.message) || err).slice(0, 140) });
        }
    } else if (d.action === 'cancel') {
        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
           client-side stop: kill the live stream AND make background
           renders abort instead of finishing work nobody will play */
        currentRid = null;
        bgToken += 1;
    } else if (d.action === 'render_stream') {
        /* -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
           streaming background render for the one-line lookahead: chunks
           post as they synthesize (like gen) but this NEVER touches
           currentRid. bgToken is a courtesy yield, not a queue: when a
           live line arrives the render quits at its next chunk boundary
           so the CPU is never split against speech she is about to hear */
        const rid = d.data.requestId;
        const myTok = bgToken;
        try {
            if (!ready || !tts) throw new Error('kokoro not initialized');
            const parts = bhSplit(d.data.text);
            for (let i = 0; i < parts.length; i += 1) {
                if (myTok !== bgToken) { self.postMessage({ action: 'render_aborted', requestId: rid }); return; }
                const t1 = performance.now();
                const audio = await tts.generate(String(parts[i]), { voice: d.data.voice, speed: d.data.speed || 1 });
                if (myTok !== bgToken) { self.postMessage({ action: 'render_aborted', requestId: rid }); return; }
                const s = audio.audio instanceof Float32Array ? audio.audio : new Float32Array(audio.audio);
                bhLog('[speak] worker prefetch chunk ' + (i + 1) + '/' + parts.length + ' synth=' + Math.round(performance.now() - t1) + 'ms [' + String(parts[i]).slice(0, 50) + ']');
                self.postMessage({ action: 'render_chunk', requestId: rid, index: i, samples: s, sampleRate: audio.sampling_rate || 24000 }, [s.buffer]);
            }
            self.postMessage({ action: 'render_end', requestId: rid });
        } catch (err) {
            self.postMessage({ action: 'render_err', requestId: rid, error: String((err && err.message) || err).slice(0, 140) });
        }
    } else if (d.action === 'render') {
        /* one-shot offline render (whisper bed + line-cache prefetch):
           whole text in, one Float32 blob out. deliberately does NOT
           touch currentRid, so renders and live speech coexist instead
           of preempting each other */
        const rid = d.data.requestId;
        try {
            if (!ready || !tts) throw new Error('kokoro not initialized');
            const parts = bhSplit(d.data.text);
            const auds = [];
            let total = 0;
            let rate = 24000;
            for (let i = 0; i < parts.length; i += 1) {
                const audio = await tts.generate(String(parts[i]), { voice: d.data.voice, speed: d.data.speed || 1 });
                const s = audio.audio instanceof Float32Array ? audio.audio : new Float32Array(audio.audio);
                auds.push(s);
                total += s.length;
                rate = audio.sampling_rate || 24000;
            }
            const out = new Float32Array(total);
            let off = 0;
            for (const s of auds) { out.set(s, off); off += s.length; }
            self.postMessage({ action: 'render_ok', requestId: rid, samples: out, sampleRate: rate }, [out.buffer]);
        } catch (err) {
            self.postMessage({ action: 'render_err', requestId: rid, error: String((err && err.message) || err).slice(0, 140) });
        }
    }
};
