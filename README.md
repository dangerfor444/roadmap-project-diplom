# Публичная платформа Roadmap + Feedback

Документ обновлен под новую продуктовую модель на 9 марта 2026.
Текущая реализация остается MVP/демо, но roadmap развития теперь ориентирован на:
- интерактивный `RoadmapItem` (голоса + комментарии),
- отдельную `Product Manager Panel` внутри приложения,
- auth-based запись (fingerprint только как временный demo-mode).

## Стек
- Backend: Strapi v5 + PostgreSQL
- Frontend: Vite + React + TypeScript
- Встраивание: `backend/public/embed.js` -> вставляет `iframe`

## Gap-list (обновленный)
Легенда:
- `[x]` сделано
- `[~]` частично / временно
- `[ ]` не сделано

### A) Модель данных
- `[x]` `RoadmapItem` базовая модель: `title`, `description`, `status`, `category`.
- `[x]` `RoadmapItem` интерактивность на уровне data + public API: `votesCount`, `commentsCount`, `RoadmapVote`/`RoadmapComment`, public endpoints vote/comment/details, поддержка модерации в manager API.
- `[x]` `Idea` базовая интерактивность: создание, голосование, комментарии.
- `[~]` Модель автора действий: сейчас `userFingerprint` (demo-only), нет обязательной user identity.
- `[~]` Введен единый actor-context слой для public write (режимы `demo/hybrid/auth`), включая базовую валидацию signed token (`x-actor-token`) по HMAC-секрету.

### B) Роли и доступ
- `[x]` Public read для roadmap/ideas.
- `[~]` Public write работает через `userFingerprint` (временно, для демо).
- `[~]` Product-режим частично: backend поддерживает `PUBLIC_WRITE_AUTH_MODE=auth` и signed token, но полноценная JWT-интеграция (issuer/audience/claims) пока не завершена.
- `[x]` Отдельный контур `Product Manager` реализован через `/manager` + JWT авторизацию + allowlist админ-почт.
- `[~]` Strapi Admin сейчас используется для контента; целевое состояние: только технический/superadmin контур.

### C) Публичный UI
- `[x]` Roadmap tab (read-only), Ideas tab, Idea details.
- `[x]` Роутинг через `BrowserRouter` (`/app/roadmap`, `/app/ideas`, `/app/ideas/:id`) + backend fallback.
- `[~]` Интерактивный roadmap UI: добавлены детали roadmap-элемента, голосование и комментарии в public UI (режим demo через fingerprint).
- `[~]` Финальная полировка русских текстов и empty/error states.

### D) Панель управления продуктом
- `[x]` Внутренняя manager panel (`/manager`) реализована: разделы `Roadmap` / `Ideas` / `Moderation`, полностью на русском, без ручного ввода ключей.
- `[x]` Manager API реализован: CRUD roadmap, смена статуса идеи, список и hide/unhide комментариев (`idea` и `roadmap`) с авторизацией по Bearer JWT и проверкой allowlist админ-почт.
- `[~]` UX-поток модерации реализован базово; нужна дальнейшая полировка прав/guard и сценариев.

### E) Встраивание и auth-интеграция
- `[x]` `embed.js` и `embed-demo.html` работают.
- `[ ]` Передача identity от основного сайта (JWT/signed token) не реализована.
- `[ ]` Валидация токена и привязка write-операций к userId не реализована.
- `[ ]` Режим `auth-required` + fallback `demo-mode` (конфигурируемо) не реализован.

### F) Нефункциональные
- `[x]` `npm run demo:build` (prod-like сборка в `backend/public/app`).
- `[x]` `npm run smoke:check` покрывает public API, manager API, embed и SPA fallback.
- `[x]` `npm run smoke:check` дополнительно проверяет actor-based public write (`x-actor-id`) без fingerprint и signed token (`x-actor-token`) при заданном `PUBLIC_ACTOR_TOKEN_SECRET`.
- `[~]` Smoke-сценарии для auth/hybrid частично покрыты (token write-checks), но нет полного режимного e2e-набора.

## Новая продуктовая модель (зафиксировано)
1. `RoadmapItem` становится интерактивным наравне с `Idea`.
2. `Strapi Admin` остается технической админкой; для продуктовых задач нужен отдельный интерфейс `Product Manager Panel`.
3. Fingerprint-схема остается только для демо. Целевая запись в продукте привязана к идентифицированному пользователю, полученному от основного сайта.

