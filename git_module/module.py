# git_module.py
# Git assistant module for OpenLumara.
# Handles all the git pain so the user never has to touch git themselves again.

import os
import shutil
import subprocess

import core


def _run(args: list, cwd: str = None):
    """Run a command, return (returncode, stdout, stderr)."""
    try:
        proc = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except FileNotFoundError as e:
        return 127, "", str(e)


def _summarize_status(porcelain: str):
    """Turn `git status --porcelain=v1 -b` output into a friendly dict."""
    summary = {
        "branch_info": None,
        "staged": [],
        "unstaged": [],
        "untracked": [],
        "conflicts": [],
    }
    conflict_pairs = {("U", "U"), ("A", "A"), ("D", "D"), ("A", "U"), ("U", "A"), ("D", "U"), ("U", "D")}

    for line in porcelain.splitlines():
        if not line.strip():
            continue
        if line.startswith("## "):
            summary["branch_info"] = line[3:]
            continue
        x, y = line[0], line[1]
        path = line[3:]
        if (x, y) in conflict_pairs:
            summary["conflicts"].append(path)
            continue
        if x == "?" and y == "?":
            summary["untracked"].append(path)
            continue
        if x in ("M", "A", "D", "R", "C", "T"):
            summary["staged"].append(path)
        if y in ("M", "D", "T"):
            summary["unstaged"].append(path)

    return summary


