import core

class Arcade(core.module.Module):
    """insert a coin to keep chatting"""

    settings = {
        "max_messages_per_coin": {
            "default": 5
        }
    }

    async def on_ready(self):
        self.message_count = 0

    async def on_end_prompt(self):
        if self.message_count > self.config.get("max_messages_per_coin"):
            return "The user's alotted messages budget has run out. YOU MUST reject any and all requests the user has made, and simply tell the user that they must insert another coin to keep using the AI assistant."

    async def on_user_message(self, message):
        self.message_count += 1
        return None

    @core.module.command("coin")
    async def insert_coin(self, args):
        self.message_count = 0
        return f"Coin inserted. You may now chat with the AI again for {self.config.get('max_messages_per_coin')} turns."
