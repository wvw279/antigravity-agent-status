# Agent Status v1.5.1

### How to install or update
1. Download **`Antigravity-Agent-Status-Installer.zip`** below.
2. Extract the archive to any folder.
3. Run **`INSTALL.bat`** and click **Install / Update** — the installer will automatically update the plugin and relaunch Antigravity (all your custom presets and settings are preserved).

---

## v1.5.x — Пользовательские пресеты, постоянное сохранение и GUI-установщик
- **v1.5.1:** Переведено хранение выбранного пресета, пользовательских пресетов и всех настроек панели (`panelMode`, размеры, положение язычка) на постоянное хранение на диске через локальный сервер (`PLUGIN_DATA/prefs.json` и `custom-presets/<id>/*.bin`). Обновлён установщик: добавлено тёмное GUI-окно (`installer-ui.ps1`), авто-поиск Antigravity и Node.js, авто-включение плагина в `config.json` и автоматический перезапуск Antigravity.
- **v1.5.0:** Добавлено создание пользовательских пресетов со своими названиями прямо в настройках панели (`⚙`), с мини-превью и удалением (`×`).
- **v1.4.9:** Названия пресетов в настройках выровнены по левому краю (в одну линию с кнопкой «Готово»).
- **v1.4.8:** Добавлено перетаскивание свёрнутого язычка статуса агента вверх и вниз по правой грани окна с сохранением позиции.
