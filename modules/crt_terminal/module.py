# -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-26) harness:openlumara
import core
import channels.webui.api as webui


class CrtTerminalModule(core.module.Module):
    """Turns the entire webui into a CRT terminal, with lots of VFX and custom sounds"""

    category = "Fun"

    settings = {
        "enabled": {
            "description": "Start in CRT terminal mode when the webui loads. Typing 'crt off' in the chat input toggles it live either way (and remembers your choice).",
            "default": True
        },
        "phosphor": {
            "type": "select",
            "description": "Phosphor tube color.",
            "default": "green",
            "options": {
                "green": "P1 Green (classic terminal)",
                "amber": "P3 Amber (warm terminal)",
                "cyan": "Cyan (cold terminal)",
                "white": "P4 White (paperwhite)"
            }
        },
        "scanlines": {
            "type": "select",
            "description": "Scanline intensity over the whole screen.",
            "default": "medium",
            "options": {
                "off": "No scanlines",
                "low": "Subtle",
                "medium": "Classic",
                "high": "Heavy (maximum nostalgia)"
            }
        },
        "flicker": {
            "description": "Gentle phosphor flicker animation. Automatically disabled when your OS requests reduced motion.",
            "default": True
        },
        "glow": {
            "description": "Phosphor glow (text bloom) on messages, input and buttons.",
            "default": True
        },
        "boot_sequence": {
            "type": "select",
            "description": "BIOS-style boot sequence (POST memory count, fsck, success beep).",
            "default": "firstrun",
            "options": {
                "off": "No boot sequence",
                "firstrun": "Only on firstrun (once per browser session)",
                "every": "On every load"
            }
        },
        "interlace": {
            "description": "Interlace mode: alternating dimmed scan lines, like a 240-line CRT field.",
            "default": False
        },
        "whine": {
            "description": "Flyback transformer whine: the real thing — one thin 15.625 kHz (PAL line frequency) tone while the CRT is on. Faint by nature; many adults barely hear it, exactly like the original hardware.",
            "default": False
        },
        "distortion": {
            "type": "select",
            "description": "CRT monitor distortion: curved glass bezel, edge darkening, glass glare, chromatic aberration and (at heavy) a rolling refresh band.",
            "default": "heavy",
            "options": {
                "off": "Flat panel (no distortion)",
                "subtle": "Slight edge darkening and color fringing",
                "classic": "Curved glass monitor look",
                "heavy": "Deep curvature, strong aberration + rolling band"
            }
        },
        "sounds": {
            "description": "Terminal beeps: replaces the send/receive/completion sounds with square-wave beeps, adds keyboard clicks and a bell for command output. While CRT mode is on, ALL webui audio types are forced on regardless of the audio settings.",
            "default": True
        },
        "aspect_4_3": {
            "description": "Squash the entire interface into a centered 4:3 monitor screen with black bars around it (the settings modal opens inside the screen too).",
            "default": True
        },
        "simple_chain": {
            "description": "Replace the agentic chain with a single spinning | / - \\ status bar while the AI works, like an old terminal thinking for itself.",
            "default": True
        },
    }

    # -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-26)
    # serves module config to the webui script as a fallback next to the
    # config that is inlined into the page head. private (underscore) so it
    # is not registered as an AI tool.
    @webui.route("config")
    async def _route_config(self, body=None, query=None):
        phosphor = self.config.get("phosphor")
        if phosphor not in ("green", "amber", "cyan", "white"):
            phosphor = "green"

        scanlines = self.config.get("scanlines")
        if scanlines not in ("off", "low", "medium", "high"):
            scanlines = "medium"

        distortion = self.config.get("distortion")
        if distortion not in ("off", "subtle", "classic", "heavy"):
            distortion = "heavy"

        boot = self.config.get("boot_sequence")
        if boot not in ("off", "firstrun", "every"):
            boot = "firstrun"

        return {
            "enabled": bool(self.config.get("enabled")),
            "phosphor": phosphor,
            "scanlines": scanlines,
            "flicker": bool(self.config.get("flicker")),
            "glow": bool(self.config.get("glow")),
            "boot_sequence": boot,
            "sounds": bool(self.config.get("sounds")),
            "distortion": distortion,
            "aspect_4_3": bool(self.config.get("aspect_4_3")),
            "interlace": bool(self.config.get("interlace")),
            "whine": bool(self.config.get("whine")),
            "simple_chain": bool(self.config.get("simple_chain", True)),
        }

    @core.module.command("crt", help={
        "": "Shows CRT terminal usage info",
        "off": "Hint for turning the CRT skin off"
    })
    async def crt_command(self, args: list):
        return (
            "CRT TERMINAL v3.1 :: commands go in the webui chat input:\n"
            "  settings  - open the settings UI (to disable this module)\n"
            "  help      - list commands\n"
            "  clear     - clear the screen\n"
            "  crt on|off, crt green|amber|cyan|white\n"
        )
