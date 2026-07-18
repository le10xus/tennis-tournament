# tennis-tournament

Скаффолд web-приложения для организации теннисных турниров.

**Стек:** Django 5 + DRF · React 19 + Vite (TypeScript) · PostgreSQL 16 (Docker).

## Структура

```
tennis-tournament/
├── docker-compose.yml     # postgres 16
├── .env.example
├── backend/               # Django + DRF
└── frontend/              # Vite + React + TS
```

## Порты

| Сервис         | Порт |
|----------------|------|
| PostgreSQL     | 5432 |
| Django         | 8000 |
| Vite dev server| 5174 |

## Первый запуск

```bash
cp .env.example .env
docker compose up -d db

# backend
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000

# frontend (в другом терминале)
cd frontend
npm install
npm run dev
```

Открыть http://localhost:5174/ — на странице должен появиться ответ `/api/ping/` вида `{"status":"ok","db":1}`.

## Ежедневный запуск

```bash
docker compose up -d db
(cd backend && source .venv/bin/activate && python manage.py runserver 8000) &
(cd frontend && npm run dev)
```

## Остановка

```bash
# Ctrl+C в терминалах с runserver и vite
docker compose down       # данные БД сохраняются в volume postgres_data
docker compose down -v    # полный сброс БД
```

## Production в Amvera

Проект собирается одним Docker-образом: Vite формирует React-статику, а
Django обслуживает SPA и API через Gunicorn. PostgreSQL создается в Amvera
как отдельный управляемый сервис.

В настройках приложения задайте переменные:

```text
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<случайная строка длиной не менее 50 символов>
DJANGO_ALLOWED_HOSTS=<домен приложения без https://>
POSTGRES_DB=<имя базы>
POSTGRES_USER=<пользователь>
POSTGRES_PASSWORD=<пароль>
POSTGRES_HOST=<внутренний rw-домен PostgreSQL>
POSTGRES_PORT=5432
```

`DJANGO_SECRET_KEY` и `POSTGRES_PASSWORD` следует хранить в секретах Amvera.
Для принудительного HTTPS можно дополнительно задать:

```text
DJANGO_SECURE_SSL_REDIRECT=1
DJANGO_SECURE_HSTS_SECONDS=31536000
```

HSTS включайте только после проверки HTTPS и домена. При каждом старте
контейнер выполняет миграции и `collectstatic`, затем запускает Gunicorn на
порту 8000. После первого деплоя создайте администратора через консоль:

```bash
python manage.py createsuperuser
```

## Следующие шаги

- Доменные модели: `Tournament`, `Player`, `Match`, `Bracket`, `Rating`.
- Авторизация (Django auth / JWT).
- UI-фреймворк на фронте (Tailwind / MUI).
