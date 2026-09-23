import type { Me } from '../main';
import { go } from '../main';
import { api, fmt } from '../api';
import { ErrorLine, useAsync } from '../ui';

export function Service({ me }: { me: Me }) {
  const res = useAsync(() => api('GET', '/api/service/overview'), []);
  const items: any[] = res.data?.items ?? [];
  const soon = items.filter((i) => i.status === 'overdue' || i.status === 'soon');
  const litres = soon.reduce((s, i) => s + (i.volume_l ?? 0), 0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Обслуживание</h1>
        <p className="text-sm text-slate-500">
          Замены масел и жидкостей по моточасам{me.org_kind !== 'customer' ? ' по всем клиентам' : ''}. Ближайшие и просроченные: {soon.length}
          {litres ? `, объём ≈ ${fmt(litres, 0)} л` : ''}.
        </p>
      </div>
      <ErrorLine e={res.error} />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Машина</th>
              <th className="px-4 py-3">Узел / продукт</th>
              <th className="px-4 py-3">Моточасы</th>
              <th className="px-4 py-3">Следующая</th>
              <th className="px-4 py-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => go('#/machine/' + i.machine_id)}>
                <td className="px-4 py-3">
                  <b>{i.machine}</b>
                  <div className="text-xs text-slate-500">{i.org}</div>
                </td>
                <td className="px-4 py-3">
                  {i.item}
                  <div className="text-xs text-slate-500">
                    {i.product ?? ''} {i.volume_l ? `· ${fmt(i.volume_l, 0)} л` : ''}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{fmt(i.hours, 0)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {fmt(i.due_at_h, 0)} ч{i.due_date ? <div className="text-xs text-slate-500">≈ {new Date(i.due_date).toLocaleDateString('ru-RU')}</div> : null}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${i.status === 'overdue' ? 'bg-rose-50 text-rose-700' : i.status === 'soon' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {i.status === 'overdue' ? 'просрочено' : i.status === 'soon' ? 'скоро' : i.status === 'ok' ? 'в норме' : 'нет данных'}
                  </span>
                </td>
              </tr>
            ))}
            {!res.loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Интервалы обслуживания задаются на странице машины.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
