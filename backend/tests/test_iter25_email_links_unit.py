# Iteration 25: emailed-link origin selection (no database required)
import os
import sys

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "personalos-test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from starlette.requests import Request  # noqa: E402

from auth import origin_of, trusted_browser_origin  # noqa: E402


def request_with(headers: dict[str, str]) -> Request:
    raw = [(key.lower().encode(), value.encode()) for key, value in headers.items()]
    return Request({"type": "http", "method": "POST", "path": "/", "headers": raw, "query_string": b""})


class TestTrustedBrowserOrigin:
    def test_accepts_platform_public_domain(self):
        assert trusted_browser_origin("https://ai-personalos.emergent.host/login?x=1") == "https://ai-personalos.emergent.host"

    def test_accepts_localhost(self):
        assert trusted_browser_origin("http://localhost:3000") == "http://localhost:3000"
        assert trusted_browser_origin("http://127.0.0.1:8001/") == "http://127.0.0.1:8001"

    def test_rejects_unknown_and_internal_hosts(self):
        assert trusted_browser_origin("https://evil.example.com") is None
        assert trusted_browser_origin("https://ai-personalos.cluster8.deploy.aws.emergentcf.cloud") is None
        assert trusted_browser_origin("javascript:alert(1)") is None


class TestOriginOf:
    def test_app_url_takes_priority(self, monkeypatch):
        monkeypatch.setenv("APP_URL", "https://public.example.com/")
        request = request_with({"host": "internal-service:8001", "origin": "https://ai-personalos.emergent.host"})
        assert origin_of(request) == "https://public.example.com"

    def test_prefers_trusted_browser_origin_over_internal_host(self, monkeypatch):
        monkeypatch.delenv("APP_URL", raising=False)
        request = request_with({
            "host": "ai-personalos.cluster8.deploy.aws.emergentcf.cloud",
            "origin": "https://ai-personalos.emergent.host",
        })
        assert origin_of(request) == "https://ai-personalos.emergent.host"

    def test_referer_is_used_when_origin_is_missing(self, monkeypatch):
        monkeypatch.delenv("APP_URL", raising=False)
        request = request_with({
            "host": "internal-service:8001",
            "referer": "https://ai-personalos.emergent.host/reset-password/",
        })
        assert origin_of(request) == "https://ai-personalos.emergent.host"

    def test_public_host_is_used_without_browser_headers(self, monkeypatch):
        monkeypatch.delenv("APP_URL", raising=False)
        request = request_with({"host": "ai-personalos.preview.emergentagent.com"})
        assert origin_of(request) == "https://ai-personalos.preview.emergentagent.com"

    def test_local_host_uses_http(self, monkeypatch):
        monkeypatch.delenv("APP_URL", raising=False)
        assert origin_of(request_with({"host": "localhost:8001"})) == "http://localhost:8001"
