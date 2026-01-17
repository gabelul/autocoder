"""
FastAPI Backend Server
======================

Web UI server for the Autonomous Coding Agent.
Provides REST API and WebSocket endpoints for project management,
feature tracking, and agent control.
"""

import contextlib
import os
import sys
import threading
import time
import webbrowser
import uvicorn
from pathlib import Path

from autocoder.core.port_config import get_ui_port
from autocoder.server.server_lock import ServerLock


def start_server(host: str = "127.0.0.1", port: int | None = None, reload: bool = False) -> None:
    """
    Start the AutoCoder web UI server.

    Args:
        host: Host to bind to (default: 127.0.0.1 for security)
        port: Port to bind to (default: AUTOCODER_UI_PORT or 8888)
        reload: Enable auto-reload for development (default: False)
    """
    if port is None:
        port = get_ui_port()
    use_colors_env = os.environ.get("AUTOCODER_UVICORN_COLORS", "").strip().lower()
    if use_colors_env:
        use_colors = use_colors_env in ("1", "true", "yes", "on")
    else:
        # Default: disable ANSI colors on Windows or when output is non-interactive.
        if os.name == "nt" or not sys.stderr.isatty():
            use_colors = False
        else:
            use_colors = None
    disable_lock = str(os.environ.get("AUTOCODER_DISABLE_UI_LOCK", "")).lower() in ("1", "true", "yes")

    def should_open_browser() -> bool:
        raw = str(os.environ.get("AUTOCODER_OPEN_UI", "")).strip().lower()
        if raw:
            return raw not in ("0", "false", "no", "off")
        return True

    def open_browser_later() -> None:
        if host not in ("127.0.0.1", "localhost"):
            return
        if not should_open_browser():
            return
        try:
            delay = float(os.environ.get("AUTOCODER_OPEN_UI_DELAY_S", "1.0"))
        except ValueError:
            delay = 1.0
        url = f"http://{host}:{port}/"

        def _worker() -> None:
            time.sleep(max(0.0, delay))
            with contextlib.suppress(Exception):
                webbrowser.open(url, new=2)

        threading.Thread(target=_worker, daemon=True).start()
    if disable_lock:
        open_browser_later()
        uvicorn.run(
            "autocoder.server.main:app",
            host=host,
            port=port,
            reload=reload,
            use_colors=use_colors,
        )
        return

    with ServerLock(port):
        open_browser_later()
        uvicorn.run(
            "autocoder.server.main:app",
            host=host,
            port=port,
            reload=reload,
            use_colors=use_colors,
        )


__all__ = ["start_server"]
