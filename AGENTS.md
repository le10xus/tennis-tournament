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
