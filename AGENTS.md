# AGENTS.md

Инструкции для AI-агентов, работающих с репозиторием **tennis-tournament**.

## Overview

Web-приложение для организации теннисных турниров: игроки, регистрации, матчи, сетка (bracket).

**Стек:** Django 5 + DRF · React 19 + Vite (TypeScript) · PostgreSQL 16 · JWT (`simplejwt`).

| Сервис          | Порт |
|-----------------|------|
| PostgreSQL      | 5432 |
| Django          | 8000 |
| Vite dev server | 5174 |

## Layout

```
tennis-tournament/
├── docker-compose.yml   # только Postgres
├── Dockerfile           # production: Vite build + Django/Gunicorn
├── .env.example
├── backend/             # Django project `config`, app `core`
└── frontend/            # Vite + React + TS
```

### Backend (`backend/`)

- `config/` — settings, root URLs, ASGI/WSGI
- `core/models/` — `User`, `Player`, `Tournament`, `TournamentRegistration`, `Match`
- `core/serializers/`, `core/views/` — DRF по доменам
- `core/urls.py` — router: `players`, `tournaments`, `registrations`, `matches`, `users`
- `core/auth_urls.py` — `/api/auth/token/`, `refresh`, `verify`, `register`
- `core/permissions.py` — `RolePermission`, `IsAdminUser`
- `core/tests/` — pytest + pytest-django

### Frontend (`frontend/src/`)

- `api/` — HTTP-клиент и API-модули (`http.ts`, `players.ts`, …)
- `auth/` — `AuthContext`, `RequireAuth` / `RequireEdit` / `RequireAdmin`
- `pages/` — страницы по доменам (players, tournaments, matches, users)
- `components/` — shell, формы, модалки
- `types/` — TypeScript-типы, зеркалящие API

## Commands

```bash
# env + DB
cp .env.example .env
docker compose up -d db

# backend
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python manage.py migrate
python manage.py runserver 8000

# frontend (другой терминал)
cd frontend
npm install
npm run dev
```

Проверка связности: http://localhost:5174/ — ответ `/api/ping/` вида `{"status":"ok","db":1}`.

```bash
# tests / lint
cd backend && source .venv/bin/activate && pytest
cd frontend && npm run lint
cd frontend && npm run build
```

Миграции:

```bash
cd backend && source .venv/bin/activate
python manage.py makemigrations
python manage.py migrate
```

## Architecture & domain

### API

- Префикс: `/api/`
- Auth: JWT Bearer; refresh через `/api/auth/token/refresh/`
- Vite proxy: `/api` → `http://localhost:8000`
- Production: Django отдаёт SPA (`index.html`) и статику; API тот же `/api/`

### Roles & permissions

| Кто            | Права                                      |
|----------------|--------------------------------------------|
| аноним         | только чтение (GET/HEAD/OPTIONS)           |
| `player`       | только чтение                              |
| `organizer`    | create/update, без DELETE                  |
| `is_staff`     | полный CRUD; раздел users — только staff   |

На фронте: `RequireEdit` (organizer/staff), `RequireAdmin` (staff).

### Conventions

**Backend**

- Новые сущности — в `core/models/`, затем serializer + ViewSet, регистрация в `core/urls.py`
- Права по умолчанию — через `RolePermission`; admin-only — `IsAdminUser`
- Не класть бизнес-логику в `admin.py`; сложные действия — во views/services рядом с доменом
- Миграции создавать через `makemigrations`, не править применённые руками без необходимости

**Frontend**

- Вызовы API только через `frontend/src/api/` (`http` + модули), не через сырой `fetch` в страницах
- Типы домена — в `frontend/src/types/`; держать согласованными с serializers
- Страницы — в `pages/<domain>/`; guard'ы маршрутов — в `auth/`
- Стили — CSS рядом с компонентом/страницей (как сейчас), без нового UI-фреймворка без явного запроса

## Boundaries

