import type { Db } from './db.js';
import { pickBest, type Candidate, type CounterMethod } from './domain/counters.js';
import { freshness, type Freshness } from './domain/staleness.js';
import { robustDistance, type MachineProfile } from './domain/odometry.js';

export interface CounterView {
  value: number;
  t: number;
  method: CounterMethod | 'gnss' | 'gnss+reading';
  exact: boolean;
  calibrated: boolean;
  source_kind: string | null;
  note?: string;
  last_exact?: { value: number; t: number; method: string } | null;
}

export interface MachineSummary {
  id: string;
  org_id: string;
  org_name: string;
  name: string;
  category: string;
  make: string | null;
  model: string | null;
  year: number | null;
  chassis: 'wheeled' | 'tracked';
  rotating_upper: boolean;
  location_enabled: boolean;
  location_visible: boolean;
  position: { t: number; lat: number; lon: number; speed_kmh: number | null; course: number | null } | null;
  engine_hours: CounterView | null;
  odometer: CounterView | null;
  last_data_t: number | null;
  freshness: Freshness;
  sources: Array<{ id: string; kind: string; label: string | null; last_seen_at: number | null }>;
}

const ms = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function summarize(db: Db, ids: string[], viewerOrgId: string, now = Date.now()): Promise<MachineSummary[]> {
  if (ids.length === 0) return [];
  const machines = await db.query<any>(
    `select m.id, m.org_id, o.name as org_name, m.name, m.category, m.make, m.model, m.year, m.chassis,
            m.rotating_upper, m.location_enabled, o.share_location_up, o.tz
       from machines m join orgs o on o.id = m.org_id
      where m.id = any($1::text[]) and not m.archived
      order by o.name, m.name`,
    [ids],
  );
  const visibleLoc = new Set(
    machines.rows.filter((m) => m.location_enabled && (m.org_id === viewerOrgId || m.share_location_up)).map((m) => m.id),
  );
  const [positions, counters, cals, readings, gnss, sources] = await Promise.all([
    visibleLoc.size
      ? db.query<any>(
          `select m.id as machine_id, p.lat, p.lon, p.speed_kmh, p.course, (extract(epoch from p.t) * 1000)::float8 as t
             from unnest($1::text[]) as m(id)
             cross join lateral (select * from positions where machine_id = m.id order by t desc limit 1) p`,
          [[...visibleLoc]],
        )
      : Promise.resolve({ rows: [] as any[], rowCount: 0 }),
    db.query<any>(
      `select s.id as source_id, s.kind, s.machine_id, c.metric, c.value, c.method,
              (extract(epoch from c.t) * 1000)::float8 as t
         from sources s
         cross join lateral (
           select distinct on (metric) metric, value, method, t from counters
            where source_id = s.id order by metric, t desc
         ) c
        where s.machine_id = any($1::text[])`,
      [ids],
    ),
    db.query<any>(
      `select c.source_id, c.metric, c.scale, c.offset_value, c.basis from calibrations c
         join sources s on s.id = c.source_id where s.machine_id = any($1::text[])`,
      [ids],
    ),
    db.query<any>(
      `select distinct on (machine_id, metric) machine_id, metric, value, (extract(epoch from t) * 1000)::float8 as t
         from readings where machine_id = any($1::text[]) order by machine_id, metric, t desc`,
      [ids],
    ),
    db.query<any>(
      `select machine_id, sum(gnss_km)::float8 as km, sum(points)::int as points,
              (extract(epoch from max(last_t)) * 1000)::float8 as last_t
         from daily_stats where machine_id = any($1::text[]) group by machine_id`,
      [ids],
    ),
    db.query<any>(
      `select id, machine_id, kind, label, (extract(epoch from last_seen_at) * 1000)::float8 as last_seen_at
         from sources where machine_id = any($1::text[]) order by created_at`,
      [ids],
    ),
  ]);

  const calBy = new Map(cals.rows.map((c) => [`${c.source_id}|${c.metric}`, c]));
  const out: MachineSummary[] = [];
  for (const m of machines.rows) {
    const pos = positions.rows.find((p) => p.machine_id === m.id);
    const mc = counters.rows.filter((c) => c.machine_id === m.id);
    const cands = (metric: string): Array<Candidate & { kind: string }> => {
      const list: Array<Candidate & { kind: string }> = mc
        .filter((c) => c.metric === metric)
        .map((c) => {
          const cal = calBy.get(`${c.source_id}|${metric}`);
          return {
            value: cal ? Number(c.value) * cal.scale + cal.offset_value : Number(c.value),
            t: Number(c.t),
            method: c.method,
            sourceId: c.source_id,
            calibrated: !!cal,
            kind: c.kind,
          };
        });
      const rd = readings.rows.find((r) => r.machine_id === m.id && r.metric === metric);
      if (rd) list.push({ value: Number(rd.value), t: Number(rd.t), method: 'reading', calibrated: true, kind: 'manual' });
      return list;
    };

    const hc = cands('engine_hours');
    const hb = pickBest(hc);
    const hours: CounterView | null = hb
      ? {
          value: hb.value,
          t: hb.t,
          method: hb.method,
          exact: hb.exact,
          calibrated: hb.calibrated,
          source_kind: hc.find((c) => c.sourceId === hb.sourceId && c.method === hb.method)?.kind ?? null,
          last_exact: hb.lastExact ? { value: hb.lastExact.value, t: hb.lastExact.t, method: hb.lastExact.method } : null,
        }
      : null;

    let odometer: CounterView | null = null;
    const oc = cands('odometer_km');
    // Priority: CAN/ECU odometer (equals the dashboard) > our validated GNSS odometry >
    // tracker/platform GNSS counters (unknown filters; -57%..+1138% on slow machines in tests).
    const ob = pickBest(oc.filter((c) => c.method === 'ecu'));
    const fallback = pickBest(oc.filter((c) => c.method === 'tracker' || c.method === 'platform'));
    const g = gnss.rows.find((x) => x.machine_id === m.id);
    if (ob) {
      odometer = {
        value: ob.value,
        t: ob.t,
        method: ob.method,
        exact: true,
        calibrated: ob.calibrated,
        source_kind: oc.find((c) => c.sourceId === ob.sourceId)?.kind ?? null,
      };
    } else if (g && g.points > 0) {
      const rd = oc.find((c) => c.method === 'reading');
      const profile: MachineProfile = { chassis: m.chassis, rotatingUpper: m.rotating_upper, category: m.category };
      if (rd) {
        const since = await gnssKmSince(db, m.id, rd.t, profile);
        odometer = {
          value: rd.value + since,
          t: Math.max(rd.t, Number(g.last_t) || 0),
          method: 'gnss+reading',
          exact: false,
          calibrated: true,
          source_kind: null,
          note: 'показание счётчика + пробег по ГНСС после него',
        };
      } else {
        odometer = {
          value: Number(g.km),
          t: Number(g.last_t),
          method: 'gnss',
          exact: false,
          calibrated: false,
          source_kind: null,
          note: 'с начала наблюдения',
        };
      }
    } else if (fallback) {
      odometer = {
        value: fallback.value,
        t: fallback.t,
        method: fallback.method,
        exact: false,
        calibrated: fallback.calibrated,
        source_kind: oc.find((c) => c.sourceId === fallback.sourceId)?.kind ?? null,
        note: 'счётчик трекера/платформы',
      };
    } else {
      const dev = pickBest(oc);
      if (dev)
        odometer = {
          value: dev.value,
          t: dev.t,
          method: dev.method,
          exact: dev.exact,
          calibrated: dev.calibrated,
          source_kind: null,
        };
    }

    const times = [pos?.t, ...mc.map((c) => c.t)].filter((x) => x !== undefined && x !== null).map(Number);
    const lastData = times.length ? Math.max(...times) : null;
    out.push({
      id: m.id,
      org_id: m.org_id,
      org_name: m.org_name,
      name: m.name,
      category: m.category,
      make: m.make,
      model: m.model,
      year: m.year,
      chassis: m.chassis,
      rotating_upper: m.rotating_upper,
      location_enabled: m.location_enabled,
      location_visible: visibleLoc.has(m.id),
      position: pos
        ? { t: Number(pos.t), lat: pos.lat, lon: pos.lon, speed_kmh: pos.speed_kmh, course: pos.course }
        : null,
      engine_hours: hours,
      odometer,
      last_data_t: lastData,
      freshness: freshness(lastData, now),
      sources: sources.rows
        .filter((s) => s.machine_id === m.id)
        .map((s) => ({ id: s.id, kind: s.kind, label: s.label, last_seen_at: ms(s.last_seen_at) })),
    });
  }
  return out;
}

/** Robust GNSS distance from time t (ms) until now, for "reading + distance since" odometers. */
export async function gnssKmSince(db: Db, machineId: string, t: number, profile: MachineProfile): Promise<number> {
  const r = await db.query<any>(
    `select (extract(epoch from t) * 1000)::float8 as t, lat, lon, speed_kmh, hdop, sats, acc_m
       from positions where machine_id = $1 and t >= to_timestamp($2 / 1000.0) order by t limit 200000`,
    [machineId, t],
  );
  const fixes = r.rows.map((p) => ({
    t: Number(p.t),
    lat: p.lat,
    lon: p.lon,
    speedKmh: p.speed_kmh,
    hdop: p.hdop,
    sats: p.sats,
    accM: p.acc_m,
  }));
  return robustDistance(fixes, profile).km;
}
