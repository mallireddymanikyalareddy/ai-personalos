# Iteration 10: workingHours.days bool rejection + body-size middleware (413 before body read)
import os
import socket
import ssl
from urllib.parse import urlparse

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def demo():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/v1/auth/login", json={"identifier": "demo", "password": "DemoPass123!"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return s


# Preferences: booleans are not weekday numbers
def test_working_days_bool_rejected(demo):
    r = demo.patch(f"{BASE_URL}/api/v1/users/me", json={"preferences": {"workingHours": {"days": [True]}}})
    assert r.status_code == 400, r.text
    assert "workingHours.days" in r.text


def test_working_days_mixed_bool_rejected(demo):
    r = demo.patch(f"{BASE_URL}/api/v1/users/me", json={"preferences": {"workingHours": {"days": [1, False]}}})
    assert r.status_code == 400, r.text


def test_working_days_valid_ok(demo):
    r = demo.get(f"{BASE_URL}/api/v1/users/me")
    assert r.status_code == 200
    r = demo.patch(f"{BASE_URL}/api/v1/users/me", json={"preferences": {"workingHours": {"days": [1, 2, 3, 4, 5]}}})
    assert r.status_code == 200, r.text


def _raw_request(path, content_length, send_bytes=b"", method="PUT"):
    """Send headers claiming a huge body but only send a few bytes; read the response."""
    # Cloudflare/ingress rejects a Content-Length/body mismatch, so this hits the backend directly
    u = urlparse(os.environ.get("BACKEND_DIRECT_URL", "http://localhost:8001"))
    host = u.hostname
    port = u.port or (443 if u.scheme == "https" else 80)
    sock = socket.create_connection((host, port), timeout=20)
    if u.scheme == "https":
        sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
    req = (
        f"{method} {path} HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/json\r\n"
        f"Content-Length: {content_length}\r\nConnection: close\r\n\r\n"
    ).encode() + send_bytes
    sock.sendall(req)
    data = b""
    try:
        while True:
            chunk = sock.recv(65536)
            if not chunk:
                break
            data += chunk
            if b"\r\n\r\n" in data and len(data) > 200:
                break
    except socket.timeout:
        pass
    sock.close()
    return data.decode(errors="replace")


# Body size: 413 returned without the body being sent (proves the middleware runs before reading)
def test_large_content_length_413_before_body():
    resp = _raw_request("/api/v1/state", 27 * 1024 * 1024, b"{")
    assert " 413 " in resp.split("\r\n")[0], resp[:300]
    assert "PAYLOAD_TOO_LARGE" in resp


def test_large_content_length_413_other_route():
    resp = _raw_request("/api/v1/auth/login", 30 * 1024 * 1024, b"{", method="POST")
    assert " 413 " in resp.split("\r\n")[0], resp[:300]


def test_small_body_not_413():
    r = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"identifier": "nobody_x", "password": "wrongpassword1"})
    assert r.status_code != 413


# Public path with a real 27MB body: ingress sometimes returns 502 (backend closes early) - flaky, retried
def test_public_large_body_413():
    body = b'{"envelope":{"x":"' + b"a" * (27 * 1024 * 1024) + b'"}}'
    codes = []
    for _ in range(3):
        r = requests.put(f"{BASE_URL}/api/v1/state", data=body, headers={"Content-Type": "application/json"}, timeout=90)
        codes.append(r.status_code)
        if r.status_code == 413:
            assert r.json()["code"] == "PAYLOAD_TOO_LARGE"
            break
    print("public codes:", codes)
    assert 413 in codes, codes
