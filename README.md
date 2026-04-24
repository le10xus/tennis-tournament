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

## Следующие шаги

- Доменные модели: `Tournament`, `Player`, `Match`, `Bracket`, `Rating`.
- Авторизация (Django auth / JWT).
- UI-фреймворк на фронте (Tailwind / MUI).
