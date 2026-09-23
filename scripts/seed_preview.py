#!/usr/bin/env python3
"""Fills a running platform (the workspace Preview) with simulator-generated fleets.

Data travels the production path: simulated trackers → real protocols over TCP → gateway →
HTTP API. Every machine created here is named "(симулятор)" so it is never mistaken for a real one.
"""

from __future__ import annotations

import asyncio
import json
import pathlib
import secrets
import sys
import threading
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "gateway"), str(ROOT / "scripts")]

from gateway_e2e import api, free_port  # noqa: E402
from itles_gateway.forwarder import Forwarder  # noqa: E402
from itles_gateway.queue import DurableQueue  # noqa: E402
from itles_gateway.records import Mapping  # noqa: E402
from itles_gateway.server import Gateway  # noqa: E402
from sim import uplink  # noqa: E402
from sim.tracker import run  # noqa: E402

FLEET = [
    ("harvester", "galileosky", "356307042441013", {"name": "Харвестер John Deere 1270G (симулятор)", "category": "harvester", "make": "John Deere", "model": "1270G"}, "can", Mapping()),
    ("forwarder", "galileosky", "356307042441014", {"name": "Форвардер Ponsse Buffalo (симулятор)", "category": "forwarder", "make": "Ponsse", "model": "Buffalo"}, "can", Mapping()),
    ("excavator", "egts", "868204005185938", {"name": "Экскаватор SANY SY500H (симулятор)", "category": "excavator", "chassis": "tracked", "rotating_upper": True, "make": "SANY", "model": "SY500H"}, "voltage", Mapping(egts_hours_counter=1, egts_hours_scale=0.1)),
    ("timber_truck", "wialon_ips", "861230043345678", {"name": "Лесовоз КАМАЗ-43118 (симулятор)", "category": "timber_truck", "make": "КАМАЗ", "model": "43118"}, "can", Mapping(param_hours={"eng_hours": "ecu"}, param_mileage={"can_dist_km": "ecu"})),
    ("tractor_can", "wialon_ips", "861230043345679", {"name": "Трактор Кировец К-7М (симулятор)", "category": "tractor", "make": "Кировец", "model": "К-7М"}, "can", Mapping(param_hours={"eng_hours": "ecu"}, param_mileage={"can_dist_km": "ecu"})),
]


def main() -> None:
    env = dict(l.split("=", 1) for l in (ROOT / "platform/.data/preview.env").read_text().split())
    base = "http://127.0.0.1:3000"
    creds_file = ROOT / "platform/.data/preview-logins.json"
    creds = json.loads(creds_file.read_text()) if creds_file.exists() else {}
    st, r = api(base, "GET", "/api/setup/status")
    if r["needs_setup"]:
        creds = {"fuchs-admin": secrets.token_urlsafe(9), "taiga-glavny": secrets.token_urlsafe(9), "sever-dist": secrets.token_urlsafe(9)}
        _, r = api(base, "POST", "/api/setup", {"setup_key": env["SETUP_KEY"], "org_name": "FUCHS", "login": "fuchs-admin", "password": creds["fuchs-admin"]})
        admin = r["token"]
        _, d = api(base, "POST", "/api/orgs", {"kind": "distributor", "name": "Дистрибьютор Северо-Запад (демо)"}, admin)
        _, inv = api(base, "POST", f"/api/orgs/{d['org']['id']}/invites", {"role": "admin"}, admin)
        api(base, "POST", "/api/auth/redeem", {"code": inv["code"], "login": "sever-dist", "password": creds["sever-dist"]})
        _, c = api(base, "POST", "/api/orgs", {"kind": "customer", "name": "Леспромхоз «Тайга» (демо)", "parent_id": d["org"]["id"]}, admin)
        _, inv = api(base, "POST", f"/api/orgs/{c['org']['id']}/invites", {"role": "admin"}, admin)
        api(base, "POST", "/api/auth/redeem", {"code": inv["code"], "login": "taiga-glavny", "password": creds["taiga-glavny"]})
        creds_file.write_text(json.dumps(creds))
        org = c["org"]["id"]
    else:
        _, r = api(base, "POST", "/api/auth/login", {"login": "fuchs-admin", "password": creds["fuchs-admin"]})
        admin = r["token"]
        org = next(o["id"] for o in api(base, "GET", "/api/orgs", token=admin)[1]["orgs"] if o["kind"] == "customer")

    existing = {m["name"] for m in api(base, "GET", "/api/machines", token=admin)[1]["machines"]}
    todo = [f for f in FLEET if f[3]["name"] not in existing]
    ids = {}
    for prof, proto, imei, body, hours, mapping in todo:
        _, m = api(base, "POST", "/api/machines", {**body, "org_id": org}, admin)
        ids[imei] = m["machine"]["id"]
        api(base, "POST", f"/api/machines/{ids[imei]}/sources", {"kind": "tracker", "external_id": imei}, admin)

    q = DurableQueue(":memory:")
    gw = Gateway(q, {f[2]: f[5] for f in FLEET})
    ports = {p: free_port() for p in ("galileosky", "egts", "wialon_ips")}
    loop = asyncio.new_event_loop()
    ready = threading.Event()

    def serve():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(gw.serve(ports, "127.0.0.1"))
        ready.set()
        loop.run_forever()

    threading.Thread(target=serve, daemon=True).start()
    ready.wait(10)
    threading.Thread(target=Forwarder(q, base, env["GATEWAY_TOKEN"], batch=2000).loop, kwargs={"idle": 0.2}, daemon=True).start()
    now = int(time.time())
    start = now - 2 * 86400 - 1800
    for prof, proto, imei, body, hours, mapping in todo:
        recs = sorted(run(prof, start, 2, seed=11).records, key=lambda r: r.t)
        recs = [r for r in recs if r.t < now]
        if proto == "galileosky":
            uplink.send_galileosky("127.0.0.1", ports[proto], imei, recs)
        elif proto == "egts":
            uplink.send_egts("127.0.0.1", ports[proto], imei, recs, hours)
        else:
            uplink.send_wialon("127.0.0.1", ports[proto], imei, recs, hours)
        print(body["name"], len(recs), "records sent")
    while q.size():
        time.sleep(0.5)
    for imei, mid in ids.items():
        api(base, "POST", f"/api/machines/{mid}/service", {"item": "Моторное масло", "interval_h": 500, "last_done_h": 2700, "volume_l": 32, "product": "FUCHS TITAN CARGO MAXX 10W-40"}, admin)
        api(base, "POST", f"/api/machines/{mid}/service", {"item": "Гидравлическое масло", "interval_h": 2000, "last_done_h": 1500, "volume_l": 180, "product": "FUCHS RENOLIN B 46 HVI"}, admin)
    print("logins:", ", ".join(creds))


if __name__ == "__main__":
    main()