## Целевая модель сущностей и ролей (Шаг 2)

### Варианты модели взаимодействий
1. Вариант A (рекомендуемый): отдельные сущности для `Idea` и `RoadmapItem`.
   - `IdeaVote`, `IdeaComment`
   - `RoadmapVote`, `RoadmapComment`
   - плюс счетчики в родительских сущностях (`votesCount`, `commentsCount`)
   - плюсы: проще RBAC, проще индексы и уникальные ограничения, прозрачная модерация
2. Вариант B: единая полиморфная сущность `Interaction` с `targetType/targetId`.
   - плюсы: меньше таблиц
   - минусы: сложнее валидировать и модерировать, выше риск ошибок на раннем этапе

Выбор по умолчанию: **Вариант A**.

### Целевые сущности
- `RoadmapItem`
  - `title`, `description`, `status`, `category`
  - `votesCount` (int, default 0)
  - `commentsCount` (int, default 0)
- `RoadmapVote`
  - `roadmapItem` (relation)
  - `actorId` (string, nullable только в demo-mode)
  - `userFingerprint` (string, только demo-mode)
  - уникальность: `(roadmapItem, actorKey)` где `actorKey = actorId || userFingerprint`
- `RoadmapComment`
  - `roadmapItem` (relation)
  - `text` (plain text)
  - `actorId` / `userFingerprint` по режиму
  - `isHidden` (bool)
- `Idea`
  - текущие поля + переход на actor-based write
- `IdeaVote` / `IdeaComment`
  - аналогично roadmap-вариантам, с уникальностью 1 голос на actor
- `ActorContext` (логический слой, не обязательно отдельная таблица на первом этапе)
  - `mode`: `auth` | `demo`
  - `actorId` (из токена)
  - `fingerprint` (fallback для demo)

### Роли и доступ (целевая модель)
- `PublicRead`
  - только чтение roadmap/ideas/comments
- `AuthenticatedUser`
  - создание идей
  - голосование и комментарии для `Idea` и `RoadmapItem`
- `ProductManager`
  - работа в `Product Manager Panel` (`/manager`)
  - управление roadmap, статусами идей, модерация комментариев
- `StrapiSuperAdmin`
  - технический контур (структура данных, системные настройки, отладка)
  - не основной продуктовый интерфейс

### Режимы идентификации
- `demo-mode` (временный): разрешает write через `userFingerprint`.
- `auth-mode` (целевой): write только при валидном `actorId` из JWT/signed token.
- `hybrid` (переходный): по конфигу допускает demo fallback для стендов, но не для production.

## Поэтапный план внедрения (Шаг 3)

### Этап 1. Интерактивный roadmap (data + API + public UI)
1. Data layer:
   - добавить `RoadmapVote`, `RoadmapComment`
   - расширить `RoadmapItem` полями `votesCount`, `commentsCount`
   - завести индексы и уникальность 1 голос на actor
2. Public API:
   - `GET /api/public/roadmap/:id` с комментариями (без `isHidden=true`)
   - `POST /api/public/roadmap/:id/vote`
   - `POST /api/public/roadmap/:id/comments`
3. Public UI:
   - в roadmap-card: счетчики и кнопки «голос/комментарии»
   - страница/панель деталей roadmap-элемента с обсуждением
4. Smoke:
   - добавить проверки roadmap vote/comment в `smoke:check`

### Этап 2. Product Manager Panel (внутри приложения)
1. Frontend scaffold:
   - маршрут `/manager` (отдельный layout и навигация)
   - разделы: Roadmap, Ideas, Moderation
2. Manager API:
   - CRUD roadmap-элементов и смена статусов
   - обработка идей (status workflow)
   - модерация комментариев idea/roadmap (`hide/unhide`)
3. Access control:
   - guard для manager routes
   - backend-проверка manager role/claims
4. Переход роли Strapi:
   - Strapi Admin остается для superadmin/техконтуров
   - продуктовые операции выполняются через `/manager`

### Этап 3. Auth-ready архитектура
1. Actor abstraction:
   - общий `ActorContext` для всех write-endpoints
   - единый контракт: `actorId`, `mode`, `claims`
2. Token integration:
   - прием JWT/signed token от основного сайта
   - валидация подписи/срока действия/issuer/audience