**Запрещено (даже «для проверки» / «временно»)**

- Удалять, сбрасывать или чистить БД и её данные
- Команды и флаги вроде: `docker compose down -v`, `dropdb`, `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` без фильтра задачи, `flush`, `reset_db`, пересоздание volume `postgres_data`
- Запускать destructive migrate (`migrate zero` и аналоги) без явной просьбы пользователя
- Предлагать «чистый старт с пустой БД» как решение проблемы

Если для отладки кажется нужен сброс БД — **остановитьcя и спросить**. Исключение только при прямой команде пользователя сделать это.

**Не трогать без явной просьбы**

- `.env`, секреты, credentials
- `frontend/dist/`, `backend/staticfiles/`, `node_modules/`, `.venv/`
- Production-секреты Amvera / CI

**Спросить перед изменением**

- Схема БД / миграции с потерей данных
- Модель ролей и `RolePermission`
- Dockerfile / `entrypoint.sh` / Amvera-конфиг, если задача не про деплой

**Можно менять свободно**

- `backend/core/` (models, views, serializers, tests) в рамках задачи
- `frontend/src/` в рамках задачи
- README при изменении команд запуска или портов

## Testing

- Backend: `pytest` из `backend/` с активированным `.venv`; `DJANGO_SETTINGS_MODULE=config.settings`, `--reuse-db`
- Один файл: `pytest core/tests/test_tournaments_api.py`
- Frontend: `npm run lint`; при изменениях типов/сборки — `npm run build`
- Для API-изменений добавляй/обновляй тесты в `backend/core/tests/`

## Git

- Коммиты — только по явной просьбе пользователя
- Не коммитить `.env`, `.venv`, `node_modules`, секреты
- Сообщения — коротко, по смыслу изменения (fix/add/update), на языке репозитория (RU/EN — как в истории)

## Production notes

- Один Docker-образ: Vite → `frontend/dist`, Django + Gunicorn на 8000
- Postgres — отдельный сервис (локально compose, в Amvera — managed)
- Env — по `.env.example`; `DJANGO_SECRET_KEY` и `POSTGRES_PASSWORD` — только в секретах

## Данные игроков (NTRP, очки, город)

Источник — Google Sheets лиги, 4 таблицы: М/Ж × одиночный/парный. Выжимка лежит в
`backend/core/data/ntrp_players.json`: 203 человека, у каждого очки и NTRP **отдельно**
для одиночного и парного разряда, город, год рождения и логин.

- Схема: `Player.city`, `birth_year`, `ntrp_singles`, `ntrp_doubles`,
  `points_singles`, `points_doubles` (миграция `0010_player_ntrp_city_points`).
- Сид: `python manage.py seed_players [--dry-run] [--password ...]`. Идемпотентен:
  ищет `Player` по email `{login}@tennis.local`, повторный запуск обновляет записи.
- Аккаунты: роль `player`, пароль по умолчанию `Tennis2026!`, логин — транслит
  `фамилия_имя` (`lashkov_vladislav`, `khrulev_anton`).
- `Player.rating` заполняется очками одиночного разряда (у парников — парного):
  именно на нём работают сортировка списка игроков и лимиты `min_rating`/`max_rating`.
- Коды регионов из исходника: ВОЛ→Вологда, ЧРП→Череповец, ВЛГ→Вологодская область,
  АРХ→Архангельск, РЫБ→Рыбинск, СПБ→Санкт-Петербург, САР→Саратов, СМР→Самара.
  САР/СМР/ВЛГ — предположение, расшифровки в таблице нет.
- Пагинация: `core.pagination.StandardPagination` — поддерживает `?page_size=`
  (максимум 500). Без него рейтинг обрезался на 50 записях, т.к. `PageNumberPagination`
  игнорирует `page_size` по умолчанию.
- Фронт: на «Рейтинге» и в топ-10 на главной есть переключатель разряда
  (одиночный/парный); в рейтинг попадают только те, у кого есть очки в этом разряде.

