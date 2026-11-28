# Agent Status for Antigravity

![Version](https://img.shields.io/badge/version-v1.7.1-d98a3c?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-2b2b34?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-4caf50?style=flat-square)

🇬🇧 **English** | 🇷🇺 [Русская версия ниже](#статус-агента-для-antigravity)

A completely standalone plugin for **Antigravity** that adds a native right-side agent status panel with live 3D animations, an elapsed timer, built-in animal presets, and custom user presets.

Requires no third-party patchers or extensions — works out of the box and automatically self-heals after Antigravity updates.

---

## Features

- **Two display modes:**
  - **Full mode** — a tall right-side panel displaying live agent activity details (files being read/edited, commands running) and an `MM:SS` timer without shifting or shrinking the chat.
  - **Compact mode** — a sleek corner card in the top-right corner (resizable from the bottom-left corner `↙`).
- **Collapsible & draggable tab:** collapse the panel into a compact edge tab and drag it freely up and down along the right edge of the window.
- **Built-in animal presets:**
  - **Spider** (default)
  - **Cat** (calico)
  - **Snake** (white)
  - **Koi**
  - **Lobster**
- **Custom user presets:** upload any `GIF / WebP / PNG / JPG` (via file picker or drag-and-drop), give your preset a custom name, and save it to the preset list.
- **Persistent disk storage:** your selected preset, custom presets, panel mode, dimensions, and tab position are saved locally on disk and preserved across restarts.

---

## Quick Installation (Windows)

### Requirements
- **Antigravity** installed
- **Node.js LTS** ([nodejs.org](https://nodejs.org/)) — the installer checks this automatically
- Brief internet connection (~5 sec) on first install to fetch `@modelcontextprotocol/sdk`

### Steps
1. Download **`Antigravity-Agent-Status-Installer.zip`** from the [**Releases**](https://github.com/wvw279/antigravity-agent-status/releases/latest) page (or click `Code → Download ZIP`).
2. **Extract the entire archive** into a regular folder (right-click ZIP → *Extract All*).
3. Double-click **`INSTALL.bat`**.
4. Click **Install / Update** in the installer window.

The installer will automatically:
- locate Antigravity (or let you pick `Antigravity.exe` manually);
- close Antigravity while patching;
- copy the plugin, enable it in `~/.gemini/config/config.json`, and install dependencies;
- inject the standalone loader into `app.asar`;
- **relaunch Antigravity** with the Agent Status panel ready to go.

---

## Creating Custom Presets

1. Click the gear icon **`⚙`** in the top-right corner of the panel.
2. Upload animations for **Working** and **Idle** states (recommended: `1:1`, `256–512 px`).
3. Enter a name in the preset name field and click **`+ Save`** (or press `Enter`).
4. Your preset will appear in the list with a live thumbnail and persist across restarts.

---

## Uninstall

Run **`INSTALL.bat`** (or **`UNINSTALL.bat`**) and click **Uninstall** — the installer cleanly restores `app.asar`, removes the entry from `config.json`, and deletes plugin files.

---
---

# Статус агента для Antigravity

Полностью автономный плагин для **Antigravity**, добавляющий нативную правую панель статуса работы агента с живыми 3D-анимациями, таймером, встроенными пресетами животных и возможностью создавать собственные пресеты.

Не требует никаких сторонних патчеров или русификаторов — работает сам по себе и автоматически восстанавливается после обновлений Antigravity.

---

## Возможности

- **Два режима отображения:**
  - **Полный** — высокая панель справа с подробным статусом действий агента (какой файл читает/редактирует, какую команду выполняет) и таймером `MM:SS`. Не сдвигает и не сжимает чат.
  - **Компактный** — аккуратная угловая карточка справа сверху (растягивается за нижний левый угол `↙`).
- **Сворачиваемый и перетаскиваемый язычок:** панель можно свернуть в компактный язычок на правой грани окна и свободно перетаскивать его вверх/вниз.
- **Встроенные пресеты животных:**
  - **Паук** (базовый)
  - **Кот** (трёхцветный)
  - **Змея** (белая)
  - **Карп кои**
  - **Лобстер**
- **Свои пользовательские пресеты:** загружайте любые `GIF / WebP / PNG / JPG` (кликом или перетаскиванием), задавайте пресету своё название и сохраняйте в общий список.
- **Постоянное сохранение на диск:** выбранный пресет, созданные пользовательские пресеты, режим панели, размеры и позиция язычка сохраняются локально и не пропадают после перезапуска Antigravity.

---

## Быстрая установка (Windows)

### Требования
- Установленный **Antigravity**
- Установленный **Node.js LTS** ([nodejs.org](https://nodejs.org/)) — установщик сам проверит наличие
- Интернет на 5 секунд при первой установке (для скачивания `@modelcontextprotocol/sdk`)

### Шаги
1. Скачайте свежий архив **`Antigravity-Agent-Status-Installer.zip`** из раздела [**Releases**](https://github.com/wvw279/antigravity-agent-status/releases/latest) (или нажмите `Code → Download ZIP`).
2. **Распакуйте весь архив** в обычную папку (правой кнопкой по ZIP → *«Извлечь все»*).
3. Запустите двойным кликом **`INSTALL.bat`**.
4. В открывшемся окне нажмите **Install / Update**.

Установщик сам найдёт и закроет Antigravity, скопирует плагин, включит его в `~/.gemini/config/config.json`, пропатчит `app.asar` и **сам снова запустит Antigravity** уже с готовой панелью!

---

## Как создать свой пресет

1. Нажмите шестерёнку **`⚙`** в правом верхнем углу панели.
2. Загрузите анимации в слоты **«Во время работы»** и **«В режиме ожидания»** (рекомендуется `1:1`, `256–512 px`).
3. Введите любое название в поле **«Название своего пресета…»** и нажмите **`+ Сохранить`** (или `Enter`).
4. Пресет появится в общем списке с мини-превью и будет сохранён между перезапусками.

---

## Удаление

Запустите **`INSTALL.bat`** (или **`UNINSTALL.bat`**) и нажмите кнопку **Uninstall** — установщик полностью очистит `app.asar`, уберёт запись из `config.json` и удалит файлы плагина.

---

## История изменений / Changelog

Full changelog is available in [CHANGELOG.md](./CHANGELOG.md).
