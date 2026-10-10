import core
import time
import os
import asyncio
import channels.webui.api as webui

# -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
# guided meditation overlay: a glowing breathing circle whose particles
# flow outward on the inhale and drift back on the exhale, binaural
# beats easing alpha -> theta, ambient sound loops shipped in
# webui/assets/audio, and a soft spoken guide voice.

# stock kokoro v1.0 voice names, used to validate the speak voice arg
KOKORO_VOICES = (
    "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore",
    "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
    "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael",
    "am_onyx", "am_puck", "am_santa",
    "bf_alice", "bf_emma", "bf_isabella", "bf_lily",
    "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
)

# ambient loop files the user drops into the module's audio folder
AUDIO_EXTS = (".mp3", ".ogg", ".wav", ".m4a", ".flac", ".webm", ".opus")

# -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
# scene environments, breathing-center shapes and named color themes
# citylights and lanterns removed 2026-10-10 at Rosie's request
SCENE_MODES = ("calm", "starfield", "fireflies", "petals", "deepsea", "snowfall", "rain", "glitterfall", "runes", "nebula", "sky")
# -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
# breathing-center shapes: flame, yantra (sri yantra-lite), hexagram
# and infinity (snowflake, bell and hourglass removed same day)
CENTER_SHAPES = ("circle", "lotus", "flame", "yantra", "hexagram", "infinity")
THEMES = {
    "rose quartz": {"color_core": "#ffc7dd", "color_glow": "#ff8fbf", "color_bg": "#2a1024", "color_text": "#ffeaf4"},
    "lavender dusk": {"color_core": "#cbb3ff", "color_glow": "#9d7bff", "color_bg": "#170f2e", "color_text": "#f1eaff"},
    "deep ocean": {"color_core": "#8fd6ff", "color_glow": "#3f8fd6", "color_bg": "#06182b", "color_text": "#e8f7ff"},
    "dawn peach": {"color_core": "#ffd9b8", "color_glow": "#ff9d6b", "color_bg": "#2b1410", "color_text": "#fff3e8"},
    "moonstone": {"color_core": "#9fd8ff", "color_glow": "#7b9cff", "color_bg": "#0d1530", "color_text": "#ffffff"},
    # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
    # five extra palettes: candy softness, aurora, deep-space color,
    # sea glass and gold-on-noir.
    "cotton candy": {"color_core": "#ffb3e2", "color_glow": "#b388ff", "color_bg": "#231038", "color_text": "#ffe9fb"},
    "aurora mint": {"color_core": "#9dffd8", "color_glow": "#4dc9ff", "color_bg": "#071a1e", "color_text": "#eafff7"},
    "nebula bloom": {"color_core": "#ff6ec7", "color_glow": "#7c4dff", "color_bg": "#0a0620", "color_text": "#fff0ff"},
    "sea glass": {"color_core": "#7fffd4", "color_glow": "#38b2ac", "color_bg": "#082019", "color_text": "#e6fff6"},
    "sunset ember": {"color_core": "#ffb86b", "color_glow": "#ff5e7a", "color_bg": "#1c0a14", "color_text": "#fff0e8"},
}
AUDIO_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "webui", "assets", "audio"
)


