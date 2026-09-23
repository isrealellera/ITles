# ITles × FUCHS — телематика моточасов, пробега и местоположения спецтехники

Технический проект и проверочный стенд системы «устройство на машине → сервер → ПК/телефон»
для FUCHS, дистрибьюторов FUCHS и конечных клиентов (поле, лес, карьер, стройка, дорога).

| Что | Где |
|---|---|
| Диздок (главный документ) | [`docs/design/DESIGN.md`](docs/design/DESIGN.md) |
| Excel: таблицы, расчёты, результаты стенда, риски, вопросы | [`deliverables/ITles_Fuchs_telematics.xlsx`](deliverables/ITles_Fuchs_telematics.xlsx) |
| Результаты моделирования (генерируются) | [`docs/simulation-results.md`](docs/simulation-results.md) |
| Методика и допущения модели | [`docs/simulation-report.md`](docs/simulation-report.md) |
| Сквозной прогон через реальный шлюз | [`docs/evidence/traccar-e2e.json`](docs/evidence/traccar-e2e.json) |
| Аудит прежней ветки `hoplite/thasos-804ac857` | [`docs/audit-previous-branch.md`](docs/audit-previous-branch.md) |
| Источники | [`docs/research/sources.md`](docs/research/sources.md) |
| Конфигурация шлюза устройств | [`infra/traccar/traccar.xml`](infra/traccar/traccar.xml) |

## Что здесь реальное

Протокольный слой не имитируется: пакеты Galileosky, Wialon IPS 2.0 и EGTS собираются по
спецификациям байт в байт и проверяются на пакетах реальных устройств; их принимает настоящий
Traccar 6.15.3. Моделируются только машина (смены, электрика, движение), приёмник GNSS и
покрытие сети — с явными допущениями.

## Воспроизведение

```sh
uv venv .venv --python 3.12 && . .venv/bin/activate
uv pip install -r requirements.txt
python -m pytest -q                      # 24 теста, включая пакеты реальных устройств
python scripts/run_scenarios.py          # сценарии → docs/simulation-results.md, docs/img/
python scripts/build_workbook.py         # Excel → deliverables/
```

Пересчёт формул Excel (чтобы значения были видны без Excel):
`soffice --headless --calc --convert-to xlsx --outdir /tmp/recalc deliverables/ITles_Fuchs_telematics.xlsx`
и копирование результата обратно.

### Сквозной прогон через Traccar

Нужны Java 21 и сборка `traccar-other-6.15.3.zip` с GitHub-релиза Traccar.

```sh
cp infra/traccar/traccar.xml <traccar>/conf/traccar.xml
(cd <traccar> && java -jar tracker-server.jar conf/traccar.xml &)
# первый пользователь Traccar становится администратором:
curl -X POST http://127.0.0.1:8082/api/users -H 'Content-Type: application/json' \
     -d '{"name":"stand-admin","email":"stand-admin@local","password":"<пароль>"}'
TRACCAR_USER=stand-admin@local TRACCAR_PASSWORD='<пароль>' python scripts/traccar_e2e.py --days 2
```

Скрипт поднимает приёмник пересылки на `127.0.0.1:9100`, моделирует 7 классов машин,
отправляет данные по TCP (Galileosky :5034, Wialon IPS :5039, EGTS :5165), ждёт пересылку,
сверяет с базой шлюза и пишет `docs/evidence/traccar-e2e.json`.

### Стенд квалификации трекера (реальное железо)

Эмулятор ЭБУ шлёт кадры J1939 модели машины и отвечает на запросы PGN 59904. С USB-CAN
адаптером, подключённым ко входу CAN трекера:

```sh
python -m sim.canbus --profile harvester --interface socketcan --channel can0 --realtime --log bench.asc
```

В песочнице доступна только `--interface virtual`.

## Ограничения

Работа на конкретной машине (доступ к CAN, программа считывателя, монтаж, покрытие сети) здесь
не проверяется — это стенд квалификации и пилот (диздок, раздел 9). Семантика тегов CAN_B0/CAN_B1
Galileosky — гипотеза H-GS-1, подлежит стендовой проверке.
