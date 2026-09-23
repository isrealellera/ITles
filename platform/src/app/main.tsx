import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import '../styles.css';
import { api, ApiError, apiBase, TOKEN_KEY } from './api';
import { Fleet } from './pages/Fleet';
import { MachinePage } from './pages/Machine';
import { Orgs } from './pages/Orgs';
import { Connect } from './pages/Connect';
import { Service } from './pages/Service';
import { Login } from './pages/Login';
import { Cab } from './cab/Cab';

export interface Me {
  id: string;
  login: string;
  role: 'admin' | 'member';
  org_id: string;
  org_kind: 'fuchs' | 'distributor' | 'customer';
  org_name: string;
  share_location_up: boolean;
}

function useHash(): string {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => {
    const f = () => setH(location.hash || '#/');
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

export const go = (h: string) => (location.hash = h);

function App() {
  const hash = useHash();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const load = useCallback(() => {
    api<{ user: Me }>('GET', '/api/me')
      .then((r) => setMe(r.user))
      .catch((e) => setMe(e instanceof ApiError && e.status === 0 ? (me ?? null) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);

  // the cab screen works with a device token and without a user session
  if (hash.startsWith('#/cab')) return <Cab />;
  if (me === undefined) return <div className="p-10 text-slate-500">Загрузка…</div>;
  if (me === null) return <Login onDone={load} />;

  const logout = async () => {
    await api('POST', '/api/auth/logout').catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setMe(null);
  };
  const parts = hash.slice(2).split('/');
  const nav: Array<[string, string]> = [
    ['#/', 'Парк'],
    ['#/service', 'Обслуживание'],
    ['#/orgs', me.org_kind === 'customer' ? 'Организация' : 'Организации'],
    ['#/connect', 'Подключения'],
  ];
  let page;
  if (parts[0] === 'machine' && parts[1]) page = <MachinePage id={parts[1]} me={me} />;
  else if (parts[0] === 'orgs') page = <Orgs me={me} />;
  else if (parts[0] === 'connect') page = <Connect me={me} />;
  else if (parts[0] === 'service') page = <Service me={me} />;
  else page = <Fleet me={me} />;
  const active = (h: string) => (h === '#/' ? parts[0] === '' || parts[0] === 'machine' : hash.startsWith(h));
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <a href="#/" className="flex items-center gap-2 font-bold">
            <img src="../favicon.svg" className="h-8 w-8" alt="" /> <span className="hidden sm:inline">ITles</span>
          </a>
          <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
            {nav.map(([h, t]) => (
              <a key={h} href={h} className={`whitespace-nowrap rounded-lg px-3 py-2 font-medium ${active(h) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                {t}
              </a>
            ))}
          </nav>
          <div className="hidden text-right text-xs leading-tight text-slate-500 md:block">
            <div className="font-semibold text-slate-800">{me.login}</div>
            <div>
              {me.org_name} · {me.role === 'admin' ? (me.org_kind === 'customer' ? 'главный администратор' : 'администратор') : 'сотрудник'}
            </div>
          </div>
          <button onClick={logout} className="btn-ghost px-3 py-1.5 text-xs">
            Выйти
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{page}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-400">Сервер: {apiBase() || location.origin}</footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('../sw.js').catch(() => {});
}
