---
name: remotion-video
description: Author complete, long-form Remotion films (kinetic typography, procedural audio, CSS-3D) from a sandboxed agent with no shell, collaborating with a human who runs npm itself.
---
<!-- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-02) harness:openlumara -->
# Remotion Video Authoring (Agent Edition)

A field-tested playbook for building full music-driven videos in Remotion when **you write all the code but the human runs npm**. Everything here was learned building a 22-scene, 484-second kinetic-typography film with a fully procedural soundtrack — no audio files, no shell access.

## When to use this skill

- User asks for a video/film/animation made with Remotion (or accepts it as the tool)
- Long-form narrative video with synced text, music, and sound design
- You (the agent) edit code in a sandbox; the user runs `npm run studio` / `npm run render`

## The operating model (internalize first)

1. **You are the author, the human is the runtime.** They start the studio, scrub, render, and tell you what it *feels* like. Your job is to translate vibe words ("too jumpy", "much better!") into frame-exact changes.
2. **Report at scene + second level.** Never say "fixed the camera." Say: "Scene 9 (0:00–0:28): the zoom into 'quiet' now holds for 2 s before gliding — check 0:12."
3. **Iterate in passes, not do-overs:** structure → choreography → fixes/polish (audio beds, grade, credits). Ship a rough full cut early; polish beats re-planning.
4. **Studio hard-refresh after audio changes.** Synths/WAV buffers built at module load do NOT rebuild on hot reload. A stale tab is the #1 cause of "I changed the sound and nothing happened."

## Project structure that scales

```
src/
  MyFilm.tsx          # <Composition> registration, total duration
  film/
    constants.tsx     # STARTS, durations, palette, T(), MASTER volume
    audio.ts          # procedural WAV data-URI synths + foley event table
    ui.tsx            # shared primitives: Camera, Halo, Underline, Line/tokens, Narration
    scenesA.tsx / scenesB.tsx / scenesC.tsx   # scenes split ~8 per file
```

### Non-negotiable core rules

- **Frames are pure functions of the frame number.** Remotion renders frames in parallel and out of order. NEVER `Math.random()`. Use a deterministic hash:
  ```ts
  const rand = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  ```
- **fps-agnostic timing.** Write `T(seconds)` once (`Math.round(seconds * fps)`) and express ALL timing in seconds. You will thank yourself when the user changes fps.
- **One MASTER volume bus** multiplied into every `<Audio>`. Volume complaints then take one edit.
- **Central STARTS table** `{ s01: 0, s02: 28, ... }` — scene durations derived from it, never hardcoded per scene.

## Procedural audio without audio files

Generate PCM WAVs in JS at module load, ship as data URIs. Zero assets, fully deterministic.

```ts
// Render samples -> 16-bit PCM WAV -> base64 data URI
const wav = (durSec: number, fn: (t: number, i: number) => number, rate = 28000): string => {
  const n = Math.floor(durSec * rate);
  const buf = new ArrayBuffer(44 + n * 2); const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, fn(i / rate, i)));
    v.setInt16(44 + i * 2, s * 32767, true);
  }
  let bin = ''; const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
};
```

Recipes that worked:

- **Seamless loops:** integer number of cycles per loop length (loopDur * freq ∈ ℤ), and round loop length to a multiple of 128 samples. For airy pads, play **twin copies of the buffer phase-offset from each other** — beats the audible loop point without longer buffers.
- **Percussion/foley = additive synths, not samples.** `sin(2π·f·t) · decay(t, k)` layers. Example typewriter key (gentle, felt-damped):
  ```ts
  // thunk (low body) + key (pitch) + clack (noise transient) + paper (high tick)
  render(0.08, t => (
    Math.sin(2*Math.PI*f*0.33*t) * decay(t,110) * 0.5 +
    Math.sin(2*Math.PI*f*t)     * decay(t,420) * 0.22 +
    (rand(seed)*2-1)            * decay(t,1100)* 0.12 +   // noise = transient
    Math.sin(2*Math.PI*f*2.7*t) * decay(t,700) * 0.05
  ) * 0.5);
  ```
  Noise transients are what make synthesized sounds read as *real*. Pure sine stacks read as *beeps*.
- **Central foley event table:** `[{ at: 12.5, src: TICK_A, vol: 0.07 }, ...]` → map to `<Audio startFrom/useCurrentFrame>` inside `<Sequence>`. One place to see, hear, and timing-fix the entire sound design.
- **Ambient beds:** a `Murmur`-style component = looping wav `<Sequence>` from the scene start + volume envelope (0 → 0.14 → 0 × MASTER) + sparse event "pings" at `t = start + i*1.7` s. Better than a wall of one-shot ticks.
- **Consistency requests are literal.** "Same pitch every time" = one URI + fixed `volume` — remove volume AND playbackRate jitter, and any per-instance `rand()`. If it "still sounds randomised" after your edit, suspect a stale studio tab before re-editing.

## Camera engine: zoom-to-focus-and-HOLD

For kinetic typography, the camera is the conductor. Rules that survived 3 redesign passes:

