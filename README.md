# Hello App

Элементарный сайт: фронтенд на JavaScript (статические HTML/CSS/JS) + бэкенд на Java (Spring Boot),
отдаются одним приложением.

## Локальный запуск

```bash
mvn spring-boot:run
```

Открыть http://localhost:8080

## Деплой на Render.com

1. Запушить репозиторий на GitHub.
2. На Render.com создать **New Web Service**, выбрать этот репозиторий.
3. Environment: **Docker** (Render сам найдёт `Dockerfile`).
4. Render передаёт порт через переменную `PORT` — приложение уже это учитывает.
5. После деплоя сайт будет доступен по адресу вида `https://<service-name>.onrender.com`.
