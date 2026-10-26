/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-13
   updater: one-click ./update.sh + hard restart (the server re-execs
   itself). talks to /api/ext/updater/*. after the restart is scheduled,
   polls the status endpoint until the fresh process answers, then reloads
   the page. */
const UPDATER = {
    running: false,
    output: "",
    error: "",
    phase: "idle", // idle | running | restarting | failed

    open() {
        Alpine.store("ui").openModal("updater");
    },

    close() {
        Alpine.store("ui").closeModal();
    },

    async run() {
        if (this.running) return;

        this.running = true;
        this.error = "";
        this.output = "running ./update.sh ...\n";
        this.phase = "running";

        try {
            const d = await simpleApiPost("/api/ext/updater/run", {});
            this.output = (d && d.output) || "(no output)";

            if (d && d.ok && d.restarting) {
                this.phase = "restarting";
                this.waitForServer();
            } else {
                this.error = "update.sh failed (exit " + (d && d.code) + ") - server left running.";
                this.phase = "failed";
                this.running = false;
            }
        } catch (e) {
            // a network error here most likely means the re-exec landed
            // before the response could be read: unreachable server is a
            // restart in progress, anything else is a real failure.
            if (await this.unreachable()) {
                this.output = "server went down mid-response - assuming the restart landed.";
                this.phase = "restarting";
                this.waitForServer();
            } else {
                this.error = (e && e.message) ? e.message : String(e);
                this.phase = "failed";
                this.running = false;
            }
        }
    },

    async unreachable() {
        try {
            const r = await fetch("/api/ext/updater/status", { cache: "no-store" });
            return !r.ok;
        } catch (e) {
            return true;
        }
    },

    async waitForServer() {
        // hammer the status endpoint until the fresh process answers,
        // then reload the page on the new code. 2 minutes is generous:
        // startup + module dependency checks is normally a few seconds.
        const deadline = Date.now() + 120000;

        while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1500));
            try {
                const r = await fetch("/api/ext/updater/status", { cache: "no-store" });
                if (r.ok) {
                    window.location.reload();
                    return;
                }
            } catch (e) {
                // still down; keep waiting
            }
        }

        this.error = "server has not come back after 2 minutes - check journalctl -u openlumara.";
        this.phase = "failed";
        this.running = false;
    },
};

document.addEventListener("alpine:init", () => {
    Alpine.store("updater", UPDATER);
});
