import { useEffect, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ago } from './api';

export function Fresh({ f, t }: { f: string; t: number | null }) {
  const cls =
    f === 'online' ? 'bg-emerald-50 text-emerald-700' : f === 'recent' ? 'bg-amber-50 text-amber-700' : f === 'stale' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500';
  const dot = f === 'online' ? 'bg-emerald-500' : f === 'recent' ? 'bg-amber-500' : f === 'stale' ? 'bg-rose-500' : 'bg-slate-400';
  return (
    <span className={`badge ${cls}`} title={t ? new Date(t).toLocaleString('ru-RU') : ''}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {ago(t)}
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="text-2xl leading-none text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorLine({ e }: { e: unknown }) {
  if (!e) return null;
  return <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{(e as Error).message ?? String(e)}</div>;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: unknown; loading: boolean; reload: () => void } {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState({ data: null, error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((x) => x + 1) };
}

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  label: string;
  color: string;
}

export function MapView({ markers, track, height = 420, onPick }: { markers?: MapMarker[]; track?: Array<[number, number]>; height?: number; onPick?: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true }).setView([61.8, 34.3], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; участники OpenStreetMap',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    if (track && track.length > 1) {
      L.polyline(track, { color: '#1f6feb', weight: 3, opacity: 0.85 }).addTo(g);
      pts.push(...track);
    }
    for (const mk of markers ?? []) {
      const c = L.circleMarker([mk.lat, mk.lon], { radius: 8, color: '#fff', weight: 2, fillColor: mk.color, fillOpacity: 1 })
        .bindTooltip(mk.label)
        .addTo(g);
      if (onPick) c.on('click', () => onPick(mk.id));
      pts.push([mk.lat, mk.lon]);
    }
    if (pts.length === 1) m.setView(pts[0], 13);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 });
  }, [markers, track, onPick]);
  return <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-2xl border border-slate-200" />;
}

export function Bars({ data, unit, color = '#1f6feb' }: { data: Array<{ label: string; value: number | null }>; unit: string; color?: string }) {
  const max = Math.max(1e-9, ...data.map((d) => d.value ?? 0));
  if (!data.some((d) => d.value)) return <div className="flex h-40 items-center justify-center text-sm text-slate-400">нет данных за период</div>;
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => (
        <div key={d.label} className="group relative flex flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.value === null ? 'нет данных' : d.value.toFixed(1) + ' ' + unit}`}>
          <div className="w-full rounded-t" style={{ height: `${((d.value ?? 0) / max) * 100}%`, minHeight: d.value ? 2 : 0, background: color }} />
          <div className="mt-1 hidden text-[10px] text-slate-400 sm:block">{d.label.slice(8)}</div>
        </div>
      ))}
    </div>
  );
}
