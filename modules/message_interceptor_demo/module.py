import core

class MessageInterceptorDemo(core.module.Module):
    """demonstrates the ability for user modules to intercept your messages and do stuff with it"""

    async def on_ready(self):
        self.attempt_count = 0

    async def on_user_message(self, content):
        if "the earth king has invited you to lake laogai" in content.lower():
            await self.channel.push("I would be honored to accept his invitation.")
            return False
        elif "ba sing se" in content.lower():
            await self.channel.push("There is no war in Ba Sing Se.")
            return True
        elif content == "login":
            self.attempt_count += 1
            await self.channel.push(f"ACCESS DENIED. Attempt: {self.attempt_count}")
        elif "parrot" in content:
            await self.channel.push("Squawk!")
            return False
