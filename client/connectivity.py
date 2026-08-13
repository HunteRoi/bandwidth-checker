import os
import json
import sys
import socket
import time
from datetime import datetime, timezone
from pathlib import Path

WIFI_IFACE = os.getenv("WIFI_IFACE", "wlan0")
LOG_DIR = Path(os.getenv("LOG_DIR", "./config"))
SERVER_URL = os.getenv("SERVER_URL", "")
SECRET = os.getenv("SECRET", "")
# poll interval in ms — 200 ms gives <200 ms detection latency with negligible CPU
POLL_MS = int(os.getenv("POLL_MS", "200"))

_CARRIER = Path(f"/sys/class/net/{WIFI_IFACE}/carrier")
_ADDRESS = Path(f"/sys/class/net/{WIFI_IFACE}/address")


def is_up() -> bool:
    try:
        return _CARRIER.read_text().strip() == "1"
    except OSError:
        return False


def log_path() -> Path:
    return LOG_DIR / f"outages-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"


def append_record(record: dict):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with log_path().open("a") as f:
        f.write(json.dumps(record) + "\n")


def iface_meta() -> dict:
    meta = {}
    try:
        meta["mac"] = _ADDRESS.read_text().strip()
    except OSError:
        pass
    try:
        # connect to an external address (no data sent) to discover the outbound IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            meta["ip"] = s.getsockname()[0]
    except OSError:
        pass
    return meta


def post_to_server(record: dict):
    if not SERVER_URL:
        return
    try:
        import requests
        requests.post(
            f"{SERVER_URL.rstrip('/')}/outage",
            json={**record, "pw": SECRET},
            timeout=5,
        )
    except Exception as exc:
        print(f"Server POST failed: {exc}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    if not _CARRIER.exists():
        print(f"Interface '{WIFI_IFACE}' not found. Set WIFI_IFACE env var.", file=sys.stderr)
        sys.exit(1)

    connected = is_up()
    outage_start: datetime | None = None if connected else datetime.now(timezone.utc)

    print(
        f"[{datetime.now().isoformat()}] Watching '{WIFI_IFACE}' "
        f"(initial: {'up' if connected else 'down'}) — logs → {LOG_DIR}",
        flush=True,
    )

    while True:
        time.sleep(POLL_MS / 1000)
        now_up = is_up()

        if now_up == connected:
            continue

        ts = datetime.now(timezone.utc)
        record: dict = {
            "event": "restored" if now_up else "lost",
            "timestamp": ts.isoformat(),
            "interface": WIFI_IFACE,
            "hostname": socket.gethostname(),
            **iface_meta(),
        }

        if not now_up:
            outage_start = ts
        elif outage_start is not None:
            record["duration_s"] = round((ts - outage_start).total_seconds(), 3)
            outage_start = None

        print(
            f"[{ts.isoformat()}] WiFi {record['event'].upper()}"
            + (f" — down for {record.get('duration_s')}s" if now_up else ""),
            flush=True,
        )
        append_record(record)
        post_to_server(record)
        connected = now_up
