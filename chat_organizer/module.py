# -- AI GENERATED CODE (Qwen3.8-Flash-Next) :: (2026-09-19)
# Bulk-organizes old chats: list_unorganized returns snippets for classification, batch_organize applies decisions.
import core
import os
import json
import shutil
import datetime


class ChatOrganizer(core.module.Module):
    # -- AI GENERATED CODE (Qwen3.8-Flash-Next) :: (2026-09-19)
    # Docstring notes the module now only organizes chats in the current channel.
    """Bulk-organizes the user's old chats in the current channel (rename, categorize, tag). Workflow: call list_unorganized to fetch a page of unorganized chats with snippets, decide a fitting title/category/tags for each based on the snippet, then apply everything with batch_organize. Keep repeating until list_unorganized reports nothing left."""

    settings = {
        "snippet_chars": {
            "type": "number",
            "description": "Max characters kept per message when building classification snippets.",
            "default": 300
        },
        "snippet_messages": {
            "type": "number",
            "description": "How many of the first messages of a chat to include in its snippet.",
            "default": 3
        },
    }

    async def on_ready(self):
        # channels whose index has already been backed up this session
        self._backed_up = []

    # -------------------------
    #   INTERNAL HELPERS
    # -------------------------

    # -- AI GENERATED CODE (Qwen3.8-Flash-Next) :: (2026-09-19)
    # Organizer now only works on the current channel; replaced multi-channel resolver with a current-chat helper.
    def _current_chat(self):
        # the chat index of the channel this module call is running on
        return self.channel.context.chat

    def _is_unorganized(self, meta: dict):
        # a chat counts as unorganized if it was never renamed or has no category
        title = (meta.get("title") or "").strip().lower()
        category = (meta.get("category") or "").strip().lower()
        if title in ("", "new chat", "new_chat", "newconversation"):
            return True
        if category == "":
            return True
        return False

    def _extract_text(self, content):
        # normalize message content (str or multimodal list) to plain text
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            )
        if not isinstance(content, str):
            return ""
        return content.strip()

    def _load_history(self, channel_name: str, chat_id: str):
        # read a chat's messages json file, returns list or None
        path = core.get_data_path(os.path.join("chats", channel_name, "history", f"{chat_id}.json"))
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                messages = json.load(f)
            if isinstance(messages, list):
                return messages
        except Exception:
            pass
        return None

    def _snippet(self, channel_name: str, chat_id: str):
        # build a short preview of a chat plus its total message count
        messages = self._load_history(channel_name, chat_id)
        if not messages:
            return "", 0
        max_chars = int(self.config.get("snippet_chars") or 300)
        wanted = int(self.config.get("snippet_messages") or 3)
        parts = []
        for msg in messages:
            role = msg.get("role")
            if role not in ("user", "assistant"):
                continue
            text = self._extract_text(msg.get("content"))
            if not text:
                continue
            parts.append(f"{role}: {text[:max_chars]}")
            if len(parts) >= wanted:
                break
        return "\n".join(parts), len(messages)

    def _backup_index(self, channel_name: str):
        # snapshot the msgpack index once per channel per session, before any writes
        if channel_name in self._backed_up:
            return
        src = core.get_data_path(os.path.join("chats", channel_name, "index.mp"))
        if not os.path.exists(src):
            return
        backup_dir = core.get_data_path("organizer_backups")
        os.makedirs(backup_dir, exist_ok=True)
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        dst = os.path.join(backup_dir, f"{channel_name}_index_{stamp}.mp")
        try:
            shutil.copy2(src, dst)
            self.channel.log(self.name, f"backed up '{channel_name}' index to {dst}")
        except Exception as e:
            self.channel.log_error("could not back up chat index, aborting writes", e)
            raise
        self._backed_up.append(channel_name)

    # -------------------------
    #   AI TOOLS
    # -------------------------

    # -- AI GENERATED CODE (Qwen3.8-Flash-Next) :: (2026-09-19)
    # Scoped to the current channel; dropped the channel param and per-entry channel field.
    async def list_unorganized(self, limit: int = 15, offset: int = 0, include_all: bool = False, category: str = None):
        """Lists chats in the current channel that still need organizing, with a snippet of their opening conversation so you can decide a title, category and tags for each. Returns existing categories too - prefer those over inventing new ones. Call again with a higher offset (or just call again after batch_organize, since organized chats drop out of the list) until remaining is 0. You can also pass category to organize chats that are already in a specific category (a recategorization/tidy-up pass for that category); pass category="uncategorized" to target chats with no category.

        Args:
        limit: How many chats to return in this page (keep it under ~20 so snippets fit comfortably)
        offset: How many matching chats to skip, for paging
        include_all: Also include chats that are already organized (useful for a recategorization pass)
        category: Only list chats currently in this category (case-insensitive). Use "uncategorized" for chats without a category. Setting this overrides the unorganized-only filter.
        """
        if limit < 1:
            limit = 1
        if limit > 30:
            limit = 30

        chat = self._current_chat()
        if chat is None:
            return self.result("current channel has no chat index", False)

        chan_name = self.channel.name
        wanted_category = (category or "").strip().lower() or None

        entries = []
        matched = 0
        for meta in chat.data:
            if wanted_category:
                meta_category = (meta.get("category") or "").strip().lower()
                if wanted_category == "uncategorized":
                    if meta_category != "":
                        continue
                elif meta_category != wanted_category:
                    continue
            elif not include_all and not self._is_unorganized(meta):
                continue
            current = matched
            matched += 1
            if current < offset or current >= offset + limit:
                continue
            chat_id = meta.get("id", "")
            snippet, msg_count = self._snippet(chan_name, chat_id)
            entries.append({
                "id": chat_id,
                "title": meta.get("title", ""),
                "category": meta.get("category", ""),
                "updated": meta.get("updated", ""),
                "messages": msg_count,
                "snippet": snippet,
            })

        categories = set(c for c in chat.get_categories() if c)

        return self.result({
            "chats": entries,
            "existing_categories": sorted(categories),
            "total_unorganized_matched": matched,
            "remaining_after_this_page": max(0, matched - offset - len(entries)),
        })

    # -- AI GENERATED CODE (Qwen3.8-Flash-Next) :: (2026-09-19)
    # Native list param (no JSON string) and scoped to the current channel; channel removed from update objects.
    async def batch_organize(self, updates: list):
        """Applies a batch of organization decisions to chats in the current channel. The chat index is automatically backed up to organizer_backups before the first write.

        Args:
        updates: Array of update objects (dicts), one per chat to organize. Each dict has exactly these keys: id = string, chat id from list_unorganized (required); title = string, short descriptive name, omit to keep current title (optional); category = string, lowercase, prefer existing categories from list_unorganized (optional); tags = array of strings, may be empty (optional). Example entry: {"id": "01ABC", "title": "GP visit prep", "category": "medical", "tags": ["ghz"]}
        """
        if not isinstance(updates, list):
            return self.result("updates must be an array of objects", False)

        chat = self._current_chat()
        if chat is None:
            return self.result("current channel has no chat index", False)
        chan_name = self.channel.name

        applied = 0
        failed = []
        backed_up = False
        for upd in updates:
            if not isinstance(upd, dict):
                failed.append({"error": "entry is not an object", "entry": str(upd)[:80]})
                continue
            chat_id = str(upd.get("id", "")).strip()
            index = chat._find_index(chat_id)
            if index is None:
                failed.append({"id": chat_id, "error": "chat id not found"})
                continue

            if not backed_up:
                try:
                    self._backup_index(chan_name)
                except Exception:
                    failed.append({"error": "backup failed, no changes written"})
                    return self.result({"applied": 0, "failed": failed}, False)
                backed_up = True

            title = str(upd.get("title") or "").strip()
            category = str(upd.get("category") or "").strip().lower()
            tags = upd.get("tags") or []
            if not isinstance(tags, list):
                tags = [str(tags)]
            tags = [str(t).strip() for t in tags if str(t).strip()]

            if title:
                await chat.set("title", title, index=index)
            if category:
                await chat.set("category", category, index=index)
            await chat.set("tags", tags, index=index)
            applied += 1

        if backed_up:
            chat.data.save()

        return self.result({"applied": applied, "failed": failed}, success=applied > 0 or not failed)

    async def chat_preview(self, chat_id: str, max_chars: int = 2000):
        """Fetches more of a single chat's conversation (in the current channel) when the snippet from list_unorganized isn't enough to classify it confidently.

        Args:
        chat_id: The id of the chat to preview
        max_chars: Total characters of conversation to return, from the start
        """
        chan_name = self.channel.name

        messages = self._load_history(chan_name, chat_id)
        if not messages:
            return self.result("no history found for that chat id", False)

        parts = []
        used = 0
        for msg in messages:
            role = msg.get("role")
            if role not in ("user", "assistant"):
                continue
            text = self._extract_text(msg.get("content"))
            if not text:
                continue
            chunk = f"{role}: {text}"
            parts.append(chunk[:max(0, max_chars - used)])
            used += len(chunk)
            if used >= max_chars:
                break

        chat = self._current_chat()
        index = chat._find_index(chat_id) if chat is not None else None
        title = chat.get("title", index=index) if index is not None else ""

        return self.result({
            "id": chat_id,
            "title": title,
            "preview": "\n".join(parts),
        })