3. Режимы:
   - `demo-mode`: разрешен fingerprint
   - `auth-mode`: fingerprint запрещен, только actorId
   - `hybrid`: конфигурируемый fallback для стендов
4. Миграция API:
   - перевести idea write-операции с fingerprint на actor-context
   - внедрить те же правила для roadmap interactions

### Этап 4. Стабилизация и rollout
1. Расширить smoke/e2e:
   - сценарии для manager-flow
   - сценарии для auth-mode/hybrid
2. Наблюдаемость:
   - логирование actor-based действий
   - аудит модерации
3. Выпуск:
   - staging в `hybrid`
   - production в `auth-mode`

## Что сейчас считается demo-mode
- Создание идеи, голосование и комментарии через `userFingerprint`.
- Product-операции в manager panel защищены JWT + allowlist админ-почт (без полноценного RBAC/claims).
- Отсутствие обязательной user identity для write-действий.

## Структура проекта
```txt
diplom_project/
  backend/                 # Strapi API + admin + статика (/public)
  frontend/                # Vite React UI
  docker-compose.yml       # PostgreSQL
  README.md
  .env.example
```

Ключевая внутренняя структура (после декомпозиции):
```txt
backend/src/api/public/controllers/
  public.ts                # только композиция handlers
  handlers/
    auth.ts                # issueActorToken
    read.ts                # roadmap/idea read endpoints
    ideas.ts               # create idea, vote, comment
    roadmap.ts             # roadmap vote/comment
  lib/
    auth.ts                # actor-token + actor-context
    errors.ts              # sendError + pg error code
    sanitize.ts            # API DTO serializers
    text.ts                # plain-text sanitization
    utils.ts               # parsing helpers
    constants.ts
    types.ts

frontend/src/
  App.tsx                  # тонкий контейнер страницы
  app/
    AppRoutes.tsx          # все route-конфигурации
  features/auth/
    WidgetInternalAuthPanel.tsx
    ExternalAuthPanel.tsx
    useActorIdentity.ts
```

## Быстрый запуск
1. Подготовка env:
```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

2. PostgreSQL:
```powershell
docker compose up -d postgres
```

3. Установка зависимостей:
```powershell
cd backend; npm install
cd ..\frontend; npm install
```

## Запуск в Dev
Терминал 1:
```powershell
cd backend
npm run develop
```

Терминал 2:
```powershell
cd frontend
npm run dev
```

URL:
- Strapi Admin: `http://localhost:1337/admin`
- Public UI (dev): `http://localhost:5173`
- Public API: `http://localhost:1337/api/public/*`
- Embed script: `http://localhost:1337/embed.js`

## Manager API
Manager-endpoints защищены авторизацией пользователя и allowlist админ-почт.

Требования:
- заголовок `Authorization: Bearer <user-jwt>` (JWT из `POST /api/auth/local` / `register`)
- email пользователя должен входить в `MANAGER_ALLOWED_EMAILS` (backend)

Для текущего демо:
- `MANAGER_ALLOWED_EMAILS=2102maksim2004@gmail.com`
- `VITE_MANAGER_ALLOWED_EMAILS=2102maksim2004@gmail.com` (frontend guard вкладки/роутов)

Базовый префикс:
- `http://localhost:1337/api/manager/*`

Доступные маршруты:
- `GET /manager/roadmap`
- `POST /manager/roadmap`
- `GET /manager/roadmap/:id`
- `PUT /manager/roadmap/:id`
- `DELETE /manager/roadmap/:id`
- `PATCH /manager/roadmap/:id/visibility`
- `GET /manager/ideas`
- `GET /manager/ideas/:id`
- `PATCH /manager/ideas/:id/status`
- `PATCH /manager/ideas/:id/visibility`
- `PATCH /manager/comments/:target/:id/moderate`
- `DELETE /manager/comments/:target/:id`

PowerShell пример:
```powershell
$h = @{ 'Authorization' = 'Bearer <your-user-jwt>' }
Invoke-RestMethod -Method Get -Uri 'http://localhost:1337/api/manager/roadmap' -Headers $h
```