class GitModule(core.module.Module):
    """
    Git assistant. Performs git operations on the user's repos so they never
    have to deal with git themselves: status, commits, pushes, pulls, branches,
    stashes, merges, conflict recovery, undo, and GitHub PRs (via gh CLI).

    If the user mentions a repo by name, it should be configured in the `repos`
    setting so tools can resolve it. If only one repo is configured, tools will
    use it automatically when no repo is specified.
    """

    # -------------------------
    #   CONFIGURATION
    # -------------------------

    settings = {
        "repos": {
            "type": "list",
            "description": "Paths to git repositories you work with regularly (e.g. /home/rosie/dev/openlumara_dev). Tools can then refer to them by name.",
            "default": [],
        },
        "default_branch": {
            "description": "Default branch name used when creating PRs or setting upstreams.",
            "default": "main",
        },
        "allow_force_push": {
            "default": False,
            "unsafe": True,
            "description": "Allow force-pushing branches to remotes.",
        },
        "allow_destructive": {
            "default": False,
            "unsafe": True,
            "description": "Allow destructive operations: hard resets, git clean, rebase, and force-deleting branches.",
        },
        "allow_clone": {
            "default": True,
            "description": "Allow cloning new repositories.",
        },
    }

    dependencies = []

    # -------------------------
    #   EVENT HANDLERS
    # -------------------------

    async def on_system_prompt(self):
        repos = self.config.get("repos") or []
        lines = [
            "\n[Git module is active. Handle ALL git work for the user using the git_* tools - never make the user run git themselves.",
            "Prefer git_status before acting, git_commit for saving work, and git_undo_last_commit (soft, keeps changes) for fixing mistakes.",
            "Destructive ops (hard reset, clean, rebase, force push, force delete) are gated behind module settings - ask the user before enabling them.",
            "If a merge/rebase conflict occurs, report the conflicted files and help resolve them, or abort to get back to safety.]"]
        if repos:
            lines.append("Configured repos: " + ", ".join(repos))
        else:
            lines.append("No repos configured yet - ask the user which repo paths they use and add them to the `repos` setting.")
        return "\n".join(lines) + "\n"

    # -------------------------
    #   HELPERS (private)
    # -------------------------

    def _resolve_repo(self, repo: str = ""):
        """Resolve a repo name-or-path to an absolute path. Returns (path, error)."""
        repos = self.config.get("repos") or []
        if repo:
            for r in repos:
                if r == repo or os.path.basename(r.rstrip("/\\")) == repo:
                    return r, None
            if os.path.isdir(repo):
                return repo, None
            return None, f"Repo '{repo}' not found. Configured repos: {repos or 'none'}. Pass a full path or add it to the `repos` setting."
        if len(repos) == 1:
            return repos[0], None
        if len(repos) > 1:
            return None, f"Multiple repos configured, please specify which one: {repos}"
        return None, "No repos configured. Ask the user for a repo path and add it to the `repos` setting."

    def _git(self, repo_path: str, args: list):
        return _run(["git"] + args, cwd=repo_path)

    def _ensure_repo(self, repo: str = ""):
        """Returns (repo_path, error_result). If error_result is not None, return it directly."""
        path, err = self._resolve_repo(repo)
        if err:
            return None, self.result(err, success=False)
        code, out, serr = self._git(path, ["rev-parse", "--is-inside-work-tree"])
        if code != 0:
            return None, self.result(f"'{path}' is not a git repository. {serr}", success=False)
        return path, None

    # -------------------------
    #   AI TOOLS
    # -------------------------

    async def git_status(self, repo: str = ""):
        """
        Get a clean, friendly summary of a repo's state: current branch, ahead/behind,
        staged/unstaged/untracked files, and any merge conflicts. Always run this first
        before making changes to a repo.

        Args:
            repo: Repo name (from the configured repos) or full path. Leave empty if only one repo is configured.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, porcelain, serr = self._git(path, ["status", "--porcelain=v1", "-b"])
        if code != 0:
            return self.result(f"git status failed: {serr}", success=False)
        summary = _summarize_status(porcelain)
        clean = not (summary["staged"] or summary["unstaged"] or summary["untracked"] or summary["conflicts"])
        return self.result({"repo": path, "clean": clean, **summary})

    async def git_add(self, files: list = None, stage_all: bool = True, repo: str = ""):
        """
        Stage files for commit.

        Args:
            files: Specific file paths to stage (relative to repo root). Ignored if stage_all is True.
            stage_all: Stage everything (git add -A). Defaults to True.
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        if stage_all:
            code, out, serr = self._git(path, ["add", "-A"])
        elif files:
            code, out, serr = self._git(path, ["add", "--"] + files)
        else:
            return self.result("Nothing to stage: pass `files` or set stage_all=True.", success=False)
        if code != 0:
            return self.result(f"git add failed: {serr}", success=False)
        return self.result("Staged successfully." + (f" Output: {out}" if out else ""))

    async def git_commit(self, message: str, repo: str = "", stage_all: bool = True):
        """
        Commit changes with the given message. Stages everything first by default,
        so 'commit my work' just works.

        Args:
            message: The commit message. Write a clear, descriptive one (conventional commits style is nice: feat:, fix:, docs:, etc).
            repo: Repo name or path.
            stage_all: Stage all changes before committing. Defaults to True.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        if stage_all:
            self._git(path, ["add", "-A"])
        code, out, serr = self._git(path, ["commit", "-m", message])
        if code != 0:
            if "nothing to commit" in (out + serr):
                return self.result("Nothing to commit - working tree is already clean.", success=True)
            return self.result(f"commit failed: {serr or out}", success=False)
        # include branch + ahead info
        _, branch, _ = self._git(path, ["rev-parse", "--abbrev-ref", "HEAD"])
        return self.result(f"Committed on '{branch}': {out.splitlines()[0] if out else message}")

    async def git_push(self, repo: str = "", branch: str = "", force: bool = False):
        """
        Push commits to the remote. Sets upstream automatically for new branches.

        Args:
            repo: Repo name or path.
            branch: Branch to push. Defaults to the current branch.
            force: Force push (DANGEROUS, requires the allow_force_push setting).
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        if force and not self.config.get("allow_force_push", default=False):
            return self.result("Force push is disabled. Ask the user to enable `allow_force_push` in the git module settings.", success=False)
        if not branch:
            _, branch, _ = self._git(path, ["rev-parse", "--abbrev-ref", "HEAD"])
        args = ["push", "-u", "origin", branch]
        if force:
            args.append("--force-with-lease")
        code, out, serr = self._git(path, args)
        if code != 0:
            return self.result(f"push failed: {serr or out}", success=False)
        return self.result(f"Pushed '{branch}' to origin successfully.")

    async def git_pull(self, repo: str = "", rebase: bool = False):
        """
        Pull latest changes from the remote.

        Args:
            repo: Repo name or path.
            rebase: Rebase local commits on top instead of merging.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        args = ["pull"] + (["--rebase"] if rebase else [])
        code, out, serr = self._git(path, args)
        if code != 0:
            if "CONFLICT" in (out + serr).upper():
                _, porcelain, _ = self._git(path, ["status", "--porcelain=v1", "-b"])
                conflicts = _summarize_status(porcelain)["conflicts"]
                return self.result(f"Pull hit conflicts in: {conflicts}. Resolve them (or use git_merge_abort) and tell the user.", success=False)
            return self.result(f"pull failed: {serr or out}", success=False)
        if "Already up to date" in out:
            return self.result("Pulled successfully. Already up to date.")
        return self.result(out or "Pulled successfully.")

    async def git_fetch(self, repo: str = ""):
        """
        Fetch remote changes without merging (safe way to see what's new).

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["fetch", "--all", "--prune"])
        if code != 0:
            return self.result(f"fetch failed: {serr or out}", success=False)
        return self.result(out or "Fetched. Nothing new.")

    async def git_log(self, repo: str = "", limit: int = 15):
        """
        Show recent commit history.

        Args:
            repo: Repo name or path.
            limit: Number of commits to show.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["log", "--oneline", "--decorate", f"-n{limit}"])
        if code != 0:
            return self.result(f"git log failed: {serr or out}", success=False)
        return self.result(out)

    async def git_diff(self, repo: str = "", staged: bool = False, file: str = ""):
        """
        Show uncommitted changes (or staged changes). Great for writing commit messages
        or reviewing what changed before committing.

        Args:
            repo: Repo name or path.
            staged: Show staged changes instead of unstaged.
            file: Limit the diff to one file.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        args = ["diff"] + (["--cached"] if staged else [])
        if file:
            args += ["--", file]
        code, out, serr = self._git(path, args)
        if code != 0:
            return self.result(f"git diff failed: {serr or out}", success=False)
        return self.result(out or "No changes.")

    async def git_show(self, repo: str = "", ref: str = "HEAD"):
        """
        Show the details of a commit (or branch/tag).

        Args:
            repo: Repo name or path.
            ref: Commit hash, branch, or tag to show.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["show", "--stat", ref])
        if code != 0:
            return self.result(f"git show failed: {serr or out}", success=False)
        return self.result(out)

    async def git_branches(self, repo: str = ""):
        """
        List all local and remote branches with tracking info.

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["branch", "-vv"])
        if code != 0:
            return self.result(f"git branch failed: {serr or out}", success=False)
        return self.result(out)

    async def git_checkout(self, branch: str, repo: str = "", create: bool = False):
        """
        Switch to a branch (or create a new one and switch to it).

        Args:
            branch: Branch name.
            repo: Repo name or path.
            create: Create the branch first if it doesn't exist.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        if create:
            code, out, serr = self._git(path, ["checkout", "-b", branch])
        else:
            code, out, serr = self._git(path, ["checkout", branch])
        if code != 0:
            return self.result(f"checkout failed: {serr or out}", success=False)
        return self.result(f"Now on branch '{branch}'.")

    async def git_delete_branch(self, branch: str, repo: str = "", force: bool = False):
        """
        Delete a local branch.

        Args:
            branch: Branch name to delete.
            repo: Repo name or path.
            force: Force delete even if unmerged (requires allow_destructive setting).
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        if force and not self.config.get("allow_destructive", default=False):
            return self.result("Force-deleting unmerged branches is disabled. Ask the user to enable `allow_destructive`.", success=False)
        code, out, serr = self._git(path, ["branch", "-D" if force else "-d", branch])
        if code != 0:
            return self.result(f"delete failed: {serr or out}", success=False)
        return self.result(out)

    async def git_stash(self, repo: str = "", message: str = ""):
        """
        Stash uncommitted changes (tuck them away safely for later).

        Args:
            repo: Repo name or path.
            message: Optional label for the stash.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        args = ["stash", "push", "--include-untracked"] + (["-m", message] if message else [])
        code, out, serr = self._git(path, args)
        if code != 0:
            return self.result(f"stash failed: {serr or out}", success=False)
        return self.result(out or "Stashed.")

    async def git_stash_pop(self, repo: str = ""):
        """
        Bring back the most recently stashed changes.

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["stash", "pop"])
        if code != 0:
            return self.result(f"stash pop failed: {serr or out}", success=False)
        return self.result(out or "Stash restored.")

    async def git_stash_list(self, repo: str = ""):
        """
        List all stashes.

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["stash", "list"])
        if code != 0:
            return self.result(f"stash list failed: {serr or out}", success=False)
        return self.result(out or "No stashes.")

    async def git_undo_last_commit(self, repo: str = ""):
        """
        Undo the last commit but KEEP all the changes (soft reset). The safe 'oops' button.

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["reset", "--soft", "HEAD~1"])
        if code != 0:
            return self.result(f"undo failed: {serr or out}", success=False)
        return self.result("Last commit undone - all changes are kept and re-staged.")

    async def git_merge(self, branch: str, repo: str = ""):
        """
        Merge a branch into the current branch.

        Args:
            branch: Branch to merge in (e.g. 'main' or 'origin/main').
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["merge", branch])
        combined = out + serr
        if code != 0:
            if "CONFLICT" in combined.upper():
                _, porcelain, _ = self._git(path, ["status", "--porcelain=v1", "-b"])
                conflicts = _summarize_status(porcelain)["conflicts"]
                return self.result(f"Merge conflicts in: {conflicts}. Resolve them and git_commit, or git_merge_abort to bail out safely.", success=False)
            return self.result(f"merge failed: {combined}", success=False)
        return self.result(combined)

    async def git_merge_abort(self, repo: str = ""):
        """
        Abort an in-progress merge and get back to a clean state.

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["merge", "--abort"])
        if code != 0:
            return self.result(f"abort failed: {serr or out}", success=False)
        return self.result("Merge aborted. Back to safety.")

    async def git_rebase(self, onto: str, repo: str = ""):
        """
        Rebase the current branch onto another branch (e.g. 'origin/main').
        Requires the allow_destructive setting since it rewrites history.

        Args:
            onto: Branch to rebase onto.
            repo: Repo name or path.
        """
        if not self.config.get("allow_destructive", default=False):
            return self.result("Rebase is disabled (it rewrites history). Ask the user to enable `allow_destructive`.", success=False)
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["rebase", onto])
        combined = out + serr
        if code != 0:
            if "CONFLICT" in combined.upper():
                return self.result(f"Rebase paused on a conflict. Fix files and `git rebase --continue` via git_rebase_continue, or git_rebase_abort to bail. Raw output: {combined}", success=False)
            return self.result(f"rebase failed: {combined}", success=False)
        return self.result(combined or "Rebased successfully.")

    async def git_rebase_continue(self, repo: str = ""):
        """
        Continue an in-progress rebase after resolving conflicts.

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["rebase", "--continue"])
        if code != 0:
            return self.result(f"rebase --continue failed (conflicts remaining?): {serr or out}", success=False)
        return self.result(out or "Rebase finished.")

    async def git_rebase_abort(self, repo: str = ""):
        """
        Abort an in-progress rebase and get back to the pre-rebase state.

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["rebase", "--abort"])
        if code != 0:
            return self.result(f"rebase abort failed: {serr or out}", success=False)
        return self.result("Rebase aborted. Back to safety.")

    async def git_reset(self, ref: str = "HEAD", hard: bool = False, repo: str = ""):
        """
        Reset the current branch to a point in history. Soft/mixed keep changes;
        hard DISCARDS uncommitted changes (requires allow_destructive setting).

        Args:
            ref: What to reset to (e.g. 'HEAD~2', 'origin/main', a commit hash).
            hard: Hard reset - discards uncommitted work! Requires allow_destructive.
            repo: Repo name or path.
        """
        if hard and not self.config.get("allow_destructive", default=False):
            return self.result("Hard reset is disabled. Ask the user to enable `allow_destructive` first.", success=False)
        path, err = self._ensure_repo(repo)
        if err:
            return err
        mode = "--hard" if hard else "--mixed"
        code, out, serr = self._git(path, ["reset", mode, ref])
        if code != 0:
            return self.result(f"reset failed: {serr or out}", success=False)
        return self.result(f"Reset to {ref} ({mode}).")

    async def git_clean(self, repo: str = "", dry_run: bool = True):
        """
        Remove untracked files. ALWAYS run with dry_run=True first to preview!
        Requires allow_destructive setting for the real delete.

        Args:
            repo: Repo name or path.
            dry_run: Preview what would be deleted without deleting (default True).
        """
        if not dry_run and not self.config.get("allow_destructive", default=False):
            return self.result("Real cleaning is disabled. Ask the user to enable `allow_destructive` first.", success=False)
        path, err = self._ensure_repo(repo)
        if err:
            return err
        args = ["clean", "-nd"] if dry_run else ["clean", "-fd"]
        code, out, serr = self._git(path, args)
        if code != 0:
            return self.result(f"clean failed: {serr or out}", success=False)
        return self.result(out or "Nothing to clean.")

    async def git_remote_list(self, repo: str = ""):
        """
        List remotes with their URLs.

        Args:
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["remote", "-v"])
        if code != 0:
            return self.result(f"remote list failed: {serr or out}", success=False)
        return self.result(out or "No remotes.")

    async def git_remote_add(self, name: str, url: str, repo: str = ""):
        """
        Add a remote (e.g. origin).

        Args:
            name: Remote name (usually 'origin').
            url: Remote URL (https or git@...).
            repo: Repo name or path.
        """
        path, err = self._ensure_repo(repo)
        if err:
            return err
        code, out, serr = self._git(path, ["remote", "add", name, url])
        if code != 0:
            return self.result(f"remote add failed: {serr or out}", success=False)
        return self.result(f"Added remote '{name}' -> {url}")

    async def git_clone(self, url: str, dest: str):
        """
        Clone a repository from a URL.

        Args:
            url: Repo URL to clone.
            dest: Destination path to clone into.
        """
        if not self.config.get("allow_clone", default=True):
            return self.result("Clone is disabled in module settings.", success=False)
        code, out, serr = _run(["git", "clone", url, dest])
        if code != 0:
            return self.result(f"clone failed: {serr or out}", success=False)
        return self.result(f"Cloned {url} into {dest}")

    async def git_init(self, path: str):
        """
        Initialize a new git repository at the given path.

        Args:
            path: Folder to turn into a git repo.
        """
        code, out, serr = self._git(path, ["init", "-b", self.config.get("default_branch", "main")])
        if code != 0:
            # older git versions don't support -b
            code2, out2, serr2 = self._git(path, ["init"])
            if code2 != 0:
                return self.result(f"init failed: {serr2 or serr}", success=False)
        return self.result(f"Initialized new repo at {path}")

    async def git_create_pr(self, title: str, repo: str = "", body: str = "", base: str = ""):
        """
        Create a GitHub pull request from the current branch (requires the `gh` CLI, logged in).

        Args:
            title: PR title.
            repo: Repo name or path.
            body: PR description.
            base: Base branch to merge into. Defaults to the configured default_branch.
        """
        if not shutil.which("gh"):
            return self.result("GitHub CLI (`gh`) is not installed. Install it to use PR tools.", success=False)
        path, err = self._ensure_repo(repo)
        if err:
            return err
        args = ["pr", "create", "--title", title]
        if body:
            args += ["--body", body]
        args += ["--base", base or self.config.get("default_branch", "main")]
        code, out, serr = _run(["gh"] + args, cwd=path)
        if code != 0:
            return self.result(f"PR creation failed: {serr or out}", success=False)
        return self.result(f"PR created: {out}")
