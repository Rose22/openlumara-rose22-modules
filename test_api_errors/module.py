import core
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

class TestApiErrors(core.module.Module):
    """
    Comprehensive API error handling test suite for OpenLumara.
    Tests all error cases in core/api.py using mocking.
    """

    settings = {
        "verbose": {
            "description": "Show detailed mock setup info for each test",
            "default": False
        }
    }

    async def on_ready(self):
        self.results = {}
        self.manager.log("test_api_errors", "Module loaded. Use /test_api_errors run_all to run the full suite.")

    # -------------------------
    #   INDIVIDUAL ERROR TESTS
    # -------------------------

    @core.module.command("test_rate_limit", help={
        "": "Tests RateLimitError handling"
    })
    async def test_rate_limit(self, args: list):
        """Test that RateLimitError is properly caught and returned as APIError."""
        await self.channel.push("🧪 Testing RateLimitError handling...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            from openai import RateLimitError
            mock_create.side_effect = RateLimitError("Rate limit exceeded", None, None)

            client.connected = True
            result = await client._request([{"role": "user", "content": "hi"}])

            if isinstance(result, core.api.APIError) and "Rate limit" in str(result):
                await self.channel.push("✅ RateLimitError test PASSED")
                self.results["rate_limit"] = "PASS"
            else:
                await self.channel.push(f"❌ RateLimitError test FAILED: got {type(result).__name__}: {result}")
                self.results["rate_limit"] = "FAIL"

        return self.results["rate_limit"]

    @core.module.command("test_auth_error", help={
        "": "Tests AuthenticationError handling"
    })
    async def test_auth_error(self, args: list):
        """Test that AuthenticationError is properly caught and returns APIError."""
        await self.channel.push("🧪 Testing AuthenticationError handling...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            from openai import AuthenticationError
            mock_create.side_effect = AuthenticationError("Invalid API key", None, None)

            client.connected = True
            result = await client._request([{"role": "user", "content": "hi"}])

            if isinstance(result, core.api.APIError) and "Authentication" in str(result):
                await self.channel.push("✅ AuthenticationError test PASSED")
                self.results["auth_error"] = "PASS"
            else:
                await self.channel.push(f"❌ AuthenticationError test FAILED: got {type(result).__name__}: {result}")
                self.results["auth_error"] = "FAIL"

        return self.results["auth_error"]

    @core.module.command("test_bad_request", help={
        "": "Tests BadRequestError handling (model not found)"
    })
    async def test_bad_request(self, args: list):
        """Test that BadRequestError for model not found is properly caught."""
        await self.channel.push("🧪 Testing BadRequestError (model not found)...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            from openai import BadRequestError
            mock_create.side_effect = BadRequestError("Model 'xyz' not found", None, None)

            client.connected = True
            result = await client._request([{"role": "user", "content": "hi"}])

            if isinstance(result, core.api.APIError) and "not found" in str(result).lower():
                await self.channel.push("✅ BadRequestError (model not found) test PASSED")
                self.results["bad_request"] = "PASS"
            else:
                await self.channel.push(f"❌ BadRequestError test FAILED: got {type(result).__name__}: {result}")
                self.results["bad_request"] = "FAIL"

        return self.results["bad_request"]

    @core.module.command("test_connection_error", help={
        "": "Tests APIConnectionError handling"
    })
    async def test_connection_error(self, args: list):
        """Test that APIConnectionError is properly caught."""
        await self.channel.push("🧪 Testing APIConnectionError handling...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            from openai import APIConnectionError
            mock_create.side_effect = APIConnectionError("Connection refused", None, None)

            client.connected = True
            result = await client._request([{"role": "user", "content": "hi"}])

            if isinstance(result, core.api.APIError) and "connect" in str(result).lower():
                await self.channel.push("✅ APIConnectionError test PASSED")
                self.results["connection_error"] = "PASS"
            else:
                await self.channel.push(f"❌ APIConnectionError test FAILED: got {type(result).__name__}: {result}")
                self.results["connection_error"] = "FAIL"

        return self.results["connection_error"]

    @core.module.command("test_not_found", help={
        "": "Tests NotFoundError handling"
    })
    async def test_not_found(self, args: list):
        """Test that NotFoundError is properly caught."""
        await self.channel.push("🧪 Testing NotFoundError handling...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            from openai import NotFoundError
            mock_create.side_effect = NotFoundError("Model does not exist", None, None)

            client.connected = True
            result = await client._request([{"role": "user", "content": "hi"}])

            if isinstance(result, core.api.APIError) and "not found" in str(result).lower():
                await self.channel.push("✅ NotFoundError test PASSED")
                self.results["not_found"] = "PASS"
            else:
                await self.channel.push(f"❌ NotFoundError test FAILED: got {type(result).__name__}: {result}")
                self.results["not_found"] = "FAIL"

        return self.results["not_found"]

    @core.module.command("test_api_status_error", help={
        "": "Tests APIStatusError handling"
    })
    async def test_api_status_error(self, args: list):
        """Test that APIStatusError (5xx errors) is properly caught."""
        await self.channel.push("🧪 Testing APIStatusError handling...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            from openai import APIStatusError
            mock_create.side_effect = APIStatusError("API Status Error")

            client.connected = True
            result = await client._request([{"role": "user", "content": "hi"}])

            if isinstance(result, core.api.APIError) and "Status Error" in str(result):
                await self.channel.push("✅ APIStatusError test PASSED")
                self.results["api_status_error"] = "PASS"
            else:
                await self.channel.push(f"❌ APIStatusError test FAILED: got {type(result).__name__}: {result}")
                self.results["api_status_error"] = "FAIL"

        return self.results["api_status_error"]

    @core.module.command("test_cancel", help={
        "": "Tests asyncio.CancelledError handling"
    })
    async def test_cancel(self, args: list):
        """Test that CancelledError is properly handled."""
        await self.channel.push("🧪 Testing CancelledError handling...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
            async def cancel_after_delay(*args, **kwargs):
                await asyncio.sleep(0.05)
                raise asyncio.CancelledError("Request cancelled")

            mock_create.side_effect = cancel_after_delay

            client.connected = True
            client.cancel_request = False

            try:
                result = await client._request([{"role": "user", "content": "hi"}])
                await self.channel.push("❌ CancelledError test FAILED: should have raised CancelledError")
                self.results["cancel"] = "FAIL"
            except asyncio.CancelledError:
                await self.channel.push("✅ CancelledError test PASSED (correctly propagated)")
                self.results["cancel"] = "PASS"

        return self.results["cancel"]

    @core.module.command("test_blank_context", help={
        "": "Tests blank context handling"
    })
    async def test_blank_context(self, args: list):
        """Test that blank context returns an APIError."""
        await self.channel.push("🧪 Testing blank context handling...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        result = await client._request(None)

        if isinstance(result, core.api.APIError) and "blank" in str(result).lower():
            await self.channel.push("✅ Blank context test PASSED")
            self.results["blank_context"] = "PASS"
        else:
            await self.channel.push(f"❌ Blank context test FAILED: got {type(result).__name__}: {result}")
            self.results["blank_context"] = "FAIL"

        return self.results["blank_context"]

    @core.module.command("test_connect_bad_request", help={
        "": "Tests BadRequestError during connect()"
    })
    async def test_connect_bad_request(self, args: list):
        """Test that BadRequestError during connect is handled."""
        await self.channel.push("🧪 Testing BadRequestError during connect()...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI, 'models', new_callable=lambda: MagicMock(list=AsyncMock(side_effect=Exception("Bad request")))):
            result = await client.connect()

            if isinstance(result, core.api.APIError):
                await self.channel.push(f"✅ Connect BadRequestError test PASSED: {result}")
                self.results["connect_bad_request"] = "PASS"
            else:
                await self.channel.push(f"❌ Connect BadRequestError test FAILED: got {type(result).__name__}: {result}")
                self.results["connect_bad_request"] = "FAIL"

        return self.results["connect_bad_request"]

    @core.module.command("test_connect_auth_error", help={
        "": "Tests AuthenticationError during connect()"
    })
    async def test_connect_auth_error(self, args: list):
        """Test that AuthenticationError during connect is handled."""
        await self.channel.push("🧪 Testing AuthenticationError during connect()...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI, 'models', new_callable=lambda: MagicMock(list=AsyncMock(side_effect=Exception("Authentication failed")))):
            result = await client.connect()

            if isinstance(result, core.api.APIError):
                await self.channel.push(f"✅ Connect AuthError test PASSED: {result}")
                self.results["connect_auth_error"] = "PASS"
            else:
                await self.channel.push(f"❌ Connect AuthError test FAILED: got {type(result).__name__}: {result}")
                self.results["connect_auth_error"] = "FAIL"

        return self.results["connect_auth_error"]

    @core.module.command("test_connect_connection_error", help={
        "": "Tests APIConnectionError during connect()"
    })
    async def test_connect_connection_error(self, args: list):
        """Test that APIConnectionError during connect is handled."""
        await self.channel.push("🧪 Testing APIConnectionError during connect()...")

        mock_manager = self._create_mock_manager()
        client = self._create_client(mock_manager)

        with patch.object(client._AI, 'models', new_callable=lambda: MagicMock(list=AsyncMock(side_effect=Exception("Connection failed")))):
            result = await client.connect()

            if isinstance(result, core.api.APIError):
                await self.channel.push(f"✅ Connect ConnectionError test PASSED: {result}")
                self.results["connect_connection_error"] = "PASS"
            else:
                await self.channel.push(f"❌ Connect ConnectionError test FAILED: got {type(result).__name__}: {result}")
                self.results["connect_connection_error"] = "FAIL"

        return self.results["connect_connection_error"]

    # -------------------------
    #   BULK RUNNER
    # -------------------------

    @core.module.command("run_all", help={
        "": "Runs all API error tests"
    })
    async def run_all_tests(self, args: list):
        """Run all API error handling tests."""
        await self.channel.push("🚀 Running all API error tests...")
        await self.channel.push("=" * 50)

        tests = [
            ("RateLimitError", self.test_rate_limit, []),
            ("AuthenticationError", self.test_auth_error, []),
            ("BadRequestError (model not found)", self.test_bad_request, []),
            ("APIConnectionError", self.test_connection_error, []),
            ("NotFoundError", self.test_not_found, []),
            ("APIStatusError", self.test_api_status_error, []),
            ("CancelledError", self.test_cancel, []),
            ("Blank context", self.test_blank_context, []),
            ("Connect BadRequestError", self.test_connect_bad_request, []),
            ("Connect AuthError", self.test_connect_auth_error, []),
            ("Connect ConnectionError", self.test_connect_connection_error, []),
        ]

        for name, test_func, test_args in tests:
            await self.channel.push(f"\n⏳ Testing {name}...")
            try:
                await test_func(test_args)
            except Exception as e:
                await self.channel.push(f"❌ {name} crashed: {e}")
                self.results[name] = "CRASH"

        await self.channel.push("\n" + "=" * 50)
        await self.channel.push("📊 TEST RESULTS:")

        total = len(self.results)
        passed = sum(1 for v in self.results.values() if v == "PASS")
        failed = sum(1 for v in self.results.values() if v == "FAIL")
        crashed = sum(1 for v in self.results.values() if v == "CRASH")

        for name, status in self.results.items():
            icon = "✅" if status == "PASS" else "❌"
            await self.channel.push(f"  {icon} {name}: {status}")

        await self.channel.push(f"\n📈 {passed}/{total} passed | {failed} failed | {crashed} crashed")

        if failed == 0 and crashed == 0:
            await self.channel.push("\n🎉 All tests passed! Your error handling is solid!")
        else:
            await self.channel.push("\n⚠️ Some tests failed. Check the output above for details.")

        return self.results

    # -------------------------
    #   HELPERS
    # -------------------------

    def _create_mock_manager(self):
        """Create a mock manager object for testing."""
        mock = AsyncMock()
        mock.args.insecure_tls = True
        mock.log = AsyncMock()
        mock.log_error = AsyncMock()
        mock.tools = []
        mock.get_system_prompt = AsyncMock(return_value="test system prompt")
        return mock

    def _create_client(self, mock_manager):
        """Create an APIClient with mocked dependencies."""
        from core.api import APIClient

        client = APIClient(manager=mock_manager)
        client._AI = MagicMock()
        client.connected = False
        client._model = "test-model"
        client._connection_attempts = 0
        client._connection_error = None
        client._warmup_task = None
        client._warmup_done = asyncio.Event()
        client._warmup_queue = asyncio.Queue()
        client.cancel_request = False
        client.cancel_prompt_warmup = False

        # Mock httpx client
        client._httpx_client = MagicMock()

        return client