## Auth-ready write modes (foundation)
Public write-endpoints (`/api/public/ideas`, `/vote`, `/comments`, roadmap vote/comments) поддерживают режимы:
- `PUBLIC_WRITE_AUTH_MODE=demo`: запись через `userFingerprint`.
- `PUBLIC_WRITE_AUTH_MODE=hybrid`: принимает `x-actor-id` (или `x-user-id`), fallback на `userFingerprint`.
- `PUBLIC_WRITE_AUTH_MODE=auth` (по умолчанию в текущем демо): требует `x-actor-id` (или `x-user-id`), `userFingerprint` не обязателен.
- `PUBLIC_ACTOR_TOKEN_SECRET=<secret>`: включает прием и проверку заголовка `x-actor-token` (формат signed token `payload.signature`, HMAC-SHA256).
- `PUBLIC_ACTOR_TOKEN_TTL_SECONDS=3600`: TTL выдаваемых actor token.

Текущая реализация уже поддерживает signed token, но пока не реализует полную JWT-проверку (`iss/aud/claims`) и централизованный identity-provider flow.

На frontend должен быть установлен тот же режим:
- `VITE_PUBLIC_WRITE_AUTH_MODE=auth|hybrid|demo`

## Встроенная Auth Виджета (по умолчанию)
Сейчас по умолчанию включена собственная auth внутри виджета:
- в UI виджета есть формы `Вход` и `Регистрация` (email/username + пароль);
- вход/регистрация работают через стандартные Strapi endpoint'ы:
  - `POST /api/auth/local`
  - `POST /api/auth/local/register`
- подтверждение почты включается через встроенную механику Strapi (`email_confirmation=true`);
- при включенном подтверждении регистрация не делает автологин до подтверждения email;
- в UI есть повторная отправка письма через:
  - `POST /api/auth/send-email-confirmation`
- в UI есть flow `Забыли пароль?`:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
- после успешного входа виджет запрашивает `POST /api/public/auth/actor-token` (Bearer JWT) и автоматически подставляет `x-actor-token` в write-запросы.

Переменные:
- `WIDGET_INTERNAL_AUTH_ENABLED=true` (backend): включает endpoint выдачи actor token для внутренней auth.
- `WIDGET_AUTH_EMAIL_CONFIRMATION_ENABLED=true` (backend): включает обязательное подтверждение email для встроенной auth.
- `WIDGET_AUTH_EMAIL_CONFIRMATION_REDIRECT=http://localhost:5173/app/roadmap`: куда отправлять пользователя после клика по ссылке подтверждения (dev).
- `WIDGET_AUTH_PASSWORD_RESET_URL=http://localhost:5173/app/roadmap`: базовый URL для письма `Сброс пароля` (backend автоматически добавляет `?resetCode=<token>`).
- SMTP (рекомендуется Mail.ru SMTP для запуска из РФ):
  - `SMTP_HOST=smtp.mail.ru`
  - `SMTP_PORT=465`
  - `SMTP_SECURE=true`
  - `SMTP_USER=<ваш ящик Mail.ru>`
  - `SMTP_PASS=<пароль приложения Mail.ru>`
- `EMAIL_DEFAULT_FROM` должен совпадать с `SMTP_USER` для `smtp.mail.ru` (иначе `550 not local sender over smtp`).
- `EMAIL_FROM_NAME=Roadmap Platform` (имя отправителя в письмах).
- `EMAIL_DEFAULT_FROM=noreply@example.com`, `EMAIL_DEFAULT_REPLY_TO=noreply@example.com`: отправитель системных писем.
- `VITE_WIDGET_INTERNAL_AUTH_ENABLED=true` (frontend): включает UI внутренней auth.
- `VITE_BACKEND_BASE_URL=http://localhost:1337`: base URL backend для login/register/token API.
- `PUBLIC_ACTOR_TOKEN_SECRET=<secret>`: обязателен для выдачи `actorToken` (встроенная auth не заработает без этого секрета).

Важно:
- для реальной доставки писем нужно настроить Email provider в Strapi (SMTP/API-провайдер).
- без провайдера письма подтверждения не отправятся, и пользователь не сможет подтвердить email.

### Быстрый запуск отправки писем (Mail.ru SMTP)
1. Включите двухфакторную защиту в Mail.ru ID.
2. Создайте пароль приложения для почты.
3. Заполните `SMTP_USER`, `SMTP_PASS`, `EMAIL_DEFAULT_FROM` в `backend/.env`.
4. Перезапустите backend (`cd backend; npm run develop` или `npm run start`).
5. Проверьте регистрацию нового пользователя: должно прийти письмо подтверждения.

