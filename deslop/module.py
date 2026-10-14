# -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
import core
import channels.webui.api as webui

import asyncio
import datetime
import hashlib
import os
import re
import time

# the marker literal is stitched together so this file never detects itself
# when deslop sweeps its own folder (the string would parse as malformed)
DEFAULT_MARKER = "AI" + " GENERATED" + " CODE"

DEFAULT_EXCLUDES = [".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build", ".idea", ".vscode"]

STATUS_REVIEWED = "reviewed"

CACHE_SECONDS = 30
LIST_CAP = 400
DIR_CAP = 2000

# marker grammar (ported from the deslop CLI):
#   <MARKER> (MODEL) :: (YYYY-MM-DD) [harness:X] [session:ID] [status:reviewed]
# delimiters around MODEL and DATE are lenient (real-world markers drift),
# the date itself stays strict. key:value tokens are found anywhere on the tail.
CORE_RE = re.compile(r"^\s*\(?\s*([^()\s][^()]*?)\s*\)?\s*::\s*[^0-9]*?(\d{4}-\d{2}-\d{2})")
TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]*:\S+")


class Deslop(core.module.Module):
    """Sweeps codebases for a special marker comment that identifies AI generated code, and lets you review and edit every AI generated code snippet that way."""

    category = "development"
    header = "Extra coding guidelines"

    settings = {
        "scan_path": {
            "description": "default folder to sweep. can be a coder sandbox name (e.g. 'openlumara_dev'), a folder inside a sandbox ('openlumara_dev/user_modules'), or any folder path. empty means the folder OpenLumara was started from.",
            "default": "",
        },
        "marker": {
            "description": "marker string to search for",
            "default": DEFAULT_MARKER,
        },
        "exclude_dirs": {
            "type": "list",
            "description": "folder names to skip while sweeping",
            "default": list(DEFAULT_EXCLUDES),
        },
        "enable_webui_extension": {
            "type": "boolean",
            "description": "show the deslop dashboard tab in the webui sidebar",
            "default": True,
        },
    }

    async def on_ready(self):
        self._cache = None
        self._session = None
        self._last_summary = None
        if self._coder() is None:
            self.log(self.name, "the coder module is not enabled - deslop is on strike until it is")

    async def on_system_prompt(self):
        if self._coder() is None:
            return None

        return """
When writing code, ALWAYS prepend the code with a comment following this format:
- # -- AI GENERATED CODE (CURRENT_MODEL) :: (DATE) harness:openlumara
        """.strip()

    # ------------------------------------------------------------------
    # coder gate + path helpers
    # ------------------------------------------------------------------

    def _coder(self):
        # dynamic check: reflects runtime enables/disables, no stale state
        try:
            return self.manager.modules.get("coder")
        except Exception:
            return None

    def _marker_literal(self):
        raw = self.config.get("marker")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
        return DEFAULT_MARKER

    @staticmethod
    def _expand(raw):
        return os.path.abspath(os.path.expanduser(str(raw).strip()))

    async def _sandbox_roots(self):
        """{absolute_path: sandbox_name} for every coder sandbox"""
        coder = self._coder()
        if coder is None:
            return {}
        roots = {}
        for path in coder.config.get("sandbox_paths") or []:
            full = self._expand(str(path).rstrip(os.path.sep))
            roots[full] = os.path.basename(full)
        return roots

    async def _resolve_root(self, raw):
        """turn a user/AI-supplied path into an absolute folder. returns (root, error)

        accepts a coder sandbox name, '<sandbox>/sub/folder' for any folder
        inside any sandbox, an absolute/~ folder path, or empty (= configured
        scan_path, falling back to the folder OpenLumara was started from).
        """
        raw = str(raw or "").strip() or str(self.config.get("scan_path") or "").strip()
        if not raw:
            return os.getcwd(), None

        roots = await self._sandbox_roots()
        for full, name in roots.items():
            if name == raw:
                return full, None

        # '<sandbox>/sub/folder' targets any folder inside any coder sandbox.
        # core.sandbox_path keeps the sub-path from climbing out of the sandbox.
        parts = re.split(r"[\\/]", raw, maxsplit=1)
        if len(parts) == 2:
            head, tail = parts[0], parts[1]
            for full, name in roots.items():
                if name == head:
                    try:
                        target = core.sandbox_path(full, tail)
                    except Exception:
                        return None, f"path not allowed inside sandbox {name}: {raw}"
                    if os.path.isdir(target):
                        return target, None
                    return None, f"not a folder inside sandbox {name}: {raw}"

        full = self._expand(raw)
        if os.path.isdir(full):
            return full, None
        return None, f"not a folder and not a coder sandbox: {raw}"

    # -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    async def _resolve_file(self, raw):
        """same targeting as _resolve_root but for files. returns an absolute
        path (existence NOT checked) or None when the sandbox sub-path is
        rejected (traversal etc.)."""
        raw = str(raw or "").strip()
        parts = re.split(r"[\\/]", raw, maxsplit=1)
        if len(parts) == 2:
            head, tail = parts[0], parts[1]
            roots = await self._sandbox_roots()
            for full, name in roots.items():
                if name == head:
                    try:
                        return core.sandbox_path(full, tail)
                    except Exception:
                        return None
        return self._expand(raw)

    @staticmethod
    def _locate(abs_path, roots):
        """map an absolute file path back to (sandbox_name, sandbox-relative path)"""
        for full, name in roots.items():
            if abs_path == full or abs_path.startswith(full + os.sep):
                return name, os.path.relpath(abs_path, full).replace(os.sep, "/")
        return None, None

    # ------------------------------------------------------------------
    # marker parsing (ported from the deslop CLI, dict-based)
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_line(line, marker_literal):
        idx = line.find(marker_literal)
        if idx < 0:
            return None
        entry = {
            "path": "", "line_no": 0, "raw": line.rstrip("\n"),
            "model": None, "date": None, "harness": None,
            "session": None, "status": None, "malformed": False,
        }
        rest = line[idx + len(marker_literal):]
        core_match = CORE_RE.match(rest)
        if core_match is None:
            entry["malformed"] = True
            return entry
        entry["model"] = core_match.group(1).strip(" ()[]{}<>")
        digits = core_match.group(2)
        try:
            entry["date"] = datetime.date(
                int(digits[0:4]), int(digits[5:7]), int(digits[8:10])
            ).isoformat()
        except ValueError:
            entry["malformed"] = True
            return entry
        tail = re.sub(r"\*/\s*$", "", rest[core_match.end():])
        for tok in TOKEN_RE.finditer(tail):
            key, _, value = tok.group(0).partition(":")
            if key == "harness":
                entry["harness"] = value
            elif key == "session":
                entry["session"] = value
            elif key == "status":
                entry["status"] = value
        return entry

    @staticmethod
    def _stamp_line(line, marker_literal):
        """append/replace status:reviewed on a marker line. None if not stampable."""
        idx = line.find(marker_literal)
        if idx < 0:
            return None
        core_match = CORE_RE.match(line[idx + len(marker_literal):])
        if core_match is None:
            return None  # never stamp malformed markers
        existing = re.search(r"\bstatus:\S+", line)
        if existing:
            return line[:existing.start()] + "status:" + STATUS_REVIEWED + line[existing.end():]
        insert_at = idx + len(marker_literal) + core_match.end()
        return line[:insert_at] + " status:" + STATUS_REVIEWED + line[insert_at:]

    # ------------------------------------------------------------------
    # scanning (blocking, always run through a thread)
    # ------------------------------------------------------------------

    @staticmethod
    def _read_text(path):
        try:
            with open(path, "rb") as handle:
                blob = handle.read()
        except OSError:
            return None
        if b"\x00" in blob[:8192]:
            return None  # binary
        try:
            return blob.decode("utf-8")
        except UnicodeDecodeError:
            return None

    @staticmethod
    def _walk(root, excludes):
        excl = set(excludes)
        for dirpath, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d not in excl and not d.endswith(".egg-info"))
            for name in sorted(files):
                if name.startswith("."):
                    continue
                yield os.path.join(dirpath, name)

    def _scan_blocking(self, root, marker_literal, excludes):
        entries = []
        files_scanned = 0
        for path in self._walk(root, excludes):
            files_scanned += 1
            text = self._read_text(path)
            if text is None:
                continue
            for num, line in enumerate(text.splitlines(), start=1):
                entry = self._parse_line(line, marker_literal)
                if entry is not None:
                    entry["path"] = path
                    entry["line_no"] = num
                    entries.append(entry)
        return entries, files_scanned

    def _stamp_blocking(self, path, line_no, marker_literal):
        text = self._read_text(path)
        if text is None:
            return False, "could not read that file (unreadable or binary)"
        lines = text.splitlines(True)
        idx = int(line_no) - 1
        if idx < 0 or idx >= len(lines):
            return False, f"line {line_no} is out of range (file has {len(lines)} lines)"
        stamped = self._stamp_line(lines[idx].rstrip("\n"), marker_literal)
        if stamped is None:
            return False, "no valid marker on that line - malformed markers must be fixed by hand in the editor"
        newline = "\n" if lines[idx].endswith("\n") else ""
        lines[idx] = stamped + newline
        try:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("".join(lines))
        except OSError as err:
            return False, f"could not write file: {err}"
        return True, None

    # ------------------------------------------------------------------
    # state (scan + rollups, cached so the webui can poll cheaply)
    # ------------------------------------------------------------------

    def _rollup(self, entries, keyfunc):
        counts = {}
        for entry in entries:
            key = keyfunc(entry)
            if key:
                counts[key] = counts.get(key, 0) + 1
        return counts

    async def _get_state(self, path_raw="", force=False):
        coder = self._coder()
        if coder is None:
            return None, "deslop requires the coder module - enable it first (/module coder)"

        root, err = await self._resolve_root(path_raw)
        if err:
            return None, err

        marker_literal = self._marker_literal()
        excludes = self.config.get("exclude_dirs") or DEFAULT_EXCLUDES
        key = (root, marker_literal, tuple(excludes))
        now = time.time()

        if not force and self._cache and self._cache["key"] == key and now - self._cache["at"] < CACHE_SECONDS:
            state = dict(self._cache["state"])
            state["age"] = int(now - self._cache["at"])
            return state, None

        entries, files_scanned = await asyncio.to_thread(self._scan_blocking, root, marker_literal, excludes)
        roots = await self._sandbox_roots()

        parsed = [e for e in entries if not e["malformed"]]
        slop = [e for e in parsed if e["status"] != STATUS_REVIEWED]
        reviewed = [e for e in parsed if e["status"] == STATUS_REVIEWED]
        malformed = [e for e in entries if e["malformed"]]
        files_with = len(set(e["path"] for e in entries))

        rows = []
        for entry in sorted(slop + malformed, key=lambda e: (e["path"], e["line_no"])):
            sandbox, rel = self._locate(entry["path"], roots)
            rows.append({
                "path": entry["path"],
                "file": os.path.relpath(entry["path"], root).replace(os.sep, "/"),
                "line": entry["line_no"],
                "model": entry["model"],
                "date": entry["date"],
                "harness": entry["harness"],
                "malformed": entry["malformed"],
                "sandbox": sandbox,
                "rel": rel,
            })

        by_dir = self._rollup(parsed, lambda e: os.path.dirname(os.path.relpath(e["path"], root)).replace(os.sep, "/") or "(root)")
        # -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
        # the root may be any folder inside a sandbox, not just a sandbox root:
        # report the containing sandbox + sandbox-relative path so the webui
        # dropdowns can reflect (and later restore) the exact target.
        root_sandbox, root_rel = self._locate(root, roots)
        if root_rel in (".", None):
            root_rel = ""
        state = {
            "error": None,
            "root": root,
            "root_sandbox": root_sandbox,
            "root_rel": root_rel,
            "scanned_at": now,
            "age": 0,
            "files_scanned": files_scanned,
            "files_with": files_with,
            "markers": len(entries),
            "slop": len(slop),
            "reviewed": len(reviewed),
            "malformed": len(malformed),
            "by_model": sorted(self._rollup(parsed, lambda e: e["model"]).items(), key=lambda kv: (-kv[1], kv[0])),
            "by_harness": sorted(self._rollup(parsed, lambda e: e["harness"]).items(), key=lambda kv: (-kv[1], kv[0])),
            "by_month": sorted(self._rollup(parsed, lambda e: (e["date"] or "")[:7]).items()),
            "by_dir": sorted(by_dir.items(), key=lambda kv: (-kv[1], kv[0]))[:15],
            "list": rows[:LIST_CAP],
            "list_total": len(rows),
            "list_truncated": len(rows) > LIST_CAP,
        }
        self._cache = {"key": key, "at": now, "state": state}
        return state, None

    # ------------------------------------------------------------------
    # interactive review session (webui modal, simulates `deslop review`)
    # ------------------------------------------------------------------

    def _file_snapshot(self, path, marker_literal):
        """blocking: current pending markers + digest for one file"""
        text = self._read_text(path)
        if text is None:
            return {"readable": False, "pending": [], "digest": None, "text": ""}
        entries = []
        for num, line in enumerate(text.splitlines(), start=1):
            entry = self._parse_line(line, marker_literal)
            if entry is not None:
                entry["path"] = path
                entry["line_no"] = num
                entries.append(entry)
        pending = [e for e in entries if e["status"] != STATUS_REVIEWED]
        return {
            "readable": True,
            "pending": pending,
            "digest": hashlib.md5(text.encode("utf-8")).hexdigest(),
            "text": text,
        }

    def _finish_session(self, interrupted):
        s = self._session
        lines = [
            "deslop interrupted." if interrupted else "deslop complete.",
            f"  files cleaned: {s['cleaned']}/{len(s['files'])}",
            f"  markers removed: {s['removed']}",
        ]
        if s["stamped"]:
            lines.append(f"  markers stamped reviewed: {s['stamped']}")
        if s["skipped"]:
            lines.append("  skipped (NOT cleaned):")
            lines.extend("    " + p for p in s["skipped"])
        summary = "\n".join(lines)
        self._last_summary = {"summary": summary, "interrupted": interrupted}
        self._session = None
        self._cache = None
        return {"active": True, "done": True, "summary": summary, "interrupted": interrupted}

    async def _review_start(self, path_raw=""):
        if self._session:
            return await self._review_banner(), None
        state, err = await self._get_state(path_raw, force=True)
        if err:
            return None, err
        files = sorted(set(r["path"] for r in state["list"]))
        if not files:
            self._last_summary = {"summary": f"clean. no unreviewed markers under {state['root']}", "interrupted": False}
            return {"active": True, "done": True, "summary": self._last_summary["summary"], "interrupted": False}, None
        self._last_summary = None
        self._session = {
            "root": state["root"],
            "files": files,
            "index": 0,
            "cleaned": 0,
            "stamped": 0,
            "removed": 0,
            "skipped": [],
            "streak": 0,
            "verdict": "",
            "left": 0,
            "digest": None,
        }
        return await self._review_banner(), None

    async def _review_banner(self):
        s = self._session
        if not s:
            return {"active": False}

        marker_literal = self._marker_literal()
        while True:
            if s["index"] >= len(s["files"]):
                return self._finish_session(interrupted=False)
            path = s["files"][s["index"]]
            snap = await asyncio.to_thread(self._file_snapshot, path, marker_literal)
            if not snap["readable"]:
                s["skipped"].append(path)
                s["verdict"] = "unreadable, skipping"
                s["index"] += 1
                continue
            if not snap["pending"]:
                s["cleaned"] += 1
                s["verdict"] = "file cleaned!"
                s["index"] += 1
                s["streak"] = 0
                continue
            break

        first = snap["pending"][0]
        s["left"] = len(snap["pending"])
        s["digest"] = snap["digest"]

        lines = snap["text"].splitlines()
        lo = max(0, first["line_no"] - 3)
        hi = min(len(lines), first["line_no"] + 2)
        context = [
            {"n": i + 1, "text": lines[i], "current": i == first["line_no"] - 1}
            for i in range(lo, hi)
        ]

        roots = await self._sandbox_roots()
        sandbox, rel = self._locate(path, roots)

        nag = ""
        if s["streak"] >= 3:
            nag = f"this marker has survived {s['streak']} sessions. you should really clean that up!"

        # -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
        # every pending marker in the file, so the webui can open the editor
        # once per file and jump between markers instead of per marker
        markers = [
            {
                "line": e["line_no"],
                "model": e["model"],
                "date": e["date"],
                "harness": e["harness"],
                "malformed": e["malformed"],
                "raw": e["raw"].strip(),
            }
            for e in snap["pending"]
        ]

        return {
            "active": True,
            "done": False,
            "root": s["root"],
            "file": path,
            "file_rel": os.path.relpath(path, s["root"]).replace(os.sep, "/"),
            "sandbox": sandbox,
            "rel": rel,
            "line": first["line_no"],
            "marker_raw": first["raw"].strip(),
            "marker_model": first["model"],
            "marker_date": first["date"],
            "malformed": first["malformed"],
            "markers": markers,
            "markers_left": len(snap["pending"]),
            "file_index": s["index"] + 1,
            "file_total": len(s["files"]),
            "cleaned": s["cleaned"],
            "stamped": s["stamped"],
            "removed": s["removed"],
            "skipped": len(s["skipped"]),
            "verdict": s["verdict"],
            "nag": nag,
            "context": context,
        }

    async def _review_action(self, action, line=None):
        s = self._session
        if not s:
            return None, "no active deslop review session - start one from the sidebar tab"

        marker_literal = self._marker_literal()
        path = s["files"][s["index"]] if s["index"] < len(s["files"]) else None

        if action == "quit":
            return self._finish_session(interrupted=True), None

        if action == "skip":
            if path is not None:
                s["skipped"].append(path)
            s["verdict"] = "skipped"
            s["index"] += 1
            return await self._review_banner(), None

        # -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-10-14) harness:openlumara
        # line is optional: the webui side panel stamps whichever marker the
        # caret is on, which may not be the first pending one in the file.
        if action == "stamp":
            snap = await asyncio.to_thread(self._file_snapshot, path, marker_literal)
            if not snap["readable"] or not snap["pending"]:
                return await self._review_banner(), None
            first = snap["pending"][0]
            if line:
                try:
                    wanted = int(line)
                except (TypeError, ValueError):
                    return None, f"line number must be a number, got: {line}"
                match = [e for e in snap["pending"] if e["line_no"] == wanted]
                if not match:
                    s["verdict"] = f"no unreviewed marker on line {wanted} - it may already be stamped"
                    self._cache = None
                    return await self._review_banner(), None
                first = match[0]
            if first["malformed"]:
                s["verdict"] = "malformed marker - fix it in the editor, not with a stamp"
                s["streak"] += 1
            else:
                ok, err = await asyncio.to_thread(self._stamp_blocking, path, first["line_no"], marker_literal)
                if ok:
                    s["stamped"] += 1
                    s["verdict"] = "stamped as reviewed"
                    # the stamp changed the file on disk. refresh the snapshot
                    # so a later "done editing" doesn't read it as a removal
                    after = await asyncio.to_thread(self._file_snapshot, path, marker_literal)
                    if after["readable"]:
                        s["digest"] = after["digest"]
                        s["left"] = len(after["pending"])
                else:
                    s["verdict"] = f"stamp failed: {err}"
            self._cache = None
            return await self._review_banner(), None

        if action == "continue":
            snap = await asyncio.to_thread(self._file_snapshot, path, marker_literal)
            if not snap["readable"]:
                s["skipped"].append(path)
                s["verdict"] = "unreadable, skipping"
                s["index"] += 1
            elif not snap["pending"]:
                s["cleaned"] += 1
                s["verdict"] = "file cleaned!"
                s["index"] += 1
                s["streak"] = 0
            elif snap["digest"] == s["digest"]:
                s["streak"] += 1
                s["verdict"] = "unchanged"
            elif len(snap["pending"]) < s["left"]:
                removed = s["left"] - len(snap["pending"])
                s["removed"] += removed
                s["streak"] = 0
                s["verdict"] = f"removed {removed} marker(s)"
            else:
                s["streak"] = 0
                s["verdict"] = "edited, still dirty"
            self._cache = None
            return await self._review_banner(), None

        return None, f"unknown review action: {action}"

    # ------------------------------------------------------------------
    # text renderers (shared by tools and the /deslop command)
    # ------------------------------------------------------------------

    def _stats_text(self, st):
        touched = (100.0 * st["files_with"] / st["files_scanned"]) if st["files_scanned"] else 0.0
        lines = [
            f"root: {st['root']}",
            f"files scanned: {st['files_scanned']}  -  files with markers: {st['files_with']} ({touched:.0f}%)",
            f"markers: {st['markers']} total  -  {st['slop']} unreviewed  -  {st['reviewed']} reviewed  -  {st['malformed']} malformed",
        ]
        for title, pairs, cap in (("by model", st["by_model"], 8), ("by month", st["by_month"], 8), ("worst dirs", st["by_dir"], 10)):
            if pairs:
                rendered = ", ".join(f"{name} {count}" for name, count in pairs[:cap])
                lines.append(f"{title}: {rendered}")
        if st["slop"] == 0 and st["malformed"] == 0:
            lines.append("clean. nothing left to review.")
        else:
            lines.append("use deslop_list for the full list, then deslop_stamp once each marker is reviewed.")
        return "\n".join(lines)

    def _list_text(self, st):
        if not st["list"]:
            return f"clean. no unreviewed markers under {st['root']}"
        rows = [(r["file"] + ":" + str(r["line"]), r["model"] or "", r["date"] or "", r["harness"] or "") for r in st["list"]]
        widths = [max(len(row[i]) for row in rows) for i in range(4)]
        lines = [
            f"unreviewed markers under {st['root']} ({st['list_total']} total):",
            *[  "  ".join(row[i].ljust(widths[i]) for i in range(4)).rstrip() for row in rows ],
        ]
        if st["list_truncated"]:
            lines.append(f"... {st['list_total'] - LIST_CAP} more")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # AI tools
    # ------------------------------------------------------------------

    async def deslop_stats(self, path: str = ""):
        """
        Dashboard of AI-generated code markers under a folder: totals, by model, by month, worst directories.

        Args:
            path: folder to sweep: a coder sandbox name, 'sandbox/sub/folder' for any folder inside any sandbox, or any folder path. empty uses the configured default scan_path.
        """
        state, err = await self._get_state(path)
        if err:
            return self.result(err, success=False)
        return self.result(self._stats_text(state))

    async def deslop_list(self, path: str = ""):
        """
        List every unreviewed AI-generated code marker as path:line with model and date (malformed markers included).

        Args:
            path: folder to sweep: a coder sandbox name, 'sandbox/sub/folder' for any folder inside any sandbox, or any folder path. empty uses the configured default scan_path.
        """
        state, err = await self._get_state(path)
        if err:
            return self.result(err, success=False)
        return self.result(self._list_text(state))

    async def deslop_stamp(self, path: str, line: int):
        """
        Stamp the AI-generated code marker on a given line with status:reviewed, so it stays marked as AI code but is skipped by future sweeps. Only files inside a coder sandbox or the last scanned root can be stamped.

        Args:
            path: file holding the marker: absolute path, or 'sandbox/rel/path' inside any coder sandbox
            line: line number the marker sits on
        """
        if self._coder() is None:
            return self.result("deslop requires the coder module - enable it first (/module coder)", success=False)

        abs_path = await self._resolve_file(path)
        if abs_path is None or not os.path.isfile(abs_path):
            return self.result(f"not a file: {path}", success=False)

        # write guard: sandboxed files, or files inside the last scanned root
        allowed = False
        roots = await self._sandbox_roots()
        for full in roots:
            if abs_path == full or abs_path.startswith(full + os.sep):
                allowed = True
                break
        if not allowed and self._cache:
            cached_root = self._cache["state"]["root"]
            if abs_path == cached_root or abs_path.startswith(cached_root + os.sep):
                allowed = True
        if not allowed:
            return self.result(f"refusing to stamp {path}: outside every coder sandbox and the last scanned root", success=False)

        ok, err = await asyncio.to_thread(self._stamp_blocking, abs_path, line, self._marker_literal())
        if not ok:
            return self.result(err, success=False)

        self._cache = None
        return self.result(f"stamped status:reviewed on {abs_path}:{line}")

    # ------------------------------------------------------------------
    # webui API routes (consumed by the sidebar tab)
    # ------------------------------------------------------------------

    @webui.route("state")
    async def _route_state(self, body=None, query=None):
        state, err = await self._get_state((query or {}).get("path", ""))
        if state is None:
            return {"error": err}
        state["session_active"] = self._session is not None
        return state

    @webui.route("scan", method="POST")
    async def _route_scan(self, body=None, query=None):
        state, err = await self._get_state((body or {}).get("path", ""), force=True)
        if state is None:
            return {"error": err}
        state["session_active"] = self._session is not None
        return state

    # -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    # backing data for the panel's target pickers. deslop never inherits the
    # sandbox selected in the coder sidebar: the panel picks its own sandbox
    # plus a folder inside it (folders only, never files) from two dropdowns.
    @webui.route("dirs")
    async def _route_dirs(self, body=None, query=None):
        """the sandbox list is always included; with ?sandbox=<name> every
        folder inside it comes back depth-first, so a <select> can render it
        as an indented tree."""
        roots = await self._sandbox_roots()
        payload = {"sandboxes": sorted(roots.values()), "dirs": [], "truncated": False}

        sandbox = str((query or {}).get("sandbox", "") or "")
        if not sandbox:
            return payload

        root = None
        for full, name in roots.items():
            if name == sandbox:
                root = full
                break
        if root is None:
            return {**payload, "error": f"unknown sandbox: {sandbox}"}

        dirs, truncated = await asyncio.to_thread(self._list_dirs_blocking, root)
        payload["dirs"] = dirs
        payload["truncated"] = truncated
        return payload

    # -- AI GENERATED CODE (Qwen3.8 Flash Next) :: 2026-10-14
    def _list_dirs_blocking(self, root):
        # true pre-order dfs: a folder's children are listed directly after
        # the folder itself, which is what the dropdown's indented tree needs.
        # os.walk can't do this (it yields every child of a node before
        # descending into the first one), so siblings and cousins interleaved
        # and the tree looked mangled.
        excludes = set(self.config.get("exclude_dirs") or DEFAULT_EXCLUDES)
        dirs = []
        state = {"truncated": False}

        def walk(dirpath):
            if state["truncated"]:
                return
            try:
                with os.scandir(dirpath) as it:
                    entries = sorted(it, key=lambda e: e.name)
            except OSError:
                return
            keep = []
            for e in entries:
                try:
                    # symlinks are pruned too: a linked folder could cycle
                    # the walk or point outside the sandbox
                    if not e.is_dir(follow_symlinks=False):
                        continue
                except OSError:
                    continue
                if e.name.startswith(".") or e.name in excludes or e.name.endswith(".egg-info"):
                    continue
                keep.append(e)
            # each entry is followed immediately by its own subtree, so the
            # flat list reads as a proper pre-order tree
            for e in keep:
                if len(dirs) >= DIR_CAP:
                    state["truncated"] = True
                    return
                rel = os.path.relpath(e.path, root).replace(os.sep, "/")
                dirs.append({"path": rel, "name": e.name, "depth": rel.count("/") + 1})
                walk(e.path)
                if state["truncated"]:
                    return

        walk(root)
        return dirs, state["truncated"]

    @webui.route("review/start", method="POST")
    async def _route_review_start(self, body=None, query=None):
        banner, err = await self._review_start((body or {}).get("path", ""))
        return banner if banner is not None else {"error": err}

    @webui.route("review/current")
    async def _route_review_current(self, body=None, query=None):
        if self._session:
            return await self._review_banner()
        if self._last_summary:
            return {"active": True, "done": True, "summary": self._last_summary["summary"], "interrupted": self._last_summary["interrupted"]}
        return {"active": False}

    @webui.route("review/action", method="POST")
    async def _route_review_action(self, body=None, query=None):
        banner, err = await self._review_action(
            str((body or {}).get("action", "")), (body or {}).get("line")
        )
        return banner if banner is not None else {"error": err}

    @webui.route("stamp", method="POST")
    async def _route_stamp(self, body=None, query=None):
        body = body or {}
        path = body.get("path")
        line = body.get("line")
        if not path or line is None:
            raise ValueError("path and line are required")
        result = await self.deslop_stamp(str(path), int(line))
        if result["status"] != "success":
            raise ValueError(result["content"])
        return {"ok": True}

    # ------------------------------------------------------------------
    # user command
    # ------------------------------------------------------------------

    @core.module.command("deslop", help={
        "": "dashboard of unreviewed AI-code markers in the default scan root",
        "list": "list every unreviewed marker (path:line model date)",
        "scan": "force a fresh sweep, then show the dashboard",
        "stamp <path> <line>": "stamp a marker as reviewed",
    })
    async def deslop_command(self, args: list):
        args = list(args or [])
        sub = str(args[0]).strip().lower() if args else ""

        if sub == "stamp":
            if len(args) < 3:
                return "usage: /deslop stamp <path> <line>"
            try:
                line_no = int(args[2])
            except ValueError:
                return f"line number must be a number, got: {args[2]}"
            result = await self.deslop_stamp(args[1], line_no)
            return result["content"]

        if sub == "list":
            state, err = await self._get_state("")
            return err or self._list_text(state)

        state, err = await self._get_state("", force=(sub == "scan"))
        return err or self._stats_text(state)