class Meditation(core.module.Module):
    """
    Runs guided meditations on a full-screen webui overlay: a breathing circle with particles that flow in and out with every breath, binaural beats, ambient sound loops from your own audio files, and a soft spoken guide voice.
    """

    settings = {
        "subject": {
            "description": "Name of the person meditating, used in prompts and on-screen text.",
            "default": "Rosie",
        },
        "instructions": {
            "description": "Extra instructions for the AI to follow during meditation sessions. Re-inserted with every decision the AI makes.",
            "default": "",
        },
        "max_session_minutes": {
            "type": "number",
            "description": "Minutes a session may run before it fades itself out automatically (0 disables the auto-fade). Gentle by design: everything dissolves instead of cutting.",
            "default": 60,
        },
        "max_opacity": {
            "type": "number",
            "description": "Hard ceiling for overlay opacity (0.1 to 1) at full intensity.",
            "default": 0.95,
        },
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
        # renamed from sound_enabled (which was already binaural-only);
        # ambient loops and breath audio have their own switches.
        "enable_binaurals": {
            "description": "Master switch for the binaural beats audio only. Ambient loops and breath sounds have their own settings.",
            "default": True,
        },
        "ambient_enabled": {
            "description": "Whether ambient sound loops are available. Loop files (mp3/ogg/wav/m4a/flac) live in user_modules/meditation/webui/assets/audio/ and are served straight to the overlay.",
            "default": True,
        },
        "ambient_volume": {
            "type": "number",
            "description": "Default ambient loop volume (0 to 100) when a session turns the ambience on without an explicit level.",
            "default": 35,
        },
        "enable_speech": {
            "description": "Whether to let the AI speak guided meditations using Text To Speech.",
            "default": True,
        },
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
        # synthesized inhale/exhale breath audio riding the breath clock
        "breath_sounds": {
            "description": "Soft synthesized breath audio: a wind-like swell on every inhale and a long falling sigh on every exhale, paced exactly with the circle.",
            "default": True,
        },
        "tts_engine": {
            "type": "select",
            "options": {
                "kokoro": "Browser-based speech synthesis using kokoro.js",
                "webspeech": "Your browser's native speech synthesis method",
            },
            "description": "Voice engine for the guide voice",
            "default": "kokoro",
            "depends": "enable_speech",
        },
        "default_voice": {
            "type": "select",
            "options": {v: v for v in KOKORO_VOICES},
            "description": "Default kokoro voice for the guide voice when the AI doesn't request a specific one.",
            "default": "af_nicole",
            "depends": "enable_speech",
        },
        "voice_rate_min": {
            "type": "number",
            "description": "Slowest speech rate (percent) the AI may use when speaking to you.",
            "default": 50,
            "depends": "enable_speech",
        },
        "voice_rate_max": {
            "type": "number",
            "description": "Fastest speech rate (percent) the AI may use when speaking to you.",
            "default": 160,
            "depends": "enable_speech",
        },
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        disabled = []
        if self.config.get("enable_speech") is False:
            disabled.append("speak")
        self.disabled_tools = disabled
        self._active = False
        self._pattern = {"in": 4.0, "hold": 7.0, "out": 8.0, "hold_out": 0.0}
        self._scene = {
            "color_core": "#9fd8ff", "color_glow": "#7b9cff",
            "color_bg": "#0d1530", "color_text": "#ffffff",
            "particles": 1.0, "vignette": -1, "bloom": -1,
            "mode": "calm", "shape": "circle",
            "dust": 0, "horizon": 0,
        }
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
        # speech handshake v2: the overlay acks a
        # speak line at dispatch (control speaking=true) and reports idle
        # (speaking=false) once it has fully played out, so the speak tool
        # waits for the PREVIOUS line to finish before handing back
        self._speak_busy = False
        self._speak_busy_at = 0.0
        self._speak_gen = 0
        self._speak_ack_gen = 0
        self._poll_count = 0
        self._bin = {"on": True, "auto": True, "mode": "binaural", "base": 220, "beat": 10.0, "vol": 28}
        self._ambient = {"on": False, "track": "", "vol": int(self.config.get("ambient_volume") or 35)}
        self._speak = None
        self._events = []
        self._session_started = 0
        self._ending = False
        self._end_secs = 30
        self._end_started = 0

    def _subject(self):
        name = self.config.get("subject")
        return str(name).strip() if name else "Rosie"

    # ------------------------------------------------------------------
    # breathing pattern + session plumbing
    # ------------------------------------------------------------------

    def _apply_pattern(self, b_in, b_hold, b_out, b_hold_out):
        # clamped pattern with safe fallbacks: in and out must exist,
        # holds are optional; the frontend re-syncs its breath clock
        # whenever the pattern payload changes
        def num(value, dflt):
            try:
                return max(0.0, min(30.0, float(value)))
            except (TypeError, ValueError):
                return dflt
        b_in = num(b_in, 4.0)
        b_hold = num(b_hold, 0.0)
        b_out = num(b_out, 6.0)
        b_hold_out = num(b_hold_out, 0.0)
        if b_in < 1.0:
            b_in = 4.0
        if b_out < 1.0:
            b_out = 6.0
        self._pattern = {"in": b_in, "hold": b_hold, "out": b_out, "hold_out": b_hold_out}
        return self._pattern

    def _pattern_text(self):
        p = self._pattern
        parts = [str(self._fmt_secs(p["in"])) + " in"]
        if p["hold"] > 0:
            parts.append("hold " + self._fmt_secs(p["hold"]))
        parts.append(str(self._fmt_secs(p["out"])) + " out")
        if p["hold_out"] > 0:
            parts.append("hold " + self._fmt_secs(p["hold_out"]))
        return " · ".join(parts)

    @staticmethod
    def _fmt_secs(value):
        v = float(value)
        return str(int(v)) if abs(v - int(v)) < 0.01 else str(round(v, 1))

    def _time_up(self):
        if not self._active or self._ending or not self._session_started:
            return False
        try:
            limit = float(self.config.get("max_session_minutes"))
        except (TypeError, ValueError):
            limit = 60.0
        return limit > 0 and time.time() - self._session_started > limit * 60

    def _session_note(self):
        if not self._active or not self._session_started:
            return ""
        elapsed = time.time() - self._session_started
        el = str(int(elapsed // 60)) + "m" + str(int(elapsed % 60)).zfill(2) + "s"
        return " [session " + el + " elapsed]"

    def _stop_all(self, reason="stopped"):
        self._active = False
        self._ending = False
        self._end_started = 0
        self._bin["on"] = False
        self._ambient["on"] = False
        self._speak = None
        self._events = []
        self._session_started = 0
        # release any speak call still waiting on the browser
        self._speak_busy = False
        self._speak_busy_at = 0.0
        self.log("meditation", "session ended (" + str(reason)[:60] + ")")

    def _begin_end(self, seconds, final_words="", reason=""):
        try:
            secs = max(5.0, min(180.0, float(seconds)))
        except (TypeError, ValueError):
            secs = 30.0
        self._ending = True
        self._end_secs = secs
        self._end_started = time.time()
        self._speak = None
        self._ambient["on"] = False
        # release any speak call still waiting on the browser
        self._speak_busy = False
        self._speak_busy_at = 0.0
        if str(final_words or "").strip():
            self._events.append({"t": "end_words", "text": str(final_words).strip()[:160]})
        if reason:
            self.log("meditation", "fading out: " + reason)

    def _guard(self):
        # shared refusal text for every session tool while ending/time-up
        if self._ending:
            return "The meditation is already fading out - let " + self._subject() + " come back gently. Nothing changed." + self._session_note()
        if self._time_up():
            return "Session time is up and the overlay is fading out on its own. Say a few warm closing words." + self._session_note()
        return None

    def _nudge(self):
        subj = self._subject()
        return (" [KEEP GUIDING] " + subj + " is mid-meditation RIGHT NOW. Keep weaving "
                "soft spoken lines between your tool calls, pacing around the breath cycle. "
                "Do NOT end the session until " + subj + " asks to stop or you have genuinely "
                "completed the meditation - then use end to fade everything out gently."
                + self._session_note())

    def _clean_color(self, value, fallback):
        value = str(value).strip()[:30]
        if not value:
            return fallback
        if value.startswith("#") and len(value) in (4, 5, 7, 9):
            return value
        safe = "abcdefghijklmnopqrstuvwxyz0123456789-()"
        if all(ch in safe for ch in value.lower().replace("rgba", "").replace("rgb", "")):
            return value
        return fallback

    def _list_tracks(self):
        try:
            return sorted(
                name for name in os.listdir(AUDIO_DIR)
                if name.lower().endswith(AUDIO_EXTS)
                and os.path.isfile(os.path.join(AUDIO_DIR, name))
            )
        except OSError:
            return []

    # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
    # system prompt is a pure listing of what exists - scenes, shapes,
    # themes, sounds, voices. no instructions; the tool docstrings
    # carry all guidance.
    async def on_system_prompt(self):
        tracks = self._list_tracks() if self.config.get("ambient_enabled") is not False else []
        voices = "af_nicole, af_sarah, af_heart, af_bella, am_*, bf_*, bm_*"
        try:
            rlo, rhi = int(self.config.get("voice_rate_min")), int(self.config.get("voice_rate_max"))
        except (TypeError, ValueError):
            rlo, rhi = 50, 160
        lines = [
            "Scenes: " + ", ".join(SCENE_MODES),
            "Center shapes: " + ", ".join(CENTER_SHAPES),
            "Themes: " + ", ".join(THEMES.keys()),
            "Ambient sound loops: " + (", ".join(tracks) if tracks else "none (audio folder is empty)"),
            "Binaural beat modes: binaural, isochronic, both",
            "Guide voices (kokoro): " + voices,
            "Speech rate range: " + str(rlo) + " to " + str(rhi),
            # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
            # the one allowed directive: without this the AI narrates
            # meditation sessions as plain chat text and never speaks them.
            # phrasing matters because each speak call blocks until the
            # line has fully played - tiny fragments leave dead air.
            "During meditation sessions, deliver your guidance with the speak tool. Make each spoken line a full sentence or two at a slow, soothing pace. When choosing a scene, select an appropriate ambient sound loop.",
        ]
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # AI tools
    # ------------------------------------------------------------------

    async def start(self, breath_in: int, breath_hold: int, breath_out: int, breath_hold_out: int = 0, mode: str = "calm", shape: str = "circle", theme: str = "", color_core: str = "", color_glow: str = "", color_bg: str = "", dust: bool = False, horizon: bool = False, ambient_track: str = "", beats: bool = True):
        """
        Start (or re-shape) the guided meditation overlay with a breathing pattern YOU choose for this session. The center breathes with the pattern and the overlay counts every phase on screen, so the subject never has to count.

        Args:
            breath_in: seconds to breathe in, 1 to 20 (e.g. 4)
            breath_hold: seconds to hold after the inhale, 0 to 30 (e.g. 7, 0 for no hold)
            breath_out: seconds to breathe out, 1 to 30 (e.g. 8)
            breath_hold_out: seconds to hold empty after the exhale, 0 to 30 (0 for none)
            mode: scene environment - calm (plain starless void), starfield (twinkling stars, shooting stars on exhale), fireflies (lazy blinking lights), petals (falling blossom pushed by the breath), deepsea (rising bubbles + light shafts), snowfall (slow quiet snow), rain (raindrop beads sitting on window glass, blurred palette-colored rainfall behind), glitterfall (pink and gold glitter flashing as it tumbles), runes (a magic circle of glowing glyphs orbiting the center), nebula (drifting clouds of vivid cosmic color over a starfield), sky (bright blue daytime sky, drifting forward through fluffy white clouds)
            shape: breathing center - circle (glowing disc), lotus (blooms open on the inhale), flame (licks and flickers, grows on the inhale), yantra (sri yantra-lite: interlocking triangles on a bindu), hexagram (two slow counter-rotating triangles), infinity (the path itself lights up along the breath)
            theme: named color palette - 'rose quartz', 'lavender dusk', 'deep ocean', 'dawn peach', 'moonstone', 'cotton candy', 'aurora mint', 'nebula bloom', 'sea glass' or 'sunset ember'; empty keeps the current colors (an explicit color arg still wins over the theme)
            color_core: optional core color override (e.g. #9fd8ff)
            color_glow: optional glow + particle color override (e.g. #7b9cff)
            color_bg: optional background color override (e.g. #0d1530)
            dust: true for faint drifting dust motes in the air
            horizon: true for a soft glow along the bottom edge that brightens on the inhale
            ambient_track: ambient loop file name from the module's audio folder, 'auto' to pick one at random, empty for silence
            beats: true to start binaural beats that drift from alpha to theta as the session unfolds
        """
        tracks = self._list_tracks()
        track = str(ambient_track or "").strip().lower()
        if track and track not in ("auto", "all"):
            match = [t for t in tracks if t.lower() == track or os.path.splitext(t)[0].lower() == track]
            if not match:
                where = " (audio folder is empty - ask " + self._subject() + " to drop loop files into user_modules/meditation/webui/assets/audio/)" if not tracks else ""
                return "No ambient track named '" + ambient_track + "'. Available: " + (", ".join(tracks) if tracks else "none") + where
            track = match[0]
        if self._active and self._ending:
            self._ending = False
            self._end_started = 0
        p = self._apply_pattern(breath_in, breath_hold, breath_out, breath_hold_out)
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
        # scene mode, center shape, palette theme and optional layers
        m = str(mode or "").strip().lower()
        self._scene["mode"] = m if m in SCENE_MODES else "calm"
        sh = str(shape or "").strip().lower()
        self._scene["shape"] = sh if sh in CENTER_SHAPES else "circle"
        th = str(theme or "").strip().lower()
        if th in THEMES:
            self._scene.update(dict(THEMES[th]))
        self._scene["dust"] = 1 if dust else 0
        self._scene["horizon"] = 1 if horizon else 0
        if str(color_core or "").strip():
            self._scene["color_core"] = self._clean_color(color_core, self._scene["color_core"])
        if str(color_glow or "").strip():
            self._scene["color_glow"] = self._clean_color(color_glow, self._scene["color_glow"])
        if str(color_bg or "").strip():
            self._scene["color_bg"] = self._clean_color(color_bg, self._scene["color_bg"])
        self._bin["on"] = bool(beats) and self.config.get("enable_binaurals") is not False
        self._bin["auto"] = True
        if track:
            self._ambient["on"] = self.config.get("ambient_enabled") is not False
            self._ambient["track"] = track
        self._active = True
        if not self._session_started:
            self._session_started = time.time()
        return ("Meditation started: " + self._pattern_text() + ", scene "
                + self._scene["mode"] + " / " + self._scene["shape"]
                + (" / " + str(theme or "").strip().lower() if str(theme or "").strip().lower() in THEMES else "")
                + (", dust" if self._scene["dust"] else "")

                + (", horizon" if self._scene["horizon"] else "")
                + ", beats "
                + ("on (auto drift)" if self._bin["on"] else "off") + ", ambience "
                + (self._ambient["track"] if self._ambient["on"] and self._ambient["track"] not in ("auto", "all")
                   else "auto-picked" if self._ambient["on"] else "off")
                + ". Begin the guided meditation now: slow, soft, short lines." + self._nudge())

    async def set_breathing(self, breath_in: int, breath_hold: int, breath_out: int, breath_hold_out: int = 0):
        """
        Change the breathing pattern mid-session - the circle and the on-screen countdown re-sync instantly on the next breath. Use it to shift the session's energy (calmer, grounding, energizing).

        Args:
            breath_in: seconds to breathe in, 1 to 20
            breath_hold: seconds to hold after the inhale, 0 to 30
            breath_out: seconds to breathe out, 1 to 30
            breath_hold_out: seconds to hold empty after the exhale, 0 to 30
        """
        if not self._active:
            return "No active meditation. Start one with meditation_start."
        guarded = self._guard()
        if guarded:
            return guarded
        self._apply_pattern(breath_in, breath_hold, breath_out, breath_hold_out)
        return "New breathing pattern: " + self._pattern_text() + ". Announce the change softly before it lands." + self._nudge()

    # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
    # the standalone ambient tool is gone - the scene tool's
    # ambient_track / ambient_volume args cover soundscape control now.
    async def binaural(self, action: str, mode: str = "binaural", base_hz: int = 220, beat_hz: float = 10.0, volume: int = 0, auto: bool = True):
        """
        Control the binaural beat audio: binaural (left/right carriers, headphones ideal), isochronic (pulsing tone, fine on speakers) or both.

        Args:
            action: start, update or stop
            mode: binaural, isochronic or both
            base_hz: carrier frequency in Hz, 20 to 2000 (ignored when auto is true)
            beat_hz: beat frequency in Hz, 0.1 to 30 - e.g. 10 alpha calm, 6 light theta, 3 deep theta (ignored when auto is true)
            volume: 0 to 100 (ignored when auto is true)
            auto: true to let the session's elapsed time drift the beats from 10 Hz alpha down to 3 Hz theta; false for manual control
        """
        if not self._active:
            return "No active meditation."
        if action == "stop":
            self._bin["on"] = False
            return "Beat audio fading out."
        guarded = self._guard()
        if guarded:
            return guarded
        self._bin["on"] = True
        self._bin["auto"] = bool(auto)
        if mode in ("binaural", "isochronic", "both"):
            self._bin["mode"] = mode
        try:
            self._bin["base"] = max(20, min(2000, int(base_hz)))
        except (TypeError, ValueError):
            pass
        try:
            self._bin["beat"] = max(0.1, min(30.0, float(beat_hz)))
        except (TypeError, ValueError):
            pass
        try:
            v = int(volume)
            if 0 < v <= 100:
                self._bin["vol"] = v
        except (TypeError, ValueError):
            pass
        if self._bin["auto"]:
            return "Beats on auto: drifting 10 Hz alpha down to 3 Hz theta as the session deepens." + self._nudge()
        return "Beats now " + str(self._bin["base"]) + " Hz + " + str(self._bin["beat"]) + " Hz beat, volume " + str(self._bin["vol"]) + "/100." + self._nudge()

    async def scene(self, mode: str = "", shape: str = "", theme: str = "", color_core: str = "", color_glow: str = "", color_bg: str = "", color_text: str = "", particles: float = 0, vignette: int = -2, bloom: int = -2, dust: int = -2, horizon: int = -2, ambient_track: str = "", ambient_volume: int = 0):
        """
        Live-tune the scene: environments and shapes crossfade, colors glide smoothly. All args optional - empty string / -2 keeps the current value.

        Args:
            mode: scene environment - calm, starfield, fireflies, petals, deepsea, snowfall, rain, glitterfall, runes, nebula or sky (empty keeps current)
            shape: breathing center - circle, lotus, flame, yantra, hexagram or infinity (empty keeps current)
            theme: named palette - 'rose quartz', 'lavender dusk', 'deep ocean', 'dawn peach', 'moonstone', 'cotton candy', 'aurora mint', 'nebula bloom', 'sea glass', 'sunset ember'; colors glide over, explicit color args below still win
            color_core: core css color (e.g. #9fd8ff)
            color_glow: glow and particle css color (e.g. #7b9cff)
            color_bg: background wash css color (e.g. #0d1530)
            color_text: narration and countdown text color (e.g. #ffffff)
            particles: particle density multiplier 0.1 to 2 (0 to keep current, use 0.01 for nearly none)
            vignette: -1 auto (softens the edges), 0 off, 1 to 100 manual strength, -2 to keep current
            bloom: -1 auto halo of light around the circle, 0 off, 1 to 100 manual strength, -2 to keep current
            dust: 1 on, 0 off, -2 keep current (faint drifting dust motes)
            horizon: 1 on, 0 off, -2 keep current (soft glow along the bottom edge)
            ambient_track: switch the soundscape mid-session - a loop file name from the audio folder (with or without extension), 'auto' to random-pick one, 'off' for silence (empty keeps current)
            ambient_volume: ambient loop volume 0 to 100 (0 keeps current level)
        """
        if not self._active:
            return "No active meditation."
        guarded = self._guard()
        if guarded:
            return guarded
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
        # mode / shape / theme / optional layer toggles
        m = str(mode or "").strip().lower()
        if m in SCENE_MODES:
            self._scene["mode"] = m
        sh = str(shape or "").strip().lower()
        if sh in CENTER_SHAPES:
            self._scene["shape"] = sh
        th = str(theme or "").strip().lower()
        if th in THEMES:
            self._scene.update(dict(THEMES[th]))
        for key, val in (("dust", dust), ("horizon", horizon)):
            try:
                iv = int(val)
                if iv in (0, 1):
                    self._scene[key] = iv
            except (TypeError, ValueError):
                pass
        if str(color_core or "").strip():
            self._scene["color_core"] = self._clean_color(color_core, self._scene["color_core"])
        if str(color_glow or "").strip():
            self._scene["color_glow"] = self._clean_color(color_glow, self._scene["color_glow"])
        if str(color_bg or "").strip():
            self._scene["color_bg"] = self._clean_color(color_bg, self._scene["color_bg"])
        if str(color_text or "").strip():
            self._scene["color_text"] = self._clean_color(color_text, self._scene["color_text"])
        try:
            p = float(particles)
            if p > 0:
                self._scene["particles"] = max(0.01, min(2.0, p))
        except (TypeError, ValueError):
            pass
        try:
            v = int(vignette)
            if v >= -1:
                self._scene["vignette"] = max(-1, min(100, v))
        except (TypeError, ValueError):
            pass
        try:
            b = int(bloom)
            if b >= -1:
                self._scene["bloom"] = max(-1, min(100, b))
        except (TypeError, ValueError):
            pass
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-10)
        # the scene tool owns the soundscape entirely (the old ambient
        # tool is gone): 'off' stops the ambience, 'auto' random-picks,
        # a name starts that loop; a bad name keeps the current track
        # and reports what exists. ambient_volume adjusts the loop level.
        amb_note = ""
        try:
            av = int(ambient_volume)
            if 0 < av <= 100:
                self._ambient["vol"] = av
                amb_note += ", ambience volume " + str(av)
        except (TypeError, ValueError):
            pass
        amb = str(ambient_track or "").strip().lower()
        if amb:
            if amb in ("off", "silence", "none", "stop"):
                self._ambient["on"] = False
                self._ambient["track"] = ""
                amb_note += ", ambience off"
            elif amb in ("auto", "all"):
                self._ambient["on"] = self.config.get("ambient_enabled") is not False
                self._ambient["track"] = "auto"
                amb_note += ", ambience auto-picked"
            else:
                tracks = self._list_tracks()
                match = [t for t in tracks if t.lower() == amb or os.path.splitext(t)[0].lower() == amb]
                if match:
                    self._ambient["on"] = self.config.get("ambient_enabled") is not False
                    self._ambient["track"] = match[0]
                    amb_note += ", ambience " + match[0]
                else:
                    amb_note = " (no ambient track named '" + ambient_track + "'; available: " + (", ".join(tracks) if tracks else "none - audio folder is empty") + ")"
        return "Scene updated: core " + self._scene["color_core"] + ", glow " + self._scene["color_glow"] + ", particles " + str(self._scene["particles"]) + "x." + amb_note + self._nudge()

    async def _speak_handshake(self, gen: int, before_polls: int, hard_deadline: float):
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
        # stall a speak call until the overlay has
        # ACKED this line (ack fires at dispatch, so a still-loading kokoro
        # engine keeps the tool waiting through model init) and the voice
        # has gone idle again (line fully played out).
        # two clocks: the ack window slides +15s with every poll that
        # happened AFTER the append (earlier polls could not have seen the
        # line), the idle wait runs to the hard ceiling. the slide is
        # BOUNDED (8): the overlay polls forever, so an unbounded slide
        # would mean the ack window could never expire.
        # returns: "ok", "silent" (overlay never acked), "busy", "gone"
        slides_left = 8
        ack_deadline = time.time() + 15.0
        while time.time() < ack_deadline:
            if not self._active:
                return "gone"
            if self._speak_ack_gen >= gen:
                break
            if self._poll_count > before_polls and slides_left > 0:
                slides_left -= 1
                before_polls = self._poll_count
                ack_deadline = min(hard_deadline, time.time() + 15.0)
            await asyncio.sleep(0.25)
        if self._speak_ack_gen < gen:
            return "silent"
        while self._speak_busy and time.time() < hard_deadline:
            if not self._active:
                return "gone"
            # stale-busy watchdog: a refresh or worker death mid-line kills
            # the pending speaking=false POST (fetches die on unload) and the
            # flag then sticks true forever. after 3 minutes of claimed busy,
            # assume the POST was lost and clear it.
            if time.time() - self._speak_busy_at > 180.0:
                self.log("meditation", "stale speak-busy cleared (idle POST likely lost on refresh)")
                self._speak_busy = False
                break
            await asyncio.sleep(0.3)
        return "ok" if not self._speak_busy else "busy"

    async def speak(self, text: str, rate: int = 92, voice: str = ""):
        """
        Speak out loud through the browser in the guide voice. This call waits until the line has FINISHED playing in her browser before returning - your words always land in order, never overlapping, and the voice stays exactly in step with your narration. Make each line a full sentence or two: tiny lines leave silence while the next one is written. Engine is a setting: kokoro (neural in-browser voice, stock Kokoro-82M v1.0; a slow soothing pace around 85-95 works beautifully) or the browser's native speech synthesis.

        Args:
            text: the words to speak
            rate: speed 10 to 200 (percent; 100 is natural, 85-95 for a slow soothing pace)
            voice: exact kokoro voice name (af_nicole, af_sarah, af_heart, af_bella, am_*, bf_*, bm_*; browser engine: substring), empty for the default_voice setting
        """
        if not self._active:
            return "No active meditation."

        guarded = self._guard()
        if guarded:
            return guarded

        if not text or not text.strip():
            return "Nothing to say."
        try:
            r = max(10, min(200, int(rate)))
        except (TypeError, ValueError):
            r = 92
        try:
            rlo, rhi = int(self.config.get("voice_rate_min")), int(self.config.get("voice_rate_max"))
        except (TypeError, ValueError):
            rlo, rhi = 50, 160
        rlo, rhi = min(rlo, rhi), max(rlo, rhi)
        r = max(rlo, min(rhi, r))

        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
        # speech handshake v2: stall until the
        # overlay acks this line at dispatch, then until the voice returns
        # to idle - the line has played all the way out. generous 300s
        # ceiling covers the first-run model download; session death cuts
        # the wait short honestly
        before_polls = self._poll_count
        self._speak_gen += 1
        gen = self._speak_gen
        self._events.append({"t": "speak", "text": str(text).strip()[:300], "rate": r, "pitch": 80, "voice": str(voice).strip()[:60]})
        self.log("meditation", "speak evt queued gen=" + str(gen) + " :: " + str(text).strip()[:60])
        hard_deadline = time.time() + 300.0
        res = await self._speak_handshake(gen, before_polls, hard_deadline)
        if res == "gone":
            return "The meditation ended before the line could be spoken."
        warn = ""
        if res == "silent":
            warn = (" WARNING: no overlay picked this line up - the browser "
                    "looks closed or disconnected, it may never be spoken.")
        elif res == "busy":
            warn = " NOTE: voice was still speaking when the wait window ended."
        return "That line has played out." + warn + self._nudge()

    async def end(self, speed_seconds: int, final_words: str):
        """
        Gently end the meditation: everything fades out smoothly over N seconds - the circle settles, the beats soften away, the ambience dissolves - then the overlay stops itself. final_words surface softly as the subject returns.

        Args:
            speed_seconds: fade-out duration, 5 to 180 (30 is gentle)
            final_words: optional parting words, shown on screen as the subject surfaces
        """
        if not self._active:
            return "No active meditation."
        if self._ending:
            return "Already fading out - let it finish."
        try:
            secs = max(5, min(180, int(speed_seconds)))
        except (TypeError, ValueError):
            secs = 30
        self._begin_end(secs, final_words, "AI called end")
        return ("Fading out over " + str(secs) + "s. Say a few warm re-orienting lines now "
                "(wiggle the fingers, come back when you are ready) and let the overlay stop itself."
                + self._session_note())

    # I removed the system prompt. Way too much cruft, tool definitions are enough. ~Rose22

    # ------------------------------------------------------------------
    # webui routes (frontend polls state; sidebar/overlay post actions)
    # ------------------------------------------------------------------

    @webui.route("state")
    async def _route_state(self, body=None, query=None):
        # auto-stop once a fade-out has fully played out
        if self._ending and self._end_started and time.time() - self._end_started > self._end_secs + 15:
            self._stop_all("faded out")
        # the max-session timer fades gently by itself (meditation may
        # run unattended - nobody has to be awake to press end)
        if self._time_up():
            self._begin_end(45.0, "", "session time up")
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
        # overlay liveness stamp: every /state fetch (modal,
        # sidebar or overlay poll) counts as proof a browser is listening,
        # which the bounded ack-window slide runs on
        self._poll_count += 1
        if bool(query) and str(query.get("events", "1")) == "0":
            events = []
        else:
            events = self._events
            self._events = []
        try:
            max_op = float(self.config.get("max_opacity"))
        except (TypeError, ValueError):
            max_op = 0.95
        return {
            "active": self._active,
            "ending": bool(self._ending and self._active),
            "end_secs": self._end_secs,
            "pattern": dict(self._pattern),
            "scene": dict(self._scene),
            "binaural": dict(self._bin) if self._active else dict(self._bin, on=False),
            "ambient": dict(self._ambient) if self._active else dict(self._ambient, on=False),
            "ambient_enabled": self.config.get("ambient_enabled") is not False,
            "tracks": self._list_tracks() if self.config.get("ambient_enabled") is not False else [],
            "speak": dict(self._speak) if (self._speak and self._active) else None,
            "events": events,
            "max_opacity": max(0.1, min(1.0, max_op)),
            "subject": self._subject(),
            "tts_engine": str(self.config.get("tts_engine") or "kokoro"),
            "default_voice": str(self.config.get("default_voice") or "af_nicole"),
            "binaurals_enabled": self.config.get("enable_binaurals") is not False,
            "breath_sounds": self.config.get("breath_sounds") is not False,
        }

    @webui.route("control", method="POST")
    async def _route_control(self, body=None, query=None):
        # sidebar quick actions: {active:true} drifts in on the current
        # pattern, {ending:true, secs:N} fades out, {active:false} stops
        body = body or {}
        if "active" in body:
            if body["active"]:
                self._active = True
                self._ending = False
                self._end_started = 0
                self._bin["on"] = self.config.get("enable_binaurals") is not False
                if not self._session_started:
                    self._session_started = time.time()
            else:
                self._stop_all("manual stop")
        if body.get("ending") and self._active and not self._ending:
            try:
                secs = float(body.get("secs", 12))
            except (TypeError, ValueError):
                secs = 12
            # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-08)
            # the browser watcher posts a reason when the stream goes idle
            self._begin_end(secs, "", str(body.get("reason") or "overlay end button"))
        if isinstance(body.get("pattern"), dict):
            p = body["pattern"]
            self._apply_pattern(p.get("in"), p.get("hold"), p.get("out"), p.get("hold_out"))
        # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
        # speech handshake: the overlay reports when the
        # voice pipeline begins (speaking=true doubles as the ack for the
        # dispatched line) and when it goes idle after the line plays out
        if "speaking" in body:
            if bool(body["speaking"]):
                self._speak_ack_gen = self._speak_gen
                self._speak_busy_at = time.time()
            self._speak_busy = bool(body["speaking"])
        return {"ok": True}

    @webui.route("stop", method="POST")
    async def _route_stop(self, body=None, query=None):
        # instant stop from the sidebar (the overlay's own ✕ fades instead)
        self._stop_all("stopped from sidebar")
        return {"ok": True}

    # -- AI GENERATED CODE (Qwen3.8-Flash-Next-Q4) :: (2026-10-09)
    # legacy audible-start handshake replaced by the control-based speaking
    # ack (see _route_control); route kept as a no-op so a stale cached
    # overlay cannot spam 404s at the console
    @webui.route("speech_start", method="POST")
    async def _route_speech_start(self, body=None, query=None):
        return {"ok": True}
