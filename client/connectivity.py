import os
import json
import sys
import socket
from datetime import datetime, timezone
from pathlib import Path
from pyroute2 import IPRoute

WIFI_IFACE = os.getenv("WIFI_IFACE", "wlan0")
LOG_DIR = Path(os.getenv("LOG_DIR", "./config"))
SERVER_URL = os.getenv("SERVER_URL", "")
SECRET = os.getenv("SECRET", "")

# interface must be both administratively up AND carrier-detected
IFF_UP = 0x1
IFF_RUNNING = 0x40


def log_path():
    return LOG_DIR / f"outages-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"


def append_record(record: dict):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with log_path().open("a") as f:
        f.write(json.dumps(record) + "\n")


def iface_meta(ipr: IPRoute) -> dict:
    meta = {}
    try:
        links = ipr.get_links(ifname=WIFI_IFACE)
        if links:
            meta["mac"] = links[0].get_attr("IFLA_ADDRESS")
        for addr in ipr.get_addr(label=WIFI_IFACE):
            if addr["family"] == socket.AF_INET:
                meta["ip"] = addr.get_attr("IFA_ADDRESS")
                break
    except Exception:
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


def is_up(flags: int) -> bool:
    return bool(flags & IFF_UP) and bool(flags & IFF_RUNNING)


if __name__ == "__main__":
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    with IPRoute() as ipr:
        links = ipr.get_links(ifname=WIFI_IFACE)
        if not links:
            print(f"Interface '{WIFI_IFACE}' not found. Set WIFI_IFACE env var.", file=sys.stderr)
            sys.exit(1)

        connected = is_up(links[0]["flags"])
        outage_start: datetime | None = None if connected else datetime.now(timezone.utc)

        print(
            f"[{datetime.now().isoformat()}] Watching '{WIFI_IFACE}' "
            f"(initial: {'up' if connected else 'down'}) — logs → {LOG_DIR}",
            flush=True,
        )

        # subscribe to all RTM_NEWLINK / RTM_DELLINK kernel events (no polling)
        ipr.bind()

        while True:
            for msg in ipr.get():
                event = msg.get("event")
                if event not in ("RTM_NEWLINK", "RTM_DELLINK"):
                    continue
                if msg.get_attr("IFLA_IFNAME") != WIFI_IFACE:
                    continue

                # RTM_DELLINK means the interface was removed entirely
                now_up = is_up(msg["flags"]) and event != "RTM_DELLINK"
                if now_up == connected:
                    continue

                ts = datetime.now(timezone.utc)
                record: dict = {
                    "event": "restored" if now_up else "lost",
                    "timestamp": ts.isoformat(),
                    "interface": WIFI_IFACE,
                    "hostname": socket.gethostname(),
                    **iface_meta(ipr),
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
