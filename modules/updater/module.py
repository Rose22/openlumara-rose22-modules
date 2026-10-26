# -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-13
import core
import channels.webui.api as webui

import asyncio
import os
import sys


class Updater(core.module.Module):
    """
    a one-click 'update & restart' button for the webui, replacing the
    manual ./update.sh + sudo systemctl restart openlumara dance.
    runs update.sh from the repo root, then HARD-restarts OpenLumara by
    re-execing the process (os.execv) so the freshly pulled code is what
    runs. note: the core /restart is a soft restart (same process, loop
    re-run); this one replaces the process image entirely. same PID, so
    systemd still sees a live service - no systemctl needed.
    """

    category = "System"

    async def on_ready(self):
        self._running = False

    def _repo_root(self):
        # core lives at <repo>/core, so the root is its parent's parent -
        # robust no matter where the user_modules folder is configured.
        # falls back to the cwd (update.sh uses relative paths, so a
        # server started from the repo root works too).
        candidates = [
            os.path.dirname(os.path.dirname(os.path.abspath(core.__file__))),
            os.getcwd(),
        ]
        for root in candidates:
            if os.path.isfile(os.path.join(root, "update.sh")):
                return root
        return None

    # -- webui API routes --------------------------------------------------

    @webui.route("run", method="POST")
    async def _route_run(self, body=None, query=None):
        if self._running:
            raise ValueError("an update is already running")

        root = self._repo_root()
        if not root:
            raise ValueError("update.sh not found (checked the repo root and the cwd)")

        self._running = True
        try:
            # update.sh reads PYTHON_BIN for venv creation; point it at the
            # interpreter actually running this server so the venv stays
            # consistent even when systemd's env doesn't define it.
            env = dict(os.environ)
            env["PYTHON_BIN"] = sys.executable

            proc = await asyncio.create_subprocess_exec(
                "bash", "update.sh",
                cwd=root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=env,
            )

            try:
                out, _ = await asyncio.wait_for(proc.communicate(), timeout=600)
            except asyncio.TimeoutError:
                proc.kill()
                raise ValueError("update.sh timed out after 10 minutes")

            output = (out or b"").decode("utf-8", "replace").strip()

            if proc.returncode != 0:
                # a broken update must never take the server down
                return {"ok": False, "code": proc.returncode, "output": output, "restarting": False}

            # give this response a moment to flush before the process
            # image is replaced
            asyncio.create_task(self._hard_restart(delay=1.0))
            return {"ok": True, "code": 0, "output": output, "restarting": True}
        finally:
            self._running = False

    @webui.route("status")
    async def _route_status(self, body=None, query=None):
        # tiny endpoint the webui polls to learn the fresh process is up
        return {"ok": True}

    # -- internals -----------------------------------------------------------

    async def _hard_restart(self, delay: float = 1.0):
        await asyncio.sleep(delay)
        self.channel.log("updater", "hard restart: re-execing the process")

        argv = list(sys.argv)
        if argv and not os.path.isabs(argv[0]):
            # keep the entry script absolute: no cwd surprises after exec
            cand = os.path.abspath(argv[0])
            if os.path.isfile(cand):
                argv[0] = cand

        try:
            os.execv(sys.executable, [sys.executable] + argv)
        except Exception as e:
            self.channel.log("updater", f"hard restart failed: {core.detail_error(e)}")
