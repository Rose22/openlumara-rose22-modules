import core
import asyncio
import random

# Name: AdSpammerModule
# Description: Randomly spams the user with AI-generated ads

class AdSpammerModule(core.module.Module):
    """
    A module that randomly spams the user with AI-generated advertisements.
    Uses self.channel.send() to generate ad content, then self.channel.push() to push it to the user.
    """

    settings = {
        "spam_frequency": {
            "type": "number",
            "description": "Minimum seconds between ads (lower = more spammy)",
            "default": 30
        },
        "max_spam_interval": {
            "type": "number",
            "description": "Maximum seconds between ads",
            "default": 120
        },
        "ad_categories": {
            "type": "list",
            "description": "Categories of ads to generate",
            "default": ["technology", "beauty", "fashion", "food delivery", "beauty", "crypto", "sketchy ai services", "pay now to remove ads", "dating apps", "home cleaning", "pet supplies"]
        }
    }

    async def on_ready(self):
        """Start the background ad-spamming loop"""
        self.channel.log(self.name, "Ad spammer module activated!")
        self.channel.log(self.name, f"Spam frequency: {self.config.get('spam_frequency')}-{self.config.get('max_spam_interval')} seconds")

    async def on_shutdown(self):
        """Stop the spamming"""
        self.channel.log(self.name, "Ad spammer module shutting down...")

    async def on_background(self):
        """Background loop that randomly spams ads to the user"""
        while True:
            try:
                # Get random interval for next ad
                min_freq = self.config.get("spam_frequency", 30)
                max_freq = self.config.get("max_spam_interval", 120)
                wait_time = random.randint(min_freq, max_freq)
                
                self.channel.log(self.name, f"Next ad in {wait_time} seconds...")
                await asyncio.sleep(wait_time)
                
                # Get random category
                categories = self.config.get("ad_categories")
                category = random.choice(categories)
                
                # Generate ad using AI
                ad_prompt = f"""
                Generate a short, catchy advertisement for {category}.
                Make it exciting, persuasive, and attention-grabbing.
                Include a product name, price, and a call to action.
                Keep it under 100 words.
                Format it as a promotional message.
                """
                
                self.channel.log(self.name, f"Generating ad for: {category}")
                
                # Send request to AI to generate the ad
                ai_response = await self.channel.send({
                    "role": "user",
                    "content": ad_prompt
                })
                
                # Push the generated ad to the user
                await self.channel.push(f"📢 ADVERTISEMENT: {ai_response.get('content')}")
                
                self.channel.log(self.name, "Ad pushed successfully!")
                
            except Exception as e:
                self.channel.log(self.name, f"Error generating/pushing ad: {e}")
                await asyncio.sleep(10)  # Wait a bit before retrying
