import { createRoot } from 'react-dom/client';
import '../styles.css';

const DOWNLOADS = [
  { os: 'Android', file: 'https://github.com/isrealellera/ITles/releases/download/v0.2.0-preview/ITles.apk', note: 'Телефон или планшет в кабине и кабинет руководителя. Файл APK (Android 7+): разрешите установку из этого источника.' },
  { os: 'Windows', file: 'https://github.com/isrealellera/ITles/releases/download/v0.2.0-preview/ITles-Windows-x64.zip', note: 'Кабинет для ПК (Windows 10/11, x64): распакуйте архив и запустите ITles.exe.' },
  { os: 'iPhone / iPad', file: './app/', note: 'Откройте в Safari → «Поделиться» → «На экран Домой». Работает как приложение.' },
  { os: 'Веб-кабинет', file: './app/', note: 'Любой браузер на ПК или телефоне, без установки.' },
];

const PATHS = [
  {
    n: '1',
    title: 'Трекер уже стоит',
    text: 'С 01.01.2025 лесозаготовительная техника обязана иметь аппаратуру ГЛОНАСС (ст. 96.3 Лесного кодекса). Подключаем её данные без нового оборудования: платформой Wialon, Traccar или по стандарту ISO 15143‑3 — в два клика, или добавив наш сервер вторым адресом в настройках трекера (EGTS, Wialon IPS, Galileosky).',
    tag: 'Бесплатно',
  },
  {
    n: '2',
    title: 'Ничего не установлено',
    text: 'Телефон или планшет в кабине: приложение ITles, код из 6 цифр со страницы машины — и местоположение, пробег и работа двигателя пишутся даже без связи, отправляются при появлении сети. Моточасы — с приборного счётчика по фото.',
    tag: 'Бесплатно',
  },
  {
    n: '3',
    title: 'Нужна максимальная точность',
    text: 'Трекер с CAN‑шиной (Galileosky, Навтелеком) в режиме FMS/J1939 читает моточасы прямо из блока управления двигателем — ровно то же число, что на приборной панели.',
    tag: 'От ~10 тыс. ₽',
  },
];

const ACCURACY = [
  ['Моточасы из ЭБУ (J1939 SPN 247)', 'совпадают со счётчиком панели, шаг 0,05 ч'],
  ['Потери точек по дороге трекер → сервер', '0 из 5 425 (Galileosky, EGTS, Wialon IPS, архивы после зон без связи)'],
  ['Повторная отправка архива', '0 дублей'],
  ['Пробег грузовика / трактора по ГНСС', '−0,3 … −1,0 %'],
  ['Пробег гусеничного экскаватора с поворотной платформой', '+0,6 … −2,9 % (простое суммирование: +906 %)'],
  ['Ложный пробег на стоянке 72 ч под пологом леса', '0,000 км (простое суммирование: до 59 км)'],
  ['Перевозка на трале', 'не попадает в пробег машины, считается отдельно'],
];

