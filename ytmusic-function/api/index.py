"""Authenticated Vercel Function that exposes the shared ytmusicapi adapter."""

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler

from catalog import handle_request

MAX_BODY_BYTES = 16_384


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        expected_token = os.environ.get("YTMUSIC_API_TOKEN", "")
        provided_token = self.headers.get("authorization", "")
        if len(expected_token) < 32:
            self.write_json(503, {"error": "Catalog is not configured."})
            return
        if not hmac.compare_digest(provided_token, f"Bearer {expected_token}"):
            self.write_json(401, {"error": "Unauthorized."})
            return

        try:
            content_length = int(self.headers.get("content-length", ""))
        except ValueError:
            self.write_json(400, {"error": "Invalid request."})
            return
        if content_length < 1 or content_length > MAX_BODY_BYTES:
            self.write_json(413, {"error": "Request body is too large."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
            result = handle_request(payload)
        except (json.JSONDecodeError, ValueError):
            self.write_json(400, {"error": "Invalid search request."})
            return
        except Exception:
            self.write_json(502, {"error": "YouTube Music is temporarily unavailable."})
            return

        self.write_json(200, result)

    def write_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return
