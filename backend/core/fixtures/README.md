# Данные перенесённых турниров

`imported_tournaments.json` — снимок турнирных данных из рабочей БД:

- 20 турниров (12 перенесённых + 6 карточек чемпионата области 2026 + «Матч городов 2026»);
- 218 игроков;
- 411 заявок, 499 матчей, 54 результата, 244 начисления очков;
- 144 фотографии, 18 видео.

Пользователи (`core.User`) в фикстуру **не входят** — пароли и служебные аккаунты
не переносятся. Администратор создаётся миграцией `0007_create_default_admin`
(`admin` / `!Ad123min4`) либо через `createsuperuser`.

## Загрузка

На чистой БД:

```bash
python manage.py migrate
python manage.py loaddata core/fixtures/imported_tournaments.json
```

Фотографии лежат в `backend/media/tournaments/photos/` и хранятся в Git LFS.
После клонирования:

```bash
git lfs install
git lfs pull
```

Если БД уже содержит турниры с такими же `pk`, `loaddata` перезапишет их.
Перед загрузкой в существующую БД сделайте дамп.

## Альтернатива

Все исходные данные также зашиты в management-команды:

```bash
python manage.py import_vk_results --apply
python manage.py create_champ_2026 --apply
python manage.py import_champ_2026_full --apply
python manage.py import_champ_singles_2026 --apply
python manage.py import_champ_doubles_2026 --apply
python manage.py create_match_cities_2026 --apply
```

Команды идемпотентны, но фикстура быстрее и не требует сети.