Примечание:
- при старте backend автоматически синхронизирует `from` в шаблонах `users-permissions` (`email_confirmation`, `reset_password`) на значения из env, чтобы не оставался дефолтный `no-reply@strapi.io`.
- письмо подтверждения использует стандартную ссылку Strapi (`/api/auth/email-confirmation?confirmation=...`), после подтверждения пользователь уходит на `WIDGET_AUTH_EMAIL_CONFIRMATION_REDIRECT`.
- письмо `Сброс пароля` содержит кнопку с прямой ссылкой в виджет; код подставляется в форму автоматически по query-параметру `resetCode`.
- для prod-like (`/app` на `1337`) поменяйте обе переменные на `http://localhost:1337/app/roadmap`.

Альтернатива:
- можно использовать `smtp.yandex.com` с параметрами `SMTP_PORT=465`, `SMTP_SECURE=true`.

Если хотите использовать только внешнюю auth хоста:
- `VITE_WIDGET_INTERNAL_AUTH_ENABLED=false`;
- передавать `actorToken/actorId` из хоста через `embed.js` (`data-actor-token` / `setAuth`).

Приоритет отправки заголовков в write-запросах:
- если заполнен token: отправляется `x-actor-token` (и `x-actor-id`, если задан вручную);
- иначе, если заполнен только actor id: отправляется `x-actor-id`;
- если identity не задан и режим `hybrid`: используется `userFingerprint`.

Rate-limit для public write также учитывает actor identity (`x-actor-id` / `x-user-id`) и только затем fallback на `userFingerprint`.

## Seed для демо
Платформу можно быстро наполнить демонстрационными данными без очистки текущей базы. Скрипт работает в режиме `append-only`: уже существующие demo-записи не дублируются, а demo-пользователи при повторном запуске просто приводятся к ожидаемому состоянию.

```powershell
cd backend
npm run seed:demo
```

Что создаётся:
- 5 demo-пользователей
- roadmap-элементы в статусах `planned / in_progress / done`
- идеи пользователей в разных статусах
- лайки и комментарии к идеям и roadmap

Демо-аккаунты:
- `anna.demo@roadmap.test / Demo12345!`
- `nikita.demo@roadmap.test / Demo12345!`
- `olga.demo@roadmap.test / Demo12345!`
- `sergey.demo@roadmap.test / Demo12345!`
- `maria.demo@roadmap.test / Demo12345!`

Если скрипт сообщает, что не найден `backend/dist`, сначала выполните:
```powershell
cd backend
npm run build
```

## Prod-like демо
```powershell
npm run demo:build
```

После сборки публичное приложение:
- `http://localhost:1337/app/`

## Smoke-check
```powershell
npm run smoke:check
```

Manager-checks в smoke-скрипте требуют JWT администратора (`MANAGER_JWT`):
```powershell
$env:MANAGER_JWT='<admin-jwt>'
npm run smoke:check
```

Если нужно явно передать секрет для token-checks:
```powershell
npm run smoke:check -- -ActorTokenSecret "<your-public-actor-token-secret>"
```

## Embed usage
```html
<script src="http://localhost:1337/embed.js" data-project="default"></script>
```

Embed + actor token:
```html
<script
  src="http://localhost:1337/embed.js"
  data-project="default"
  data-target="#widget-host"
  data-frame-id="roadmap-widget-frame"
  data-api-name="RoadmapEmbed"
  data-actor-token="<signed-token>"
></script>
```

Runtime token refresh (no iframe reload):
```html
<script>
  window.RoadmapEmbed.setAuth({ actorToken: "<new-signed-token>" });
</script>
```

Dev override:
```html
<script src="http://localhost:1337/embed.js" data-url="http://localhost:5173" data-project="default"></script>
```

## Чек-лист предзащиты
1. `docker compose up -d postgres`
2. `npm run demo:build`
3. `cd backend && npm run develop`
4. Проверить:
   - `http://localhost:1337/app/`
   - `http://localhost:1337/embed-demo.html`
   - `http://localhost:1337/admin`
5. `npm run smoke:check`

## Backlog после MVP
- Переход roadmap/ideas write-операций с fingerprint на actorId (auth-mode).
- Полноценный RBAC/claims для Product Manager Panel (поверх текущего allowlist email).
- Auth-ready архитектура (JWT/signed token от основного сайта).
- Переход от `fingerprint` к `userId` для write-операций.
- Расширенные smoke/e2e проверки для auth и manager-flow.

