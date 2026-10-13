#!/usr/bin/env python3
"""Serve the static curriculum site locally for review."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

ROOT = Path(__file__).parent
PORT = int(os.environ.get("PORT", "8000"))
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))

if __name__ == "__main__":
    print(f"Space Curriculum Planner: http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
