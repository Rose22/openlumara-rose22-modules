import core
import asyncio
import random
from datetime import datetime

class PushNotificationTest(core.module.Module):
    """
    A module that tests push notification support in various ways.
    Demonstrates different push notification scenarios and patterns.
    """

    # -------------------------
    #   CONFIGURATION
    # -------------------------

    settings = {
        "enabled_tests": {
            "type": "list",
            "description": "List of tests to run. Use 'all' to run all tests.",
            "default": ["all"]
        },
        "notification_interval": {
            "type": "number",
            "description": "Interval in seconds between periodic notifications",
            "default": 300
        },
        "test_duration": {
            "type": "number",
            "description": "Duration in seconds for continuous notification tests",
            "default": 3600
        },
        "max_notifications": {
            "type": "number",
            "description": "Maximum number of notifications to send before stopping",
            "default": 100
        },
        "include_debug_info": {
            "description": "Include debug information in notifications",
            "default": True
        },
        "notification_styles": {
            "type": "list",
            "description": "Styles to test for notifications",
            "default": ["simple", "formatted", "rich", "batch"]
        }
    }

    # -------------------------
    #   EVENT HANDLERS
    # -------------------------

    async def on_ready(self):
        """Initialize the push notification test module."""
        self.notification_count = 0
        self.test_results = []
        self.running_tests = {}
        
        self.channel.log(self.name, "Push Notification Test module initialized")
        
        # Start background test runner
        self.background_task = asyncio.create_task(self._background_test_runner())
        
        await self.push_simple_notification()
        self.channel.log(self.name, "Push Notification Test module ready")

    async def on_shutdown(self):
        """Clean up resources when module is shutting down."""
        if hasattr(self, 'background_task') and self.background_task:
            self.background_task.cancel()
            try:
                await self.background_task
            except asyncio.CancelledError:
                pass
        
        # Save test results
        await self._save_test_results()
        
        self.channel.log(self.name, "Push Notification Test module shut down")

    async def on_user_message(self, content: str):
        """Test push notification on user message."""
        if "test push" in content.lower():
            await self.push_simple_notification()
            await self.push_formatted_notification()
            return False

    async def on_assistant_message(self, content: str):
        """Test push notification on assistant message."""
        if "test push" in content.lower():
            await self.push_rich_notification()

    async def on_background(self):
        """Background task for continuous notification testing."""
        try:
            while True:
                await asyncio.sleep(self.config.get("notification_interval", 300))
                
                # Check if we should continue testing
                if self.notification_count >= self.config.get("max_notifications", 100):
                    break
                
                # Send periodic test notifications
                await self.push_periodic_notification()
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.channel.log(self.name, f"Background task error: {str(e)}")

    async def on_system_prompt(self):
        """Add test status to system prompt."""
        return f"[Push Notification Test: {self.notification_count} notifications sent]"

    # -------------------------
    #   PUSH NOTIFICATION TESTS
    # -------------------------

    async def push_simple_notification(self):
        """Test 1: Simple text notification."""
        try:
            message = "🔔 Simple Push Notification Test\n\nThis is a basic test of the push notification system."
            await self.channel.push(message)
            self.notification_count += 1
            self.test_results.append({
                "test": "simple_notification",
                "status": "success",
                "timestamp": datetime.now().isoformat()
            })
            self.channel.log(self.name, "Simple notification test completed successfully")
        except Exception as e:
            self.test_results.append({
                "test": "simple_notification",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            self.channel.log(self.name, f"Simple notification test failed: {str(e)}")

    async def push_formatted_notification(self):
        """Test 2: Formatted notification with markdown."""
        try:
            message = """📝 **Formatted Push Notification Test**

*This notification demonstrates markdown formatting capabilities:*

• **Bold text** for emphasis
*Italic text* for style
~~Strikethrough~~ for corrections

```python
# Code block example
def test_push():
    return "Success!"
```

> Quote block for important information

🔗 [Example Link](https://example.com) for hyperlinks"""
            
            await self.channel.push(message)
            self.notification_count += 1
            self.test_results.append({
                "test": "formatted_notification",
                "status": "success",
                "timestamp": datetime.now().isoformat()
            })
            self.channel.log(self.name, "Formatted notification test completed successfully")
        except Exception as e:
            self.test_results.append({
                "test": "formatted_notification",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            self.channel.log(self.name, f"Formatted notification test failed: {str(e)}")

    async def push_rich_notification(self):
        """Test 3: Rich notification with various content types."""
        try:
            message = """🎨 **Rich Push Notification Test**

📊 **Statistics:**
- Total notifications sent: {count}
- Test duration: {duration}
- Success rate: {rate}%

🕒 **Time Information:**
- Current time: {time}
- Date: {date}

🎯 **Test Categories:**
1. Simple notifications ✅
2. Formatted notifications ✅
3. Rich notifications ✅
4. Batch notifications ⏳
5. Scheduled notifications ⏳

📈 **Performance Metrics:**
- Response time: < 1s
- Message size: {size} bytes
- Content types: text, markdown, code"""
            
            # Format the message with dynamic content
            formatted_message = message.format(
                count=self.notification_count,
                duration=self.config.get("test_duration", 3600),
                rate=95.5,  # Simulated success rate
                time=datetime.now().strftime("%H:%M:%S"),
                date=datetime.now().strftime("%Y-%m-%d"),
                size=len(message)
            )
            
            await self.channel.push(formatted_message)
            self.notification_count += 1
            self.test_results.append({
                "test": "rich_notification",
                "status": "success",
                "timestamp": datetime.now().isoformat()
            })
            self.channel.log(self.name, "Rich notification test completed successfully")
        except Exception as e:
            self.test_results.append({
                "test": "rich_notification",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            self.channel.log(self.name, f"Rich notification test failed: {str(e)}")

    async def push_batch_notification(self):
        """Test 4: Batch notification with multiple messages."""
        try:
            batch_messages = [
                "📦 Batch Test - Message 1: Initial notification",
                "📦 Batch Test - Message 2: Status update",
                "📦 Batch Test - Message 3: Progress report",
                "📦 Batch Test - Message 4: Final summary"
            ]
            
            for i, message in enumerate(batch_messages, 1):
                await self.channel.push(message)
                await asyncio.sleep(0.5)  # Small delay between messages
                self.notification_count += 1
            
            self.test_results.append({
                "test": "batch_notification",
                "status": "success",
                "timestamp": datetime.now().isoformat(),
                "message_count": len(batch_messages)
            })
            self.channel.log(self.name, f"Batch notification test completed successfully ({len(batch_messages)} messages)")
        except Exception as e:
            self.test_results.append({
                "test": "batch_notification",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            self.channel.log(self.name, f"Batch notification test failed: {str(e)}")

    async def push_periodic_notification(self):
        """Test 5: Periodic notification for continuous testing."""
        try:
            message = f"""⏰ **Periodic Push Notification**

📅 **Test Run #{self.notification_count + 1}**

🔹 **Status:** Active
🔹 **Interval:** {self.config.get("notification_interval", 300)}s
🔹 **Duration:** {self.config.get("test_duration", 3600)}s
🔹 **Max Notifications:** {self.config.get("max_notifications", 100)}

📊 **Current Progress:**
- Notifications sent: {self.notification_count}
- Remaining: {self.config.get("max_notifications", 100) - self.notification_count}
- Time elapsed: {self._get_elapsed_time()}

🎯 **Next Scheduled Test:**
- Type: {random.choice(["simple", "formatted", "rich", "batch"])}
- Estimated time: {datetime.now().strftime("%H:%M:%S")}"""
            
            await self.channel.push(message)
            self.notification_count += 1
            self.test_results.append({
                "test": "periodic_notification",
                "status": "success",
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            self.test_results.append({
                "test": "periodic_notification",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })

    async def push_scheduled_notification(self, delay_seconds: int = 60):
        """Test 6: Scheduled notification with delay."""
        try:
            message = f"""⏳ **Scheduled Push Notification**

📅 **Scheduled for:** {datetime.now().isoformat()}
🕒 **Delay:** {delay_seconds} seconds

🔹 **Purpose:** Test delayed notification delivery
🔹 **Expected delivery:** {datetime.now().strftime("%H:%M:%S")}

📊 **Test Information:**
- Notification ID: {self.notification_count + 1}
- Schedule type: delayed
- Priority: normal"""
            
            # Wait for the specified delay
            await asyncio.sleep(delay_seconds)
            
            await self.channel.push(message)
            self.notification_count += 1
            self.test_results.append({
                "test": "scheduled_notification",
                "status": "success",
                "timestamp": datetime.now().isoformat(),
                "delay": delay_seconds
            })
            self.channel.log(self.name, f"Scheduled notification test completed successfully (delay: {delay_seconds}s)")
        except Exception as e:
            self.test_results.append({
                "test": "scheduled_notification",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            self.channel.log(self.name, f"Scheduled notification test failed: {str(e)}")

    # -------------------------
    #   BACKGROUND TEST RUNNER
    # -------------------------

    async def _background_test_runner(self):
        """Run background tests based on configuration."""
        try:
            enabled_tests = self.config.get("enabled_tests", ["all"])
            
            if "all" in enabled_tests:
                # Run all tests
                await self._run_all_tests()
            else:
                # Run specific tests
                for test_name in enabled_tests:
                    if hasattr(self, f"push_{test_name}_notification"):
                        await getattr(self, f"push_{test_name}_notification")()
                    else:
                        self.channel.log(self.name, f"Unknown test: {test_name}")
                        
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.channel.log(self.name, f"Background test runner error: {str(e)}")

    async def _run_all_tests(self):
        """Run all available notification tests."""
        tests = [
            self.push_simple_notification,
            self.push_formatted_notification,
            self.push_rich_notification,
            self.push_batch_notification,
            self.push_periodic_notification
        ]
        
        for test in tests:
            if self.notification_count < self.config.get("max_notifications", 100):
                await test()
                await asyncio.sleep(1)  # Small delay between tests

    # -------------------------
    #   HELPER METHODS
    # -------------------------

    def _get_elapsed_time(self):
        """Calculate elapsed time since module started."""
        start_time = getattr(self, 'start_time', datetime.now())
        elapsed = datetime.now() - start_time
        return str(elapsed).split('.')[0]  # Remove microseconds

    async def _save_test_results(self):
        """Save test results to persistent storage."""
        try:
            storage = core.storage.StorageDict("push_notification_test_results", type="json")
            storage["test_results"] = self.test_results
            storage["total_notifications"] = self.notification_count
            storage["last_updated"] = datetime.now().isoformat()
            storage.save()
            self.channel.log(self.name, "Test results saved successfully")
        except Exception as e:
            self.channel.log(self.name, f"Failed to save test results: {str(e)}")

    # -------------------------
    #   AI TOOLS
    # -------------------------

    async def run_all_tests(self):
        """
        Run all push notification tests.

        This tool executes all available notification tests and reports the results.
        """
        self.channel.log(self.name, "Running all push notification tests...")
        await self._run_all_tests()
        
        summary = f"""📊 **Push Notification Test Summary**

✅ Tests completed: {len(self.test_results)}
🔔 Total notifications sent: {self.notification_count}
⏱️ Duration: {self._get_elapsed_time()}

📋 **Test Results:**
{self._format_test_results()}"""
        
        return self.result(summary, success=True)

    async def run_specific_test(self, test_name: str):
        """
        Run a specific push notification test.

        Args:
            test_name: Name of the test to run (simple, formatted, rich, batch, periodic, scheduled)
        """
        test_methods = {
            "simple": self.push_simple_notification,
            "formatted": self.push_formatted_notification,
            "rich": self.push_rich_notification,
            "batch": self.push_batch_notification,
            "periodic": self.push_periodic_notification,
            "scheduled": lambda: self.push_scheduled_notification(30)
        }
        
        if test_name in test_methods:
            self.channel.log(self.name, f"Running {test_name} notification test...")
            await test_methods[test_name]()
            
            summary = f"""📊 **{test_name.capitalize()} Notification Test Results**

✅ Test completed successfully
🔔 Notification sent: {self.notification_count}
⏱️ Duration: {self._get_elapsed_time()}"""
            
            return self.result(summary, success=True)
        else:
            return self.result(f"Unknown test: {test_name}. Available tests: {', '.join(test_methods.keys())}", success=False)

    async def get_test_status(self):
        """
        Get the current status of push notification tests.

        Returns the current test results and notification count.
        """
        status = f"""📊 **Push Notification Test Status**

🔔 Total notifications sent: {self.notification_count}
⏱️ Duration: {self._get_elapsed_time()}
📋 Tests completed: {len(self.test_results)}

📈 **Success Rate:** {self._calculate_success_rate()}%

📋 **Recent Test Results:**
{self._format_test_results()[:500]}"""  # Limit output size
        
        return self.result(status, success=True)

    async def clear_test_results(self):
        """
        Clear all test results and reset counters.
        """
        self.notification_count = 0
        self.test_results = []
        
        # Clear stored results
        try:
            storage = core.storage.StorageDict("push_notification_test_results", type="json")
            storage.clear()
            storage.save()
        except Exception as e:
            self.channel.log(self.name, f"Failed to clear stored results: {str(e)}")
        
        return self.result("✅ Test results cleared successfully", success=True)

    # -------------------------
    #   HELPER FORMATTING
    # -------------------------

    def _format_test_results(self):
        """Format test results for display."""
        if not self.test_results:
            return "No test results available."
        
        formatted = ""
        for result in self.test_results[-10:]:  # Show last 10 results
            status_icon = "✅" if result["status"] == "success" else "❌"
            formatted += f"{status_icon} {result['test']}: {result['status']}\n"
        
        return formatted

    def _calculate_success_rate(self):
        """Calculate the success rate of tests."""
        if not self.test_results:
            return 0.0
        
        success_count = sum(1 for result in self.test_results if result["status"] == "success")
        return (success_count / len(self.test_results)) * 100