## Заявки и пары (2026-11-03)

- `TournamentRegistration.invited_by` — кто пригласил игрока в пару.
- `POST /api/registrations/` принимает `partner` (только парный турнир): создаются
  две заявки с общим `pair_id` (следующий свободный номер). Актор-игрок → обе
  `pending`, у партнёрской заполнен `invited_by`; staff/organizer → обе сразу `approved`.
- `POST /api/registrations/{id}/approve/` — для парного турнира подтверждает всю пару.
- `POST /api/registrations/{id}/confirm/` — партнёр подтверждает приглашение, пара
  становится `approved`. Разрешено самому игроку (и админу/организатору).
- `DELETE /api/registrations/{id}/` — удаляет заявку; если у неё есть `pair_id`,
  удаляется вся пара. Доступно organizer и staff (обычный игрок — нет).
- `frontend/src/components/PlayerPicker.tsx` — селект с поиском (фамилия/имя/город) и
  инлайн-созданием игрока (`allowCreate`). Используется в блоке «Заявить участников»
  и в выборе партнёра. Новый игрок создаётся через `POST /api/players/`, email
  генерируется как `player_<timestamp>@tennis.local`, если поле пустое.
- Посев: `recalculate_seeds()` ставит `seed` 1–4 первым четырём участникам по
  рейтингу (пересчитывается при создании/подтверждении/удалении заявки и при
  генерации сетки, но **не** на GET-списке — иначе ручной посев не сохранить),
  остальным — `null`.
  **Рейтинг зависит от разряда:** одиночный турнир — `Player.points_singles`,
  парный — сумма `Player.points_doubles` обоих партнёров. Обе записи пары получают
  один номер посева. Список заявок: парный турнир — по `pair_rating` (Subquery по
  `pair_id` и `points_doubles`), одиночный — по `-player__points_singles`.
  Лимиты `min_rating`/`max_rating` тоже сравниваются с очками нужного разряда.
- `Player.rating` — устаревшее поле: сидер пишет туда `points_singles`, в расчётах
  посева и лимитов оно больше не участвует.
- Статусы турнира: `draft` Черновик → `registration` Регистрация открыта →
  `registration_closed` Регистрация закрыта → `in_progress` Турнир начался →
  `summing_up` Подводим итоги → `finished` Завершён (миграция `0012_tournament_statuses`).
  Заявки игроков принимаются только при статусе `registration`.
- Таблица участников на странице турнира: одна строка = один игрок. Колонки: Посев,
  Игрок, Город, Год рождения, Пол, Очки, Очки пары, NTRP. В «Посеве» — порядковый
  номер по рейтингу (у пары одинаковый для обоих), первые 4 выделены ★ и акцентным
  фоном, остальные — обычным серым номером. Очки/NTRP — по разряду турнира;
  «Очки пары» — сумма парных очков пары (в одиночном — «—»). Партнёры идут
  отдельными строками, каждая пара — отдельный `<tbody>`, пары выделены
  чередующимся фоном, жирной линией сверху и пунктиром между партнёрами.
- `Player.is_ftvo` (boolean, миграция `0013_player_is_ftvo`) — отдельный критерий
  игрока, отдаётся в API (`/api/players/`), в таблицу турнира не выводится.
- Игрок обязан указать партнёра в парном турнире (иначе 400). Админ может заявить
  одиночную заявку без пары — на этом построено старое добавление из формы турнира.
- Проверка `tournament.status == registration` действует только для заявок игроков:
  staff/organizer может заявлять игроков в турнир любого статуса.
- `Tournament.players` — `through_fields=("tournament", "player")`, иначе Django
  падает с fields.E335: у `TournamentRegistration` два FK на `Player`.

## Двойное выбывание / сетка с подвалом (`double_elim`)

Схема как в Excel «сетка 16 (с подвалом)» — **28 матчей** на 16 участников:

| Блок | Матчей | Что это |
|---|---|---|
| Основная 1/8 | 8 | первые пары |
| Основная 1/4 | 4 | победители 1/8 |
| Подвал 1/4 (9–16) | 4 | проигравшие 1/8 |
| Подвал 1/4 (5–8) | 4 | победители подвала + проигравшие 1/4 основной |
| Основная 1/4-2 | 4 | победители 1/4 основной + победители подвала 5–8 |
| 1/2 | 2 | |
| Финал + 3-е место | 2 | проигравшие 1/2 играют за 3-е место |

- Поля `Match`: `bracket` (`winners`/`consolation`/`third_place`), `group` (`5-8`, `9-16`),
  `next_match` + `next_slot`, `loser_next_match` + `loser_next_slot`
  (миграции `0014_match_bracket_links`, `0015_match_group`).
- Посев: 1 — верхний слот, 2 — нижний, 3 — низ первой половины, 4 — верх второй
  половины (`_seed_slots`); остальные участники распределяются по свободным слотам
  случайно.
- `MatchViewSet._advance`: победитель идёт в `next_match`, проигравший — в
  `loser_next_match`. Цепочки проверены: 1/8 → 1/4 основной и подвал;
  1/4 основной → 1/4-2 основной (слот 1) и подвал 5–8 (слот 2); подвал 9–16 →
  подвал 5–8 (слот 1); подвал 5–8 → 1/4-2 основной (слот 2); 1/2 → финал и 3-е место.
- Для числа участников, отличного от 16, работает запасная схема
  `_generate_main_with_third`: олимпийка + матч за 3-е место.
- UI: `DoubleElimBracket.tsx` — одна горизонтальная «доска»: слева подвал
  (1/4 5–8, затем 1/4 9–16), справа основная сетка (1/8, 1/4, 1/4, 1/2, финал),
  матч за 3-е место — под финалом. Нумерация как в Excel-образце: в подвале 5–8
  у второго игрока номера 1–4, под блоками — «Победитель на 8/7/6/5» (синим); во
  втором круге основной сетки под блоками — «Проигравший на 2/1/4/3» (красным);
  в третьем круге (1/4-2) у второго игрока номера 5–8. Больше нигде номеров нет.
  У сеяных — бейдж «№1–4». На карточке: дата/время, корт и счёт; статус виден
  только для не-запланированных матчей.
- Расписание: `Tournament.courts` (по умолчанию 4), `match_duration_minutes` (60),
  `saturday_start_time` и `sunday_start_time` (09:00). `Match.court`.
  `POST /api/tournaments/{id}/generate_schedule/` раскладывает незавершённые матчи
  в порядке проведения (1/8 → подвал 9–16 → 1/4 → подвал 5–8 → 1/4-2 → 1/2 → финал →
  3-е место) по кортам. День начинается в субботу/воскресенье со своего времени,
  в остальные дни — с 09:00; окно до 21:00, слоты по `match_duration_minutes`.
  Время хранится в `TIME_ZONE = "Europe/Moscow"`. Дату/время и корт можно править
  вручную в форме матча.
- Таблицы очков за места в приложении нет (по просьбе заказчика).

## Локальный запуск на Windows (эта машина)
- `\` в PowerShell не является переносом строки — использовать обратный апостроф.
- `backend/entrypoint.sh` в Windows-чекауте получает CRLF, из-за чего контейнер падает
  с `exec ./entrypoint.sh: no such file or directory`. Обход:
  `--entrypoint sh ... -c "python manage.py migrate --noinput && exec gunicorn config.wsgi:application ..."`.
  Нормальное лечение — `.gitattributes` с `*.sh text eol=lf` и пересборка образа.
- Порт 5432 занят другим проектом → в `.env` ставим `POSTGRES_PORT=5433`.
- Изнутри контейнера `POSTGRES_HOST=localhost` не работает, нужен `host.docker.internal`.
