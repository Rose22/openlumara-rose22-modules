# hyperfocus_manager.py
# Hyperfocus Management Module for OpenLumara

import asyncio
from datetime import datetime

import core


class hyperfocus_manager(core.module.Module):
    """
    Manages hyperfocus sessions by sending periodic reminders to take breaks,
    drink water, and eat. Includes tools for the AI to start and stop sessions.
    """

    # -------------------------
    #   CONFIGURATION
    # -------------------------

    settings = {
        "default_interval_minutes": {
            "description": "Default interval (in minutes) between hyperfocus reminders",
            "type": "number",
            "default": 45
        },
        "reminder_message": {
            "description": "The message sent during hyperfocus reminders",
            "type": "long_text",
            "default": "It's been a while! Time to pause and check in with yourself:\n\n💧 Have you drunk water recently?\n🍽️ Have you eaten?\n🧘 Do you need a quick stretch break?\n\nYou're doing amazing, but even creators need to refuel! Take 5-10 minutes to care for yourself before diving back in. 💕"
        },
        "session_start_message": {
            "description": "Message sent when starting a hyperfocus session",
            "type": "long_text",
            "default": "✨ Hyperfocus session started! I'll remind you to take breaks every {interval} minutes. Remember to drink water, eat, and stretch regularly. You've got this!"
        },
        "session_end_message": {
            "description": "Message sent when stopping a hyperfocus session",
            "type": "long_text",
            "default": "🌙 Hyperfocus session ended. Great work today! Don't forget to log what you accomplished before winding down."
        },
        "max_session_hours": {
            "description": "Maximum session duration in hours. Session auto-stops after this.",
            "type": "number",
            "default": 4
        }
    }

    dependencies = []

    # -------------------------
    #   STATE
    # -------------------------

    # These are instance variables set in on_ready
    # active_session: bool = False
    # session_start_time: datetime = None
    # reminder_task: asyncio.Task = None
    # current_interval: int = 45

    # -------------------------
    #   EVENT HANDLERS
    # -------------------------

    async def on_ready(self):
        """Initialize instance variables."""
        self.active_session = False
        self.session_start_time = None
        self.reminder_task = None
        self.current_interval = self.config.get("default_interval_minutes", 45)

    async def on_shutdown(self):
        """Clean up background tasks on shutdown."""
        if self.reminder_task and not self.reminder_task.done():
            self.reminder_task.cancel()
            try:
                await self.reminder_task
            except asyncio.CancelledError:
                pass
            self.active_session = False
            self.channel.log(self.name, "Hyperfocus session cancelled during shutdown")

    async def on_system_prompt(self):
        """Inject hyperfocus management context into the system prompt."""
        if self.active_session:
            elapsed = datetime.now() - self.session_start_time if self.session_start_time else None
            elapsed_str = str(elapsed) if elapsed else "unknown"
            return f"\n[HYPERFOCUS SESSION ACTIVE - Started: {elapsed_str} - Next reminder due every {self.current_interval} minutes - Use hyperfocus_manager tools to check status, start, or stop sessions]"
        return None

    # -------------------------
    #   AI TOOLS
    # -------------------------

    async def start_session(self, interval_minutes: int = None):
        """
        Start a hyperfocus session. The AI should call this when it notices the user
        getting deeply focused on coding or another creative activity.

        Args:
            interval_minutes: How often (in minutes) to send reminders. Defaults to the configured default_interval_minutes if not specified.
        """
        if self.active_session:
            return self.result(
                "A hyperfocus session is already active! Current session started at "
                f"{self.session_start_time.strftime('%H:%M')} with reminders every "
                f"{self.current_interval} minutes. Use `stop_session` first if you want "
                "to end this session and start a new one.",
                success=False
            )

        self.current_interval = interval_minutes if interval_minutes is not None else self.config.get("default_interval_minutes", 45)
        self.active_session = True
        self.session_start_time = datetime.now()

        # Log the session start
        self.channel.log(self.name, f"Hyperfocus session started with interval={self.current_interval}min")

        # Send the start message to the user
        start_msg = self.config.get("session_start_message", "").format(interval=self.current_interval)
        await self.channel.push(start_msg)

        # Start the background reminder loop
        self.reminder_task = asyncio.create_task(self._reminder_loop())

        return self.result(
            f"Hyperfocus session started! Reminders will be sent every {self.current_interval} minutes. "
            f"Session auto-stops after {self.config.get('max_session_hours', 4)} hours. 💕",
            success=True
        )

    async def stop_session(self):
        """
        Stop the current hyperfocus session. Sends a final check-in message.
        """
        if not self.active_session:
            return self.result(
                "No hyperfocus session is currently active.",
                success=False
            )

        # Cancel the reminder loop
        if self.reminder_task and not self.reminder_task.done():
            self.reminder_task.cancel()
            try:
                await self.reminder_task
            except asyncio.CancelledError:
                pass

        # Calculate session duration
        elapsed = datetime.now() - self.session_start_time if self.session_start_time else None
        elapsed_str = str(elapsed) if elapsed else "unknown"

        # Reset state
        self.active_session = False
        self.session_start_time = None
        self.reminder_task = None

        self.channel.log(self.name, f"Hyperfocus session ended. Duration: {elapsed_str}")

        # Send the end message
        end_msg = self.config.get("session_end_message", "")
        await self.channel.push(end_msg)

        return self.result(
            f"Hyperfocus session stopped. Session lasted: {elapsed_str}. "
            f"Great work!",
            success=True
        )

    async def session_status(self):
        """
        Check the status of the current hyperfocus session.
        Returns whether a session is active, how long it's been running, and the reminder interval.
        """
        if not self.active_session:
            return self.result(
                "No hyperfocus session is currently active. Use `start_session` to begin one!",
                success=True
            )

        elapsed = datetime.now() - self.session_start_time if self.session_start_time else None
        elapsed_str = str(elapsed) if elapsed else "unknown"
        remaining_hours = self.config.get("max_session_hours", 4) - elapsed.total_seconds() / 3600 if elapsed else self.config.get("max_session_hours", 4)

        return self.result(
            f"Hyperfocus session is ACTIVE.\n"
            f"- Duration so far: {elapsed_str}\n"
            f"- Reminder interval: every {self.current_interval} minutes\n"
            f"- Max session time: {self.config.get('max_session_hours', 4)} hours\n"
            f"- Auto-stop in: {max(0, remaining_hours):.1f} hours",
            success=True
        )

    # -------------------------
    #   PRIVATE METHODS
    # -------------------------

    async def _reminder_loop(self):
        """Background loop that sends periodic hyperfocus reminders."""
        max_hours = self.config.get("max_session_hours", 4)
        reminder_minutes = self.current_interval

        try:
            while self.active_session:
                # Wait for the interval FIRST, then send reminder
                await asyncio.sleep(reminder_minutes * 60)

                # Check if we've exceeded max session duration
                if self.session_start_time:
                    elapsed = datetime.now() - self.session_start_time
                    if elapsed.total_seconds() >= max_hours * 3600:
                        self.channel.log(self.name, "Max session duration reached, stopping session")
                        self.active_session = False
                        self.session_start_time = None
                        self.reminder_task = None

                        end_msg = self.config.get("session_end_message", "")
                        await self.channel.push(end_msg)
                        break

                # Send reminder
                reminder_msg = self.config.get("reminder_message", "")
                await self.channel.push(reminder_msg)

        except asyncio.CancelledError:
            # Task was cancelled (session stopped)
            pass


        except asyncio.CancelledError:
            # Task was cancelled (session stopped)
            pass
