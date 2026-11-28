# Agent Status v1.7.0

### How to install or update
1. Download **`Antigravity-Agent-Status-Installer.zip`** below.
2. Extract the archive to any folder.
3. Run **`INSTALL.bat`** and click **Install / Update** — the installer will automatically update the plugin and relaunch Antigravity (all your custom presets and settings are preserved).

---

## v1.7.0 — Адаптация под Antigravity 2.36.0 и умный автопатчер
- **v1.7.0:** Проверена и адаптирована совместимость с **Antigravity 2.36.0** (`dist/preload.js`, обновление SHA256-блоков `integrity` в `app.asar`). Добавлен автономный **автопатчер (`auto-patcher.mjs`)**: автоматически обнаруживает сброс `app.asar` после обновлений Antigravity, восстанавливает загрузчик (с уведомлением в трее Windows), а если файл заблокирован запущенной IDE (`EBUSY`/`EPERM`), тихо ждёт закрытия Antigravity и патчит `app.asar` сразу после выхода. В `patch-asar.mjs` добавлен автопоиск `app.asar` по запущенному процессу `Antigravity.exe` и динамический поиск `preload.js` на случай будущих изменений структуры ASAR.