1. **Every camera key is an emphasis anchor** — comment each key with the Halo/word/beat it serves. No decorative keys.
2. **No `stay`/noop keys.** An anchor holds by itself: the camera sits at key N until the glide out of key N begins. Extra 'stay' keys just create micro-stops.
3. **Glide duration formula** (long enough to feel smooth, short enough to hold, always leaves ≥2 s of stillness):
   ```ts
   const glide = Math.min(Math.max(gap * 0.55, T(1.2)), T(2.6), gap - T(2));
   const moveStart = Math.max(keyT - glide, prevMoveEnd + T(2));
   ```
4. **Depart from current position, ease in-out** (cubic `3p²-2p³` or spring). Never teleport — a snap reads as a bug, even on beat. If the user says "no camera snaps," check for keys whose glide overlaps the previous key's arrival.
5. **Frame-fill clamp** so a zoomed camera never shows the void:
   ```ts
   const xc = clamp(x, 960 / s, 1920 - 960 / s);  // and same for y with 1080
   ```
   Apply AFTER computing the anchor position, and make sure scene content respects the same safe margins.

## Text, emphasis, and narration

- **Emphasis overlays live INSIDE the text element** (`Halo`, `Underline` as children/siblings sharing the transform). Screen-space overlays drawn above the camera drift out of alignment the moment the camera moves — this was the single most expensive choreography bug of the project.
- **Narration/captions go on a fixed layer ABOVE the camera** (`position: absolute; inset: 0`, outside the transformed container), so camera moves never drag them around.
- **Float/bob animations need a fixed containing block.** Wrap full-size elements with `position:absolute; inset:0` and animate `translate3d` on the wrapper — animating a static full-size element causes layout jumps. Organic motion = sum of two sines with coprime periods (e.g. 8 s + 13 s, amplitudes 3.4 px + 1.8 px); a single sine looks mechanical.
- **Per-token word sync.** Split lines into tokens; reveal token *i* at:
  ```ts
  const wordAt = (from: number, i: number, wps: number) => from + 0.2 + i / wps;  // wps = words per second
  ```
  One `<Audio>` per token (single URI, fixed volume ≈ 0.07 × MASTER). Emphasized tokens additionally get a hit sound (~0.11 × MASTER) + an expanding ring `<span>`.
- **Gradient text in headless renders** needs ALL of these or you get a solid gradient *rectangle* over nothing:
  ```ts
  { background: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }
  ```
  The studio can forgive missing prefixes; the headless render cannot. Check gradient text in the actual mp4.
- **CSS 3D over three.js.** `perspective` + `translateZ/rotate3d` on divs gives you real depth for typographic films with correct font rendering, no WebGL, and trivially deterministic frames. Only reach for WebGL if you genuinely need meshes.

## Headless render gotchas (`npm run render` ≠ studio)

| Symptom | Cause | Fix |
|---|---|---|
| Emoji render as tofu (□) | Headless Chromium on Linux has no color-emoji font | `apt install fonts-noto-color-emoji` / `pacman -S noto-fonts-emoji` / `dnf install google-noto-color-emoji-font` — or inline SVG instead |
| Gradient text = solid block | Missing `backgroundClip`/`WebkitTextFillColor` | See snippet above |
| Sound unchanged after edits | WAVs built at module load; hot reload kept them | Hard-refresh the studio tab |
| Frames flicker between renders | `Math.random()` in render path | Deterministic `rand(seed)` hash |

## Editing without a shell — tool discipline

- `coder_file_edit` (and friends) match **exact substrings including indentation**. Read the region before editing; anchor on distinctive lines.
- **Emoji in `original_code` break anchor matching** — anchor around them instead.
- Split large scenes across files (≤ ~1200 lines/file) so reads, greps, and edits stay cheap.
- Re-read (or rely on auto-syntax-check) after every edit; never batch three blind edits into one file.

## Working with your human

- They own: `npm run studio`, `npm run render`, browser, taste. You never run these.
- After each pass, deliver a **review script**: "Scene 14 (3:12–3:40): check the hold after 'bloom'; Scene 3: tick volume."
- Ask **closed vibe questions**: "Does the zoom rest long enough, or feel rushed?" — not "thoughts?"
- When they say "much better!", freeze that pattern and document it (comments at every formula) before moving on.
- Keep an issues log in the README (symptom → cause → fix) — it becomes the troubleshooting section for the next film, for you or for them.

## Pre-final checklist (run it explicitly)

- [ ] No camera snaps (every transition eased, ≥2 s hold per anchor)
- [ ] No black edges at max zoom (clamp verified at peak scale)
- [ ] Gradient text correct **in the rendered mp4**, not just studio
- [ ] All emoji render (or fonts installed / SVG'd)
- [ ] Audio: one MASTER bus, event table reviewed scene-by-scene, loops seamless at the scene seams
- [ ] Word sync: tokens appear ≤ a few frames from their tick; narration matches TTS/reading pace
- [ ] `npm run render` output checked end-to-end at 1×, not spot-checked
- [ ] README updated: how to run, troubleshooting, scene map

---

*The film is the render. Every rule above exists because it was broken at least once and cost a full review pass.*