function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-br from-brand-900 via-[#0d2a5c] to-brand-700 text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3 text-lg font-bold">
            <img src="./favicon.svg" alt="" className="h-9 w-9" /> ITles
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href="#download" className="hidden rounded-xl px-3 py-2 hover:bg-white/10 sm:inline">Скачать</a>
            <a href="./app/" className="rounded-xl bg-white px-4 py-2 font-semibold text-brand-900 hover:bg-brand-50">Войти</a>
          </div>
        </nav>
        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-10 md:grid-cols-2 md:pt-16">
          <div>
            <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent-400">
              ДЛЯ ВЛАДЕЛЬЦЕВ ТЕХНИКИ · ДИСТРИБЬЮТОРОВ · FUCHS
            </p>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
              Моточасы, пробег и местоположение любой спецтехники
            </h1>
            <p className="mt-5 text-lg text-blue-100">
              Харвестеры, тракторы, экскаваторы, самосвалы, лесовозы — в поле, в лесу, в карьере и на дороге. Подключение через то, что уже
              есть в машине, без покупки оборудования.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="./app/" className="btn bg-accent-400 px-6 py-3 text-base text-brand-900 hover:bg-emerald-300">Открыть кабинет</a>
              <a href="#download" className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">Скачать приложение</a>
            </div>
          </div>
          <div className="grid gap-3 self-center sm:grid-cols-3 md:grid-cols-1">
            {[
              ['Моточасы', 'из блока двигателя, трекера или по счётчику панели — у каждого значения видно источник и время'],
              ['Пробег', 'CAN‑одометр или устойчивая одометрия ГНСС — корректна и для гусеничной техники'],
              ['Местоположение', 'карта и трек; главный администратор владельца может выключить его для любой машины'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
                <div className="text-lg font-bold text-accent-400">{t}</div>
                <div className="mt-2 text-sm text-blue-100">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold">Как подключить машину</h2>
        <p className="mt-2 max-w-3xl text-slate-600">Система сама выбирает лучший источник для каждой машины. Ничего не нужно знать о протоколах и шинах.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {PATHS.map((p) => (
            <div key={p.n} className="card p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold text-brand-700">{p.n}</span>
                <span className="badge bg-emerald-50 text-emerald-700">{p.tag}</span>
              </div>
              <h3 className="mt-4 text-xl font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
          {[
            ['Владелец техники', '«Главный» администратор видит весь парк, приглашает сотрудников, решает, кому показывать местоположение, и может полностью отключить его для отдельных машин — координаты таких машин даже не принимаются сервером.'],
            ['Дистрибьютор FUCHS', 'Моточасы машин своих клиентов, прогноз замены масел по интервалам в моточасах, список ближайших обслуживаний с объёмами.'],
            ['FUCHS', 'Сводка по всей сети дистрибьюторов: парк, наработка, потребность в смазочных материалах.'],
          ].map(([t, d]) => (
            <div key={t} className="card p-6">
              <h3 className="text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold">Точность — измерена, а не обещана</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Результаты сквозных прогонов: симулированные машины передают данные реальными протоколами трекеров по TCP через наш шлюз в платформу; одометрия
          проверена на всех классах техники. Отчёты — в репозитории проекта (docs/evidence).
        </p>
        <div className="card mt-8 overflow-hidden">
          <table className="w-full text-left text-sm">
            <tbody>
              {ACCURACY.map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium">{k}</td>
                  <td className="px-5 py-3 text-slate-600">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Там, где связи нет (глубина леса, карьер), трекер или телефон хранят данные и досылают их при появлении сети — на экране видно, насколько свежи
          данные каждой машины.
        </p>
      </section>

      <section id="download" className="bg-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold">Скачать</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {DOWNLOADS.map((d) => (
              <a key={d.os} href={d.file} className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:bg-white/10">
                <div className="text-lg font-bold">{d.os}</div>
                <div className="mt-2 text-sm text-blue-100">{d.note}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold">Вопросы</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ['Нужно ли покупать оборудование?', 'Нет, если в машине уже есть трекер (для лесозаготовительной техники он обязателен) или можно оставить в кабине телефон. Трекер с CAN нужен только для максимальной точности моточасов без участия человека.'],
            ['Что если в лесу нет связи?', 'Данные копятся в памяти трекера или телефона и досылаются при выезде в зону сети. Ни одна точка не теряется; у каждой машины видно время последних данных.'],
            ['Собираете ли вы персональные данные?', 'Нет. Вход — по логину, который выдаёт администратор организации; имена, телефоны и почта не нужны.'],
            ['Как считаются моточасы без трекера?', 'Главный источник — показание счётчика на панели (по фото). Между показаниями телефон оценивает работу двигателя по вибрации и сам калибруется по следующему показанию; оценка всегда помечена знаком ≈.'],
          ].map(([q, a]) => (
            <div key={q} className="card p-5">
              <div className="font-semibold">{q}</div>
              <div className="mt-2 text-sm text-slate-600">{a}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} ITles · мониторинг спецтехники</span>
          <a className="hover:text-slate-800" href="./app/">Кабинет</a>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('landing')!).render(<Landing />);
