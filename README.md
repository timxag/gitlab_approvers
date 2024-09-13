# Скрипт для сбора статистики по аппрувам в GitLab

## Запуск

1. npm install
2. Заполнить в файле .env переменные GITLAB_URL, PRIVATE_TOKEN, PROJECT_ID, ELIGIBLE_USERS в формате:

```
GITLAB_URL=https://your.gitlab.ru/
PRIVATE_TOKEN=<your-private-token>
PROJECT_ID=<id>
ELIGIBLE_USERS=user1,user2,user3
```

3. npm start

## Результат

После запуска скрипта в консоли будет общая статистика по пользователям, а в файле fullReport.txt будет записан отчет с подробной информацией.
