// Встроенная правая панель «Статус агента» (v1.7.1 — мгновенный сброс статуса при отмене агента пользователем)
function initActivityPanel() {
    const STYLE_ID = 'ag-activity-panel-style';
    const PANEL_ID = 'ag-activity-panel-root';
    const TAB_ID = 'ag-activity-panel-tab';
    const BASE_URLS = ['http://127.0.0.1:39229'];
    let activeBaseUrl = BASE_URLS[0];
    const STORAGE_WIDTH_KEY = 'ag_activity_panel_width';
    const STORAGE_COLLAPSED_KEY = 'ag_activity_panel_collapsed';
    const STORAGE_MODE_KEY = 'ag_activity_panel_mode';
    const STORAGE_MINI_W_KEY = 'ag_activity_mini_w';
    const STORAGE_MINI_H_KEY = 'ag_activity_mini_h';
    const STORAGE_PRESET_KEY = 'ag_activity_panel_preset';
    const STORAGE_CUSTOM_PRESETS_KEY = 'ag_activity_custom_presets';
    const STORAGE_TAB_Y_KEY = 'ag_activity_tab_y_ratio';
    const STORAGE_LANG_KEY = 'ag_activity_panel_lang';
    const VALID_PRESETS = ['spider', 'cat', 'snake', 'koi', 'lobster', 'blue-lobster'];

    const I18N = {
        en: {
            title: 'Agent Status',
            settingsTitle: 'Settings',
            collapseTitle: 'Collapse panel',
            resizeWidthTitle: 'Resize panel width',
            resizeCornerTitle: 'Drag to resize',
            tabTitle: 'Open Agent Status panel (drag up/down to move)',
            ready: 'Ready',
            workingShort: 'Working…',
            thinkingShort: 'Thinking…',
            workingFallback: 'Working on task…',
            settingsHeading: 'Panel Settings',
            langLabel: 'Language',
            langAuto: 'Auto',
            modeLabel: 'Panel mode',
            modeFull: 'Full',
            modeMini: 'Compact',
            slotWorking: 'While working',
            slotIdle: 'While idle',
            uploadGif: 'Upload GIF',
            resetPresetTitle: 'Reset to preset',
            tagCustom: 'Custom ✓',
            tagLoading: 'Loading…',
            tagError: 'Error',
            noteHtml: 'GIF, WebP, PNG, JPG (drag &amp; drop)<br/>Optimal: <b>1:1</b>, <b>256–512 px</b>',
            presetPlaceholder: 'Custom preset name…',
            presetSave: '+ Save',
            presetSaveTitle: 'Save current animations as a new preset',
            presetSpider: 'Spider',
            presetCat: 'Cat',
            presetSnake: 'Snake',
            presetKoi: 'Koi',
            presetLobster: 'Lobster',
            presetSelect: 'Select',
            presetSelected: 'Selected ✓',
            presetBlueSecret: 'Blue ⚡',
            deletePresetTitle: 'Delete preset',
            done: 'Done'
        },
        ru: {
            title: 'Статус агента',
            settingsTitle: 'Настройки',
            collapseTitle: 'Свернуть панель',
            resizeWidthTitle: 'Изменить ширину панели',
            resizeCornerTitle: 'Потяните, чтобы изменить размер окна',
            tabTitle: 'Открыть панель «Статус агента» (потяните вверх/вниз для перемещения)',
            ready: 'Готов к работе',
            workingShort: 'Работаю…',
            thinkingShort: 'Думаю…',
            workingFallback: 'Выполняю задачу…',
            settingsHeading: 'Настройки панели',
            langLabel: 'Язык',
            langAuto: 'Авто',
            modeLabel: 'Вид панели',
            modeFull: 'Полный',
            modeMini: 'Компактный',
            slotWorking: 'Во время работы',
            slotIdle: 'В режиме ожидания',
            uploadGif: 'Загрузить GIF',
            resetPresetTitle: 'Вернуть пресет',
            tagCustom: 'Своя ✓',
            tagLoading: 'Загрузка…',
            tagError: 'Ошибка',
            noteHtml: 'GIF, WebP, PNG, JPG (можно перетащить)<br/>Оптимально: <b>1:1</b>, <b>256–512 px</b>',
            presetPlaceholder: 'Название своего пресета…',
            presetSave: '+ Сохранить',
            presetSaveTitle: 'Сохранить текущие анимации как новый пресет',
            presetSpider: 'Паук',
            presetCat: 'Кот',
            presetSnake: 'Змея',
            presetKoi: 'Карп',
            presetLobster: 'Лобстер',
            presetSelect: 'Выбрать',
            presetSelected: 'Выбрано ✓',
            presetBlueSecret: 'Синий ⚡',
            deletePresetTitle: 'Удалить пресет',
            done: 'Готово'
        }
    };

    // Пороги автосворачивания (с гистерезисом, чтобы не мигало на границе при ресайзе окна)
    const MIN_PANEL_HIDE_W = 188;
    const MIN_PANEL_SHOW_W = 204;
    const COMPOSER_GAP = 28; // Запас под полосу прокрутки чата + небольшой воздух

    let reservedTarget = null;
    let layoutMo = null;
    let syncRaf = 0;
    let autoHidden = false;

    const releaseLayoutReservation = () => {
        if (reservedTarget && reservedTarget.style) {
            try {
                reservedTarget.style.removeProperty('padding-right');
                reservedTarget.style.removeProperty('box-sizing');
                reservedTarget.style.removeProperty('width');
                reservedTarget.style.removeProperty('max-width');
                reservedTarget.style.removeProperty('margin-right');
                reservedTarget.removeAttribute('data-ag-act-reserved');
            } catch (e) {}
        }
        reservedTarget = null;
        document.querySelectorAll('[data-ag-act-reserved="1"]').forEach((el) => {
            try {
                el.style.removeProperty('padding-right');
                el.style.removeProperty('box-sizing');
                el.style.removeProperty('width');
                el.style.removeProperty('max-width');
                el.style.removeProperty('margin-right');
                if (el.getAttribute('data-ag-act-right') === '1') {
                    el.style.removeProperty('right');
                    el.removeAttribute('data-ag-act-right');
                }
                el.removeAttribute('data-ag-act-w');
                el.removeAttribute('data-ag-act-reserved');
            } catch (e) {}
        });
    };

    // Очистка предыдущего экземпляра (например, при hot-reload)
    const cleanupPrev = () => {
        if (typeof window.__ag_activity_panel_dispose === 'function') {
            try { window.__ag_activity_panel_dispose(); } catch (e) {}
            window.__ag_activity_panel_dispose = null;
        }
        if (window.__ag_activity_panel_raf) {
            cancelAnimationFrame(window.__ag_activity_panel_raf);
            window.__ag_activity_panel_raf = 0;
        }
        if (syncRaf) {
            cancelAnimationFrame(syncRaf);
            syncRaf = 0;
        }
        if (window.__ag_activity_panel_mo) {
            try { window.__ag_activity_panel_mo.disconnect(); } catch (e) {}
            window.__ag_activity_panel_mo = null;
        }
        if (layoutMo) {
            try { layoutMo.disconnect(); } catch (e) {}
            layoutMo = null;
        }
        if (window.__ag_activity_panel_poll) {
            clearInterval(window.__ag_activity_panel_poll);
            window.__ag_activity_panel_poll = null;
        }
        if (window.__ag_activity_panel_tick) {
            clearInterval(window.__ag_activity_panel_tick);
            window.__ag_activity_panel_tick = null;
        }
        if (window.__ag_activity_panel_top_sync) {
            clearInterval(window.__ag_activity_panel_top_sync);
            window.__ag_activity_panel_top_sync = null;
        }
        if (window.__ag_activity_panel_asset_retry) {
            clearTimeout(window.__ag_activity_panel_asset_retry);
            window.__ag_activity_panel_asset_retry = null;
        }
        if (Array.isArray(window.__ag_activity_panel_blob_urls)) {
            for (const u of window.__ag_activity_panel_blob_urls) {
                try { URL.revokeObjectURL(u); } catch (e) {}
            }
            window.__ag_activity_panel_blob_urls = [];
        }
        releaseLayoutReservation();
        const oldScrollOverlay = document.getElementById('ag-act-scroll-overlay');
        if (oldScrollOverlay) oldScrollOverlay.remove();
        document.querySelectorAll('[data-ag-act-scroll="1"]').forEach((el) => {
            try {
                el.style.removeProperty('--ag-mini-scroll-top');
                el.removeAttribute('data-ag-act-scroll');
            } catch (e) {}
        });
        const oldStyle = document.getElementById(STYLE_ID);
        if (oldStyle) oldStyle.remove();
        const oldPanel = document.getElementById(PANEL_ID);
        if (oldPanel) oldPanel.remove();
        const oldTab = document.getElementById(TAB_ID);
        if (oldTab) oldTab.remove();
    };
    cleanupPrev();

    let savedWidth = 272;
    try {
        const w = parseInt(localStorage.getItem(STORAGE_WIDTH_KEY) || '', 10);
        if (w >= 190 && w <= 760) savedWidth = w;
    } catch (e) {}

    let userCollapsed = false;
    try {
        userCollapsed = localStorage.getItem(STORAGE_COLLAPSED_KEY) === '1';
    } catch (e) {}

    let panelMode = 'full';
    try {
        if (localStorage.getItem(STORAGE_MODE_KEY) === 'mini') panelMode = 'mini';
    } catch (e) {}

    let customPresets = [];
    try {
        const rawCp = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_PRESETS_KEY) || '[]');
        if (Array.isArray(rawCp)) {
            customPresets = rawCp.filter((p) => p && typeof p.id === 'string' && p.id.startsWith('custom-') && typeof p.name === 'string' && p.name.trim());
        }
    } catch (e) {}

    const isValidPresetId = (id) => VALID_PRESETS.includes(id) || customPresets.some((p) => p.id === id);

    let activePreset = 'spider';
    try {
        const sp = localStorage.getItem(STORAGE_PRESET_KEY);
        if (sp && isValidPresetId(sp)) activePreset = sp;
    } catch (e) {}

    let miniWidth = 228;
    let miniHeight = 248;
    try {
        const mw = parseInt(localStorage.getItem(STORAGE_MINI_W_KEY) || '', 10);
        const mh = parseInt(localStorage.getItem(STORAGE_MINI_H_KEY) || '', 10);
        if (mw >= 170 && mw <= 400) miniWidth = mw;
        if (mh >= 180 && mh <= 440) miniHeight = mh;
    } catch (e) {}

    let tabYRatio = 0.5;
    try {
        const ty = parseFloat(localStorage.getItem(STORAGE_TAB_Y_KEY) || '');
        if (!Number.isNaN(ty) && ty >= 0 && ty <= 1) tabYRatio = ty;
    } catch (e) {}

    let langMode = 'auto';
    try {
        const lm = localStorage.getItem(STORAGE_LANG_KEY);
        if (lm === 'en' || lm === 'ru' || lm === 'auto') langMode = lm;
    } catch (e) {}

    function detectAppLanguage() {
        try {
            // 1. Проверяем плейсхолдер поля ввода чата — самый точный индикатор языка UI Antigravity
            const inputs = document.querySelectorAll('textarea[placeholder], [contenteditable="true"][data-placeholder], [aria-placeholder]');
            for (const el of inputs) {
                if (el.closest && el.closest('#' + PANEL_ID)) continue;
                const ph = (el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || el.getAttribute('aria-placeholder') || '').trim();
                if (!ph) continue;
                if (/[А-Яа-яЁё]{3,}/.test(ph)) return 'ru';
                if (/[A-Za-z]{3,}/.test(ph)) return 'en';
            }
            // 2. Проверяем системные кнопки навигации / шапки (вне нашей панели и сообщений чата)
            let ruHits = 0;
            let enHits = 0;
            const uiEls = document.querySelectorAll('header button, nav button, [role="navigation"] button, [role="tablist"] button, [role="menubar"] button');
            for (const el of uiEls) {
                if (el.closest && (el.closest('#' + PANEL_ID) || el.closest('#' + TAB_ID))) continue;
                const txt = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
                if (txt.length < 3 || txt.length > 40) continue;
                if (/[А-Яа-яЁё]{3,}/.test(txt)) ruHits += 1;
                else if (/[A-Za-z]{3,}/.test(txt)) enHits += 1;
            }
            if (ruHits > 0 || enHits > 0) {
                return ruHits >= enHits ? 'ru' : 'en';
            }
        } catch (e) {}
        // 3. Фолбэк на локаль документа/браузера при раннем старте
        const docLang = (document.documentElement && document.documentElement.lang) || '';
        const navLang = (typeof navigator !== 'undefined' && navigator.language) || '';
        const raw = (docLang || navLang || 'en').toLowerCase();
        return /^(ru|uk|be|kk)/.test(raw) ? 'ru' : 'en';
    }

    let effectiveLang = langMode === 'auto' ? detectAppLanguage() : langMode;
    // Защита английских строк от перехвата внешним русификатором (antigravity-features-v2),
    // который иначе переводит "Compact" -> "Сжать контекст", "Auto" -> "Авто", "Thinking…" -> "Размышление..."
    const guardEnText = (str) => {
        if (effectiveLang !== 'en' || !str) return str;
        return String(str).replace(/\b([A-Za-z]{2})([A-Za-z]+)/g, '$1\u2060$2');
    };
    const t = (key) => {
        const raw = (I18N[effectiveLang] && I18N[effectiveLang][key]) || I18N.en[key] || key;
        if (key === 'noteHtml') return raw;
        return guardEnText(raw);
    };

    function localizeStatusDetail(rawDetail) {
        const s = String(rawDetail || '').trim();
        if (!s) return t('workingFallback');
        if (effectiveLang === 'ru') return s;
        const exactMap = {
            'Думаю…': 'Thinking…',
            'Думаю...': 'Thinking…',
            'Размышление…': 'Thinking…',
            'Размышление...': 'Thinking…',
            'Обрабатываю…': 'Processing…',
            'Работаю…': 'Working…',
            'Анализирую запрос…': 'Analyzing request…',
            'Выполняю задачу…': 'Working on task…',
            'Выполняю команду…': 'Running command…',
            'Читаю файл…': 'Reading file…',
            'Записываю файл…': 'Writing file…',
            'Редактирую файл…': 'Editing file…',
            'Ищу в интернете…': 'Searching the web…',
            'Запускаю субагента…': 'Running subagent…',
            'Вызываю MCP-инструмент…': 'Calling MCP tool…',
            'Обновляю статус…': 'Updating status…',
            'Обновляю план…': 'Updating plan…',
            'Проверяю фоновую задачу…': 'Checking background task…',
            'Ожидание задачи': 'Waiting for task',
            'Ответ готов': 'Response ready',
            'Готов к работе': 'Ready'
        };
        if (exactMap[s]) return guardEnText(exactMap[s]);
        const prefixMap = [
            ['Читаю ', 'Reading '],
            ['Редактирую ', 'Editing '],
            ['Записываю ', 'Writing '],
            ['Команда: ', 'Command: '],
            ['Ищу: ', 'Searching: '],
            ['Агент: ', 'Agent: '],
            ['Инструмент: ', 'Tool: ']
        ];
        for (const [ruPrefix, enPrefix] of prefixMap) {
            if (s.startsWith(ruPrefix)) return guardEnText(enPrefix) + s.slice(ruPrefix.length);
        }
        return guardEnText(s);
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${PANEL_ID} {
            position: fixed;
            top: 76px;
            right: 8px;
            bottom: 8px;
            width: ${savedWidth}px;
            z-index: 40;
            background: var(--ag-shell-bg, #111114);
            border: none;
            color: #ececef;
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            display: flex;
            flex-direction: column;
            user-select: none;
            -webkit-app-region: no-drag;
            transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), height 0.2s ease, border-radius 0.2s ease;
            box-sizing: border-box;
            overflow: visible;
        }
        /* Плавное вогнутое скругление стыка с верхней линией интерфейса (слева сверху) */
        #${PANEL_ID}::before {
            content: '';
            position: absolute;
            top: 0;
            left: -14px;
            width: 14px;
            height: 14px;
            background: radial-gradient(circle at 0 100%, transparent 13.5px, var(--ag-shell-bg, #111114) 14px);
            pointer-events: none;
        }
        /* Плавное вогнутое скругление стыка с нижней линией интерфейса (слева снизу в полном виде) */
        #${PANEL_ID}::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: -14px;
            width: 14px;
            height: 14px;
            background: radial-gradient(circle at 0 0, transparent 13.5px, var(--ag-shell-bg, #111114) 14px);
            pointer-events: none;
        }
        #${PANEL_ID}.collapsed::before,
        #${PANEL_ID}.collapsed::after {
            display: none;
        }
        #${PANEL_ID}.mode-mini {
            bottom: auto;
            height: ${miniHeight}px;
            background: var(--ag-shell-bg, #111114);
            border: none;
            border-bottom-left-radius: 18px;
            box-shadow: none;
            overflow: visible;
        }
        /* В компактном виде нижнее вогнутое скругление переходит на правый край (справа снизу) */
        #${PANEL_ID}.mode-mini::after {
            left: auto;
            right: 0;
            bottom: -14px;
            background: radial-gradient(circle at 0 100%, transparent 13.5px, var(--ag-shell-bg, #111114) 14px);
        }
        #${PANEL_ID}.mode-mini.settings-open {
            min-width: 244px;
            height: auto !important;
        }
        #${PANEL_ID}.mode-mini.settings-open .ag-act-body {
            flex: 0 0 auto;
            display: block;
            height: auto;
        }
        #${PANEL_ID}.mode-mini.settings-open .ag-act-view {
            display: none;
        }
        #${PANEL_ID}.mode-mini.settings-open .ag-act-corner-resizer {
            display: none !important;
        }
        #${PANEL_ID}.mode-mini .ag-act-body {
            border-bottom-left-radius: 17px;
            overflow: hidden;
        }
        #${PANEL_ID}.mode-mini .ag-act-settings {
            background: var(--ag-shell-bg, #111114);
            border-bottom-left-radius: 17px;
            padding: 14px;
        }
        #${PANEL_ID}.mode-mini.settings-open .ag-act-settings {
            position: relative;
            inset: auto;
            overflow: visible;
        }
        #${PANEL_ID}.mode-mini .ag-act-resizer {
            display: none;
        }
        .ag-act-corner-resizer {
            display: none;
            position: absolute;
            left: 2px;
            bottom: 2px;
            width: 18px;
            height: 18px;
            cursor: nesw-resize;
            z-index: 15;
            border-bottom-left-radius: 16px;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.25);
            font-size: 11px;
            line-height: 1;
            transition: color 0.15s ease;
        }
        #${PANEL_ID}.mode-mini .ag-act-corner-resizer {
            display: flex;
        }
        .ag-act-corner-resizer:hover,
        .ag-act-corner-resizer.dragging {
            color: rgba(255, 255, 255, 0.72);
        }
        #${PANEL_ID}.mode-mini .ag-act-header {
            height: 32px;
            border-bottom-color: rgba(255, 255, 255, 0.06);
        }
        #${PANEL_ID}.mode-mini .ag-act-view {
            padding: 10px 12px 14px;
            gap: 8px;
        }
        #${PANEL_ID}.mode-mini .ag-act-ring {
            width: var(--ag-mini-ring, 116px);
            height: var(--ag-mini-ring, 116px);
            flex-shrink: 0;
        }
        #${PANEL_ID}.mode-mini .ag-act-ring.idle-ring {
            width: var(--ag-mini-ring, 116px);
            height: var(--ag-mini-ring, 116px);
            flex-shrink: 0;
        }
        .ag-act-idle-spacer {
            display: none;
        }
        #${PANEL_ID}.mode-mini .ag-act-idle-spacer {
            display: block;
            height: 15px;
            flex-shrink: 0;
            visibility: hidden;
        }
        #${PANEL_ID}.mode-mini .ag-act-status-row,
        #${PANEL_ID}.mode-mini .ag-act-idle-badge {
            font-size: 11.5px;
        }
        .ag-act-seg {
            display: flex;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 2px;
            gap: 2px;
        }
        .ag-act-seg-btn {
            flex: 1;
            height: 24px;
            border: none;
            border-radius: 6px;
            background: transparent;
            color: #9b9ca6;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .ag-act-seg-btn:hover {
            color: #ececef;
        }
        .ag-act-seg-btn.active {
            background: rgba(217, 138, 60, 0.2);
            color: #f6c08a;
        }
        #${PANEL_ID}.collapsed {
            transform: translateX(100%);
            pointer-events: none;
        }
        #${PANEL_ID} * {
            box-sizing: border-box;
        }
        .ag-act-resizer {
            position: absolute;
            top: 0;
            left: -2px;
            bottom: 0;
            width: 4px;
            cursor: ew-resize;
            z-index: 5;
            background: transparent;
            transition: background 0.15s ease;
        }
        .ag-act-resizer:hover,
        .ag-act-resizer.dragging {
            background: rgba(255, 255, 255, 0.16);
        }
        .ag-act-header {
            height: 36px;
            padding: 0 8px 0 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            flex-shrink: 0;
            overflow: hidden;
        }
        .ag-act-title {
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.02em;
            color: #d4d4dc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ag-act-header-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #4caf50;
            flex-shrink: 0;
            transition: background 0.2s ease, box-shadow 0.2s ease;
        }
        .ag-act-header-dot.working {
            background: #d98a3c;
            box-shadow: 0 0 8px rgba(217, 138, 60, 0.85);
            animation: agActPulse 1.2s ease-in-out infinite;
        }
        .ag-act-header-actions {
            display: flex;
            align-items: center;
            gap: 2px;
            flex-shrink: 0;
        }
        .ag-act-icon-btn,
        .ag-act-collapse-btn {
            width: 24px;
            height: 24px;
            flex-shrink: 0;
            border: none;
            border-radius: 6px;
            background: transparent;
            color: #9b9ca6;
            font-size: 14px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .ag-act-icon-btn:hover,
        .ag-act-icon-btn.active,
        .ag-act-collapse-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
        }
        .ag-act-settings {
            position: absolute;
            inset: 0;
            background: #111114;
            z-index: 10;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 10px;
            padding: 14px;
            overflow-y: auto;
            opacity: 0;
            pointer-events: none;
            transform: translateY(6px);
            transition: opacity 0.18s ease, transform 0.18s ease;
        }
        .ag-act-settings.open {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        .ag-act-settings-done-btn {
            margin-top: 4px;
            flex: 0 0 32px !important;
            width: 100%;
        }
        .ag-act-set-heading {
            font-size: 12px;
            font-weight: 600;
            color: #e4e4ec;
            text-align: center;
            margin-bottom: 2px;
        }
        .ag-act-slot {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: border-color 0.15s ease, background 0.15s ease;
        }
        .ag-act-slot.dragover {
            border-color: rgba(217, 138, 60, 0.7);
            background: rgba(217, 138, 60, 0.08);
        }
        .ag-act-slot-label {
            font-size: 11px;
            color: #a0a1aa;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
        }
        .ag-act-slot-tag {
            font-size: 10px;
            color: #d98a3c;
            opacity: 0.9;
        }
        .ag-act-slot-actions {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .ag-act-btn {
            flex: 1;
            height: 28px;
            border-radius: 7px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.06);
            color: #ececef;
            font-size: 11.5px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        .ag-act-btn:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.18);
        }
        .ag-act-btn.primary {
            background: rgba(217, 138, 60, 0.18);
            border-color: rgba(217, 138, 60, 0.4);
            color: #f6c08a;
        }
        .ag-act-btn.primary:hover {
            background: rgba(217, 138, 60, 0.28);
        }
        .ag-act-btn.reset {
            flex: 0 0 28px;
            padding: 0;
            color: #a0a1aa;
        }
        .ag-act-set-note {
            font-size: 10.5px;
            color: #7c7d87;
            text-align: center;
            line-height: 1.35;
        }
        .ag-act-preset-list {
            display: flex;
            flex-direction: column;
            gap: 7px;
        }
        .ag-act-preset-row {
            display: grid;
            grid-template-columns: 62px 1fr;
            align-items: center;
            gap: 8px;
        }
        .ag-act-preset-name {
            font-size: 11.5px;
            font-weight: 500;
            color: #b4b5bf;
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ag-act-preset-box-wrap {
            display: flex;
            align-items: center;
            gap: 5px;
            min-width: 0;
        }
        .ag-act-preset-box-wrap .ag-act-preset-box {
            flex: 1;
            min-width: 0;
        }
        .ag-act-preset-del {
            width: 24px;
            height: 34px;
            flex-shrink: 0;
            padding: 0;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.09);
            background: rgba(255, 255, 255, 0.03);
            color: #8f909a;
            font-size: 14px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .ag-act-preset-del:hover {
            background: rgba(239, 68, 68, 0.16);
            border-color: rgba(239, 68, 68, 0.45);
            color: #fca5a5;
        }
        .ag-act-preset-create {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 2px;
        }
        .ag-act-preset-input {
            flex: 1;
            min-width: 0;
            height: 30px;
            padding: 0 9px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.04);
            color: #ececf1;
            font-size: 11.5px;
            font-family: inherit;
            outline: none;
            transition: border-color 0.15s ease, background 0.15s ease;
        }
        .ag-act-preset-input::placeholder {
            color: #7c7d87;
        }
        .ag-act-preset-input:focus {
            border-color: rgba(217, 138, 60, 0.65);
            background: rgba(255, 255, 255, 0.06);
        }
        .ag-act-preset-input.invalid {
            border-color: rgba(239, 68, 68, 0.75);
        }
        .ag-act-preset-save-btn {
            height: 30px;
            padding: 0 10px;
            flex: 0 0 auto;
            white-space: nowrap;
            font-size: 11px;
        }
        .ag-act-preset-box {
            height: 34px;
            padding: 0 10px 0 6px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.035);
            color: #c8c9d2;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
        }
        .ag-act-preset-box:hover {
            background: rgba(255, 255, 255, 0.075);
            border-color: rgba(255, 255, 255, 0.2);
            color: #ffffff;
        }
        .ag-act-preset-box.active {
            border-color: rgba(217, 138, 60, 0.65);
            background: rgba(217, 138, 60, 0.14);
            color: #f6c08a;
            box-shadow: 0 0 12px rgba(217, 138, 60, 0.14);
        }
        .ag-act-preset-box.active.blue-secret {
            border-color: rgba(96, 165, 250, 0.85);
            background: rgba(59, 130, 246, 0.22);
            color: #93c5fd;
            box-shadow: 0 0 16px rgba(59, 130, 246, 0.32);
        }
        .ag-act-preset-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            object-fit: cover;
            background: #161619;
            border: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }
        .ag-act-preset-state {
            font-size: 10.5px;
            opacity: 0.85;
            white-space: nowrap;
        }
        .ag-act-custom-details {
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 9px;
            background: rgba(255, 255, 255, 0.02);
            padding: 6px 8px;
        }
        .ag-act-custom-details summary {
            font-size: 11px;
            color: #8f9099;
            cursor: pointer;
            list-style: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
            user-select: none;
        }
        .ag-act-custom-details summary::-webkit-details-marker {
            display: none;
        }
        .ag-act-custom-details[open] summary {
            margin-bottom: 8px;
            color: #d4d4dc;
        }
        .ag-act-custom-body {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        #${PANEL_ID}.mode-mini.settings-open .ag-act-settings {
            max-height: calc(100vh - 116px);
            overflow-y: auto;
        }
        /* Секретная неоново-синяя тема для Синего лобстера */
        #${PANEL_ID}.theme-blue-lobster .ag-act-ring {
            border-color: rgba(96, 165, 250, 0.72);
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.34), inset 0 0 20px rgba(0, 12, 40, 0.55);
        }
        #${PANEL_ID}.theme-blue-lobster .ag-act-ring.idle-ring {
            border-color: rgba(59, 130, 246, 0.38);
            box-shadow: 0 0 24px rgba(59, 130, 246, 0.2), inset 0 0 18px rgba(0, 12, 40, 0.5);
        }
        #${PANEL_ID}.theme-blue-lobster .ag-act-header-dot.working,
        #${PANEL_ID}.theme-blue-lobster .ag-act-pulse-dot,
        #${TAB_ID}.theme-blue-lobster .ag-act-tab-dot.working {
            background: #3b82f6;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.95);
        }
        .ag-act-body {
            position: relative;
            flex: 1;
            width: 100%;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ag-act-view {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 14px;
            opacity: 0;
            pointer-events: none;
            transform: scale(0.96);
            transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .ag-act-view.active {
            opacity: 1;
            pointer-events: auto;
            transform: scale(1);
        }
        .ag-act-ring {
            width: min(210px, 78%);
            aspect-ratio: 1 / 1;
            border-radius: 50%;
            overflow: hidden;
            border: 1.5px solid rgba(212, 135, 62, 0.42);
            box-shadow: 0 0 28px rgba(212, 135, 62, 0.16), inset 0 0 20px rgba(0, 0, 0, 0.45);
            background: #161619;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ag-act-ring.idle-ring {
            width: min(192px, 74%);
            border: 1.5px solid rgba(255, 255, 255, 0.09);
            box-shadow: 0 0 22px rgba(0, 0, 0, 0.35), inset 0 0 18px rgba(0, 0, 0, 0.45);
            background: #111113;
        }
        .ag-act-ring img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .ag-act-ring img.loaded {
            opacity: 1;
        }
        .ag-act-status-row {
            display: flex;
            align-items: flex-start;
            justify-content: center;
            gap: 7px;
            font-size: 12.5px;
            line-height: 1.35;
            font-weight: 500;
            color: #ececef;
            text-align: center;
            max-width: 100%;
            word-break: break-word;
            padding: 0 4px;
        }
        .ag-act-pulse-dot {
            width: 7px;
            height: 7px;
            margin-top: 5px;
            border-radius: 50%;
            flex-shrink: 0;
            background: #d98a3c;
            box-shadow: 0 0 8px rgba(217, 138, 60, 0.8);
            animation: agActPulse 1.2s ease-in-out infinite;
        }
        @keyframes agActPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(0.7); opacity: 0.45; }
        }
        .ag-act-timer {
            font-size: 11px;
            color: #8f9099;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.06em;
        }
        .ag-act-idle-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            font-size: 12.5px;
            color: #a0a1aa;
            text-align: center;
        }
        .ag-act-idle-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            flex-shrink: 0;
            background: #4caf50;
            opacity: 0.9;
        }
        #${PANEL_ID}.compact .ag-act-status-row,
        #${PANEL_ID}.compact .ag-act-idle-badge {
            font-size: 11.5px;
        }
        #${PANEL_ID}.compact .ag-act-view {
            padding: 10px;
            gap: 9px;
        }
        #ag-act-scroll-overlay {
            position: fixed;
            z-index: 2147483000;
            width: 10px;
            pointer-events: none;
            display: none;
            overflow: hidden;
        }
        #ag-act-scroll-overlay.active {
            display: block;
        }
        #ag-act-scroll-overlay.mode-full-track {
            pointer-events: auto;
            overflow: visible;
        }
        #ag-act-scroll-overlay.mode-mini-clip {
            width: 8px;
            pointer-events: none;
            overflow: hidden;
        }
        #ag-act-scroll-thumb {
            position: absolute;
            right: 2px;
            width: 6px;
            border-radius: 999px;
            background: #353536;
            pointer-events: auto;
            cursor: default;
            transition: background 0.15s ease;
        }
        #ag-act-scroll-overlay.mode-mini-clip #ag-act-scroll-thumb {
            right: 1px;
            width: 6px;
        }
        #ag-act-scroll-thumb:hover,
        #ag-act-scroll-thumb.dragging {
            background: #58585c;
        }
        #${TAB_ID} {
            position: fixed;
            right: 0;
            top: 50%;
            z-index: 40;
            width: 24px;
            height: 56px;
            border-radius: 8px 0 0 8px;
            background: rgba(24, 24, 28, 0.94);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-right: none;
            box-shadow: -4px 0 14px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            cursor: pointer;
            user-select: none;
            color: #b4b5bf;
            -webkit-app-region: no-drag;
            transition: opacity 0.2s ease, background 0.15s ease;
        }
        #${TAB_ID}:hover {
            background: rgba(38, 38, 44, 0.98);
            color: #ffffff;
        }
        #${TAB_ID}.dragging {
            cursor: ns-resize;
            background: rgba(46, 46, 54, 0.98);
            border-color: rgba(255, 255, 255, 0.24);
            color: #ffffff;
            transition: none;
        }
        #${TAB_ID}.hidden {
            opacity: 0;
            pointer-events: none;
        }
        .ag-act-tab-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #4caf50;
        }
        .ag-act-tab-dot.working {
            background: #d98a3c;
            box-shadow: 0 0 8px rgba(217, 138, 60, 0.85);
            animation: agActPulse 1.2s ease-in-out infinite;
        }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.setAttribute('translate', 'no');
    panel.classList.add('notranslate');
    panel.innerHTML = `
        <div class="ag-act-resizer" id="ag-act-resizer" data-i18n-title="resizeWidthTitle" title="Изменить ширину панели"></div>
        <div class="ag-act-corner-resizer" id="ag-act-corner-resizer" data-i18n-title="resizeCornerTitle" title="Потяните, чтобы изменить размер окна">↙</div>
        <div class="ag-act-header">
            <div class="ag-act-title">
                <span class="ag-act-header-dot" id="ag-act-header-dot"></span>
                <span data-i18n="title">Статус агента</span>
            </div>
            <div class="ag-act-header-actions">
                <button class="ag-act-icon-btn" id="ag-act-settings-btn" data-i18n-title="settingsTitle" title="Настройки">⚙</button>
                <button class="ag-act-collapse-btn" id="ag-act-collapse-btn" data-i18n-title="collapseTitle" title="Свернуть панель">›</button>
            </div>
        </div>
        <div class="ag-act-body">
            <div class="ag-act-view" id="ag-act-view-working">
                <div class="ag-act-ring">
                    <img id="ag-act-img-working" alt="" />
                </div>
                <div class="ag-act-status-row">
                    <span class="ag-act-pulse-dot"></span>
                    <span id="ag-act-detail">Думаю…</span>
                </div>
                <div class="ag-act-timer" id="ag-act-timer">00:00</div>
            </div>
            <div class="ag-act-view active" id="ag-act-view-idle">
                <div class="ag-act-ring idle-ring">
                    <img id="ag-act-img-idle" alt="" />
                </div>
                <div class="ag-act-idle-badge">
                    <span class="ag-act-idle-dot"></span>
                    <span data-i18n="ready">Готов к работе</span>
                </div>
                <div class="ag-act-idle-spacer" aria-hidden="true">00:00</div>
            </div>
            <div class="ag-act-settings" id="ag-act-settings">
                <div class="ag-act-set-heading" data-i18n="settingsHeading">Настройки панели</div>
                <div class="ag-act-slot">
                    <div class="ag-act-slot-label">
                        <span data-i18n="modeLabel">Вид панели</span>
                    </div>
                    <div class="ag-act-seg">
                        <button class="ag-act-seg-btn" id="ag-act-mode-full" data-i18n="modeFull" type="button">Полный</button>
                        <button class="ag-act-seg-btn" id="ag-act-mode-mini" data-i18n="modeMini" type="button">Компактный</button>
                    </div>
                </div>
                <div class="ag-act-slot">
                    <div class="ag-act-slot-label">
                        <span data-i18n="langLabel">Язык</span>
                    </div>
                    <div class="ag-act-seg">
                        <button class="ag-act-seg-btn" id="ag-act-lang-auto" data-i18n="langAuto" type="button">Авто</button>
                        <button class="ag-act-seg-btn" id="ag-act-lang-en" type="button">EN</button>
                        <button class="ag-act-seg-btn" id="ag-act-lang-ru" type="button">RU</button>
                    </div>
                </div>
                <div class="ag-act-slot" id="ag-act-slot-working">
                    <div class="ag-act-slot-label">
                        <span data-i18n="slotWorking">Во время работы</span>
                        <span class="ag-act-slot-tag" id="ag-act-tag-working"></span>
                    </div>
                    <div class="ag-act-slot-actions">
                        <button class="ag-act-btn" id="ag-act-pick-working" data-i18n="uploadGif" type="button">Загрузить GIF</button>
                        <button class="ag-act-btn reset" id="ag-act-reset-working" data-i18n-title="resetPresetTitle" type="button" title="Вернуть пресет">↺</button>
                    </div>
                </div>
                <div class="ag-act-slot" id="ag-act-slot-idle">
                    <div class="ag-act-slot-label">
                        <span data-i18n="slotIdle">В режиме ожидания</span>
                        <span class="ag-act-slot-tag" id="ag-act-tag-idle"></span>
                    </div>
                    <div class="ag-act-slot-actions">
                        <button class="ag-act-btn" id="ag-act-pick-idle" data-i18n="uploadGif" type="button">Загрузить GIF</button>
                        <button class="ag-act-btn reset" id="ag-act-reset-idle" data-i18n-title="resetPresetTitle" type="button" title="Вернуть пресет">↺</button>
                    </div>
                </div>
                <div class="ag-act-set-note" data-i18n-html="noteHtml">
                    GIF, WebP, PNG, JPG (можно перетащить)<br/>
                    Оптимально: <b>1:1</b>, <b>256–512 px</b>
                </div>
                <div class="ag-act-preset-create">
                    <input class="ag-act-preset-input" id="ag-act-preset-name-input" data-i18n-placeholder="presetPlaceholder" type="text" maxlength="20" placeholder="Название своего пресета…" />
                    <button class="ag-act-btn ag-act-preset-save-btn" id="ag-act-preset-save-btn" data-i18n="presetSave" data-i18n-title="presetSaveTitle" type="button" title="Сохранить текущие анимации как новый пресет">+ Сохранить</button>
                </div>
                <div class="ag-act-preset-list" id="ag-act-preset-list">
                    <div class="ag-act-preset-row">
                        <span class="ag-act-preset-name" data-i18n="presetSpider">Паук</span>
                        <button class="ag-act-preset-box" data-preset="spider" type="button">
                            <img class="ag-act-preset-thumb" data-thumb="spider" alt="" />
                            <span class="ag-act-preset-state">Выбрать</span>
                        </button>
                    </div>
                    <div class="ag-act-preset-row">
                        <span class="ag-act-preset-name" data-i18n="presetCat">Кот</span>
                        <button class="ag-act-preset-box" data-preset="cat" type="button">
                            <img class="ag-act-preset-thumb" data-thumb="cat" alt="" />
                            <span class="ag-act-preset-state">Выбрать</span>
                        </button>
                    </div>
                    <div class="ag-act-preset-row">
                        <span class="ag-act-preset-name" data-i18n="presetSnake">Змея</span>
                        <button class="ag-act-preset-box" data-preset="snake" type="button">
                            <img class="ag-act-preset-thumb" data-thumb="snake" alt="" />
                            <span class="ag-act-preset-state">Выбрать</span>
                        </button>
                    </div>
                    <div class="ag-act-preset-row">
                        <span class="ag-act-preset-name" data-i18n="presetKoi">Карп</span>
                        <button class="ag-act-preset-box" data-preset="koi" type="button">
                            <img class="ag-act-preset-thumb" data-thumb="koi" alt="" />
                            <span class="ag-act-preset-state">Выбрать</span>
                        </button>
                    </div>
                    <div class="ag-act-preset-row">
                        <span class="ag-act-preset-name" data-i18n="presetLobster">Лобстер</span>
                        <button class="ag-act-preset-box" data-preset="lobster" type="button">
                            <img class="ag-act-preset-thumb" data-thumb="lobster" alt="" />
                            <span class="ag-act-preset-state">Выбрать</span>
                        </button>
                    </div>
                    <div id="ag-act-custom-presets-container" style="display:flex;flex-direction:column;gap:7px;"></div>
                </div>
                <button class="ag-act-btn primary ag-act-settings-done-btn" id="ag-act-settings-done" data-i18n="done" type="button">Готово</button>
                <input type="file" id="ag-act-file-working" accept="image/gif,image/webp,image/png,image/jpeg" style="display:none" />
                <input type="file" id="ag-act-file-idle" accept="image/gif,image/webp,image/png,image/jpeg" style="display:none" />
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    const tab = document.createElement('button');
    tab.id = TAB_ID;
    tab.title = 'Открыть панель «Статус агента» (потяните вверх/вниз для перемещения)';
    tab.innerHTML = `
        <span class="ag-act-tab-dot" id="ag-act-tab-dot"></span>
        <span style="font-size:13px;line-height:1;">‹</span>
    `;
    document.body.appendChild(tab);

    // Позиционирование язычка по правой грани с безопасными отступами
    const TAB_H = 56;
    const getTabBounds = () => {
        const vh = window.innerHeight || 720;
        const minTop = 52;
        const maxTop = Math.max(minTop, vh - TAB_H - 12);
        return { vh, minTop, maxTop };
    };
    const applyTabPosition = (explicitTop) => {
        const { vh, minTop, maxTop } = getTabBounds();
        const rawTop = typeof explicitTop === 'number'
            ? explicitTop
            : Math.round(tabYRatio * vh - TAB_H / 2);
        const clampedTop = Math.min(maxTop, Math.max(minTop, rawTop));
        tab.style.top = clampedTop + 'px';
        return clampedTop;
    };
    applyTabPosition();

    const elWorking = document.getElementById('ag-act-view-working');
    const elIdle = document.getElementById('ag-act-view-idle');
    const elDetail = document.getElementById('ag-act-detail');
    const elTimer = document.getElementById('ag-act-timer');
    const elHeaderDot = document.getElementById('ag-act-header-dot');
    const elTabDot = document.getElementById('ag-act-tab-dot');
    const elImgWorking = document.getElementById('ag-act-img-working');
    const elImgIdle = document.getElementById('ag-act-img-idle');
    const collapseBtn = document.getElementById('ag-act-collapse-btn');
    const resizer = document.getElementById('ag-act-resizer');

    // Измеряем точные границы чёрного внутреннего фрейма чата (top, left, right, bottom)
    function findChatFrameMetrics(fallbackTop) {
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 720;
        let frameTop = fallbackTop;
        let frameLeft = 0;
        let frameRightInset = 8;
        let frameBottomInset = 8;
        try {
            const stack = document.elementsFromPoint(Math.round(vw * 0.5), Math.min(vh - 60, fallbackTop + 80)) || [];
            for (const el of stack) {
                if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) continue;
                if (el === panel || panel.contains(el)) continue;
                const r = el.getBoundingClientRect();
                const rightGap = vw - r.right;
                const bottomGap = vh - r.bottom;
                if (r.top >= 60 && r.top <= 105 && r.height > vh * 0.65 && rightGap >= 2 && rightGap <= 24) {
                    frameTop = Math.round(r.top);
                    frameLeft = Math.max(0, Math.round(r.left));
                    frameRightInset = Math.round(rightGap);
                    frameBottomInset = (bottomGap >= 0 && bottomGap <= 24) ? Math.round(bottomGap) : 8;
                    break;
                }
            }
        } catch (e) {}
        return { top: frameTop, left: frameLeft, right: frameRightInset, bottom: frameBottomInset };
    }

    function computeHeaderBottom() {
        let top = 74;
        try {
            const toolbar = document.querySelector('[data-testid="pane-titlebar-toolbar"]');
            if (toolbar) {
                const r = toolbar.getBoundingClientRect();
                if (r.bottom > 40 && r.bottom < 140) {
                    top = Math.floor(r.bottom);
                }
            }
            const topbarCtrl = document.getElementById('antigravity-topbar-controls');
            if (topbarCtrl) {
                const r = topbarCtrl.getBoundingClientRect();
                if (r.bottom > 40 && r.bottom < 140) {
                    top = Math.max(top, Math.floor(r.bottom + 3));
                }
            }
            // Подбираем точный цвет верхней шапки интерфейса для бесшовного стыка
            const headerEl = (toolbar && toolbar.parentElement) || toolbar;
            if (headerEl) {
                let cur = headerEl;
                for (let i = 0; i < 4 && cur && cur !== document.body; i++) {
                    const bg = window.getComputedStyle(cur).backgroundColor;
                    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                        panel.style.setProperty('--ag-shell-bg', bg);
                        break;
                    }
                    cur = cur.parentElement;
                }
            }
        } catch (e) {}
        return top;
    }

    // Точный поиск внешней рамки поля ввода чата (включая кнопку отправки, микрофон и лимиты)
    function findComposerBoxRect() {
        const vh = window.innerHeight || 720;
        const inputs = document.querySelectorAll('textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"]');
        let bestInput = null;
        for (const el of inputs) {
            if (!el || panel.contains(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width >= 150 && r.height >= 16 && r.bottom > vh * 0.55) {
                bestInput = el;
            }
        }
        if (!bestInput) return null;

        const inputRect = bestInput.getBoundingClientRect();
        let box = bestInput;
        let cur = bestInput.parentElement;
        for (let i = 0; i < 10 && cur && cur !== document.body; i++) {
            const r = cur.getBoundingClientRect();
            // Останавливаемся, если вышли за реальную рамку ввода (не захватываем широкую обёртку колонки)
            if (r.height > 260 || r.width > inputRect.width + 140) break;
            const cs = window.getComputedStyle(cur);
            const hasRadius = parseFloat(cs.borderRadius) >= 8;
            const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderRightWidth) > 0;
            if ((hasRadius && hasBorder) && r.width >= inputRect.width && r.height >= 56) {
                box = cur;
            }
            cur = cur.parentElement;
        }
        return box.getBoundingClientRect();
    }

    function isAuxPaneOpen() {
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 720;
        const auxTabs = document.querySelectorAll('.agy-aux-tab');
        for (const t of auxTabs) {
            if (!t || !document.body.contains(t)) continue;
            const cs = window.getComputedStyle(t);
            if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
            const r = t.getBoundingClientRect();
            if (r.width > 12 && r.height > 12 && r.right > 0 && r.left < vw) return true;
        }
        const monacos = document.querySelectorAll('.monaco-editor');
        for (const m of monacos) {
            if (!m || !document.body.contains(m)) continue;
            const cs = window.getComputedStyle(m);
            if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
            const r = m.getBoundingClientRect();
            // Боковой редактор занимает заметную высоту и прижат к правому краю (отсекаем инлайн-блоки кода/diff в чате)
            if (r.width > 180 && r.height > vh * 0.42 && r.left > vw * 0.30 && r.right >= vw - 360) return true;
        }
        return false;
    }

    function findRightContentContainer(panelTop, probeOffsetW) {
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 720;
        const minHeight = Math.max(200, (vh - panelTop) * 0.7);
        const probeX = Math.max(40, vw - Math.max(probeOffsetW, 180) - 40);
        const probeY = Math.min(vh - 40, panelTop + 120);

        let stack = [];
        try {
            stack = document.elementsFromPoint(probeX, probeY) || [];
        } catch (e) {}

        let best = null;
        for (const el of stack) {
            if (!el || el.nodeType !== 1) continue;
            if (el === document.body || el === document.documentElement) continue;
            if (el.id === PANEL_ID || el.id === TAB_ID || el.id === 'antigravity-topbar-controls') continue;
            if (panel.contains(el)) continue;

            const r = el.getBoundingClientRect();
            if (r.top >= panelTop - 6 && r.right >= vw - 8 && r.height >= minHeight && r.width >= 260) {
                best = el;
            }
        }
        return best;
    }

    let lastAppliedWidth = -1;
    let lastAppliedTarget = null;
    let lastAppliedTop = -1;
    let isDispatchingResize = false;

    // Оверлей ползунка скроллбара поверх правого края компактного окна (z-index: 45 > панели 40)
    const scrollOverlay = document.createElement('div');
    scrollOverlay.id = 'ag-act-scroll-overlay';
    scrollOverlay.innerHTML = '<div id="ag-act-scroll-thumb"></div>';
    document.body.appendChild(scrollOverlay);
    const scrollThumb = document.getElementById('ag-act-scroll-thumb');

    let trackedScrollEl = null;
    let overlayScrollEl = null;
    let isThumbDragging = false;
    let dragScrollEl = null;
    let thumbDragStartY = 0;
    let thumbDragStartScrollTop = 0;

    function isElementVisible(el) {
        if (!el || !document.body.contains(el)) return false;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function isScrollableCandidate(el) {
        if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return false;
        if (el === panel || panel.contains(el) || el === scrollOverlay || el === tab) return false;
        if (!document.body.contains(el)) return false;
        if (el.scrollHeight <= el.clientHeight + 2) return false;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
        const oy = cs.overflowY;
        if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;
        const r = el.getBoundingClientRect();
        return r.width >= 180 && r.height >= 140;
    }

    function isColumnReverseScroll(el) {
        try {
            if (el.scrollTop < 0) return true;
            const cs = window.getComputedStyle(el);
            return cs.flexDirection === 'column-reverse';
        } catch (e) {
            return false;
        }
    }

    function getScrollRatio(el) {
        const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
        if (isColumnReverseScroll(el)) {
            // В Chromium у column-reverse: 0 внизу, -maxScroll наверху
            return Math.max(0, Math.min(1, (maxScroll + el.scrollTop) / maxScroll));
        }
        return Math.max(0, Math.min(1, el.scrollTop / maxScroll));
    }

    function setScrollByRatio(el, ratio) {
        const clamped = Math.max(0, Math.min(1, ratio));
        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        if (isColumnReverseScroll(el)) {
            el.scrollTop = -Math.round((1 - clamped) * maxScroll);
        } else {
            el.scrollTop = Math.round(clamped * maxScroll);
        }
    }

    function doesScrollCoverMiniCard(el, pRect) {
        const r = el.getBoundingClientRect();
        return (
            r.top < pRect.bottom &&
            r.bottom > pRect.top &&
            r.right >= pRect.left + 16 &&
            r.right <= pRect.right + 28
        );
    }

    function isScrollElForeground(el) {
        try {
            const r = el.getBoundingClientRect();
            const vw = window.innerWidth || 1280;
            const vh = window.innerHeight || 720;
            const px = Math.max(10, Math.min(vw - 10, Math.round(r.left + Math.min(r.width * 0.45, 260))));
            const py = Math.max(10, Math.min(vh - 10, Math.round(r.top + r.height * 0.5)));
            const stack = document.elementsFromPoint(px, py) || [];
            return stack.includes(el);
        } catch (e) {
            return true;
        }
    }

    function findAllChatScrollElements() {
        const raw = [];
        const nodes = document.querySelectorAll('div, main, section, ul, ol, article');
        for (const el of nodes) {
            if (isScrollableCandidate(el)) raw.push(el);
        }
        return raw;
    }

    function findChatScrollElement() {
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 720;
        const pRect = panel.getBoundingClientRect();
        const isMini = panelMode === 'mini';

        // 1. В первую очередь доверяем последнему реально скроллившемуся контейнеру,
        //    если он всё ещё на переднем плане (а не спрятан за другим чатом)
        if (trackedScrollEl && isScrollableCandidate(trackedScrollEl) && isScrollElForeground(trackedScrollEl)) {
            if (!isMini || doesScrollCoverMiniCard(trackedScrollEl, pRect)) {
                return trackedScrollEl;
            }
        }

        // 2. Точечные пробы через elementsFromPoint:
        //    в mini-режиме зондируем прямо под правым краем карточки (где виден нативный скроллбар),
        //    в full-режиме — по центру и правому краю видимого чата
        const chatRight = (!panel.classList.contains('collapsed') && !isMini && pRect.left > 200)
            ? pRect.left
            : vw;
        const probePoints = isMini
            ? [
                [Math.max(40, Math.round(pRect.right - 20)), Math.min(vh - 20, Math.round(pRect.bottom + 36))],
                [Math.max(40, Math.round(pRect.right - 20)), Math.min(vh - 20, Math.round(pRect.bottom + 140))],
                [Math.max(120, Math.round(pRect.left - 80)), Math.round(vh * 0.5)]
            ]
            : [
                [Math.max(220, Math.round(chatRight * 0.55)), Math.round(vh * 0.45)],
                [Math.max(220, Math.round(chatRight - 40)), Math.round(vh * 0.55)],
                [Math.max(220, Math.round(chatRight * 0.55)), Math.round(vh * 0.68)]
            ];

        let bestProbe = null;
        let bestProbeScore = -Infinity;
        for (const [px, py] of probePoints) {
            if (px < 0 || px >= vw || py < 0 || py >= vh) continue;
            let stack = [];
            try { stack = document.elementsFromPoint(px, py) || []; } catch (e) {}
            for (const el of stack) {
                if (!isScrollableCandidate(el)) continue;
                const r = el.getBoundingClientRect();
                if (isMini && !doesScrollCoverMiniCard(el, pRect)) continue;
                const rightDist = Math.abs(r.right - pRect.right);
                const score = (isMini ? (1000 - rightDist * 20) : 0) + r.height * 2 + Math.min(2000, el.scrollHeight - el.clientHeight);
                if (score > bestProbeScore) {
                    bestProbeScore = score;
                    bestProbe = el;
                }
            }
            if (bestProbe) break;
        }
        if (bestProbe) {
            trackedScrollEl = bestProbe;
            return bestProbe;
        }

        // 3. Фоллбэк: сканируем все видимые скролл-контейнеры (не выбрасывая вложенные!)
        const all = findAllChatScrollElements();
        let best = null;
        let bestScore = -Infinity;
        for (const el of all) {
            const r = el.getBoundingClientRect();
            if (isMini && !doesScrollCoverMiniCard(el, pRect)) continue;
            if (!isMini && r.right < vw * 0.5) continue;
            const rightDist = Math.abs(r.right - pRect.right);
            const score = (isMini ? (1000 - rightDist * 20) : 0) + r.height * 2 + r.width + Math.min(2000, el.scrollHeight - el.clientHeight);
            if (score > bestScore) {
                bestScore = score;
                best = el;
            }
        }
        if (best) trackedScrollEl = best;
        return best;
    }

    // Перехватываем событие scroll в фазе capture на window — мгновенно и безошибочно
    // узнаём реальный скролл-контейнер в ЛЮБОМ чате (включая старые и свежеоткрытые)
    const onGlobalScrollCapture = (ev) => {
        const el = (ev && typeof ev.composedPath === 'function' && ev.composedPath()[0]) || (ev && ev.target);
        if (!isScrollableCandidate(el)) return;
        const pRect = panel.getBoundingClientRect();
        if (panelMode === 'mini' && !doesScrollCoverMiniCard(el, pRect)) return;
        const changed = trackedScrollEl !== el;
        trackedScrollEl = el;
        if (changed) scheduleSync(false);
        updateScrollOverlay(el);
    };
    window.addEventListener('scroll', onGlobalScrollCapture, true);

    function hideScrollOverlay() {
        scrollOverlay.classList.remove('active', 'mode-full-track', 'mode-mini-clip');
        overlayScrollEl = null;
    }

    function updateScrollOverlay(explicitEl) {
        try {
            if (panel.classList.contains('collapsed')) {
                hideScrollOverlay();
                return;
            }
            if (panelMode === 'full' && isAuxPaneOpen()) {
                hideScrollOverlay();
                return;
            }
            const el = (explicitEl && isScrollableCandidate(explicitEl)) ? explicitEl : findChatScrollElement();
            if (!el) {
                hideScrollOverlay();
                return;
            }
            const r = el.getBoundingClientRect();
            const pRect = panel.getBoundingClientRect();
            const maxScroll = el.scrollHeight - el.clientHeight;
            if (maxScroll <= 1 || r.height < 60) {
                hideScrollOverlay();
                return;
            }

            const trackH = r.height;
            const thumbH = Math.max(28, Math.round((el.clientHeight / el.scrollHeight) * trackH));
            const ratio = getScrollRatio(el);
            const thumbTop = Math.round(ratio * (trackH - thumbH));
            const thumbAbsTop = r.top + thumbTop;
            const thumbAbsBottom = thumbAbsTop + thumbH;

            overlayScrollEl = el;

            if (panelMode === 'full') {
                // В полном режиме: рисуем интерактивный скроллбар ровно слева от панели «Статус агента»
                scrollOverlay.classList.remove('mode-mini-clip');
                scrollOverlay.classList.add('active', 'mode-full-track');
                scrollOverlay.style.top = Math.round(r.top) + 'px';
                scrollOverlay.style.left = Math.round(pRect.left - 11) + 'px';
                scrollOverlay.style.height = Math.round(trackH) + 'px';
                scrollThumb.style.top = thumbTop + 'px';
                scrollThumb.style.height = thumbH + 'px';
                scrollThumb.style.opacity = '1';
            } else {
                // В компактном режиме: как только ползунок касается зоны карточки (включая 14px скругления),
                // рисуем его ЦЕЛИКОМ поверх нативного (непрозрачным #353536, пиксель в пиксель),
                // чтобы при наведении на карточку нижняя часть ползунка не пропадала и не обрывалась.
                const cardZoneBottom = pRect.bottom + 15;
                if (thumbAbsTop < cardZoneBottom && thumbAbsBottom > pRect.top) {
                    const edgeRight = Math.round(Math.min(r.right, pRect.right));
                    scrollOverlay.classList.remove('mode-full-track');
                    scrollOverlay.classList.add('active', 'mode-mini-clip');
                    scrollOverlay.style.top = Math.round(r.top) + 'px';
                    scrollOverlay.style.left = (edgeRight - 9) + 'px';
                    scrollOverlay.style.height = Math.round(trackH) + 'px';
                    scrollThumb.style.top = thumbTop + 'px';
                    scrollThumb.style.height = thumbH + 'px';
                    scrollThumb.style.opacity = '1';
                } else {
                    hideScrollOverlay();
                }
            }
        } catch (e) {}
    }

    // Клик по треку скроллбара в полном режиме — мгновенный переход в нужное место чата
    scrollOverlay.addEventListener('mousedown', (ev) => {
        if (ev.target === scrollThumb) return;
        const el = overlayScrollEl || trackedScrollEl || findChatScrollElement();
        if (!el) return;
        ev.preventDefault();
        ev.stopPropagation();
        const r = el.getBoundingClientRect();
        const thumbH = Math.max(28, Math.round((el.clientHeight / el.scrollHeight) * r.height));
        const usableTrack = Math.max(1, r.height - thumbH);
        const clickY = ev.clientY - r.top - thumbH / 2;
        setScrollByRatio(el, clickY / usableTrack);
        updateScrollOverlay(el);
    });

    scrollThumb.addEventListener('mousedown', (ev) => {
        const el = overlayScrollEl || trackedScrollEl || findChatScrollElement();
        if (!el) return;
        ev.preventDefault();
        ev.stopPropagation();
        isThumbDragging = true;
        dragScrollEl = el;
        trackedScrollEl = el;
        thumbDragStartY = ev.clientY;
        thumbDragStartScrollTop = el.scrollTop;
        scrollThumb.classList.add('dragging');
    });
    const onThumbMove = (ev) => {
        if (!isThumbDragging || !dragScrollEl) return;
        const el = dragScrollEl;
        const r = el.getBoundingClientRect();
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= 0 || r.height <= 0) return;
        const thumbH = Math.max(28, Math.round((el.clientHeight / el.scrollHeight) * r.height));
        const usableTrack = Math.max(1, r.height - thumbH);
        const deltaY = ev.clientY - thumbDragStartY;
        const deltaScroll = (deltaY / usableTrack) * maxScroll;
        if (isColumnReverseScroll(el)) {
            el.scrollTop = Math.max(-maxScroll, Math.min(0, thumbDragStartScrollTop + deltaScroll));
        } else {
            el.scrollTop = Math.max(0, Math.min(maxScroll, thumbDragStartScrollTop + deltaScroll));
        }
        updateScrollOverlay(el);
    };
    const onThumbUp = () => {
        if (!isThumbDragging) return;
        const el = dragScrollEl;
        isThumbDragging = false;
        dragScrollEl = null;
        scrollThumb.classList.remove('dragging');
        if (el) updateScrollOverlay(el);
    };
    window.addEventListener('mousemove', onThumbMove);
    window.addEventListener('mouseup', onThumbUp);

    // В полном режиме разрешаем скроллить чат колёсиком мыши, когда курсор над панелью «Статус агента»
    // (в компактном режиме оставляем без проброса, как понравилось пользователю)
    panel.addEventListener('wheel', (ev) => {
        if (panelMode !== 'full') return;
        if (panel.classList.contains('settings-open')) return;
        const el = overlayScrollEl || trackedScrollEl || findChatScrollElement();
        if (!el) return;
        let dy = ev.deltaY || 0;
        if (ev.deltaMode === 1) dy *= 40;
        else if (ev.deltaMode === 2) dy *= el.clientHeight;
        if (dy === 0) return;
        ev.preventDefault();
        el.scrollTop += dy;
        updateScrollOverlay(el);
    }, { passive: false });

    function syncChatScrollbarOffset() {
        updateScrollOverlay();
    }

    function syncLayout(forceResizeEvent) {
        try {
            const vw = window.innerWidth || 1280;
            const panelTop = computeHeaderBottom();
            if (panelTop !== lastAppliedTop) {
                panel.style.top = panelTop + 'px';
                lastAppliedTop = panelTop;
            }

            if (userCollapsed) {
                autoHidden = false;
                panel.classList.add('collapsed');
                tab.classList.remove('hidden');
                releaseLayoutReservation();
                hideScrollOverlay();
                if ((forceResizeEvent || lastAppliedWidth !== 0) && !isDispatchingResize) {
                    lastAppliedWidth = 0;
                    lastAppliedTarget = null;
                    isDispatchingResize = true;
                    requestAnimationFrame(() => {
                        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
                        isDispatchingResize = false;
                    });
                }
                return;
            }

            const minNeeded = autoHidden ? MIN_PANEL_SHOW_W : MIN_PANEL_HIDE_W;
            const auxOpen = isAuxPaneOpen();
            let effectiveW = 0;

            panel.classList.toggle('mode-mini', panelMode === 'mini');

            const metrics = findChatFrameMetrics(panelTop);
            panel.style.top = metrics.top + 'px';
            panel.style.right = metrics.right + 'px';
            lastAppliedTop = metrics.top;

            if (panelMode === 'mini') {
                // Компактный режим: совмещаем верхнюю и правую линии точно с чёрным фреймом чата
                releaseLayoutReservation();
                panel.style.bottom = 'auto';

                const maxMiniW = Math.min(400, Math.max(170, Math.round(vw * 0.34)));
                const clampedMiniW = Math.min(miniWidth, maxMiniW);
                const clampedMiniH = Math.min(miniHeight, Math.max(180, window.innerHeight - metrics.top - 24));
                if (vw >= 900) {
                    effectiveW = clampedMiniW;
                    autoHidden = false;
                    panel.style.height = clampedMiniH + 'px';
                    const ringSize = Math.max(72, Math.min(220, Math.round(Math.min(clampedMiniW * 0.60, (clampedMiniH - 118) * 0.86))));
                    panel.style.setProperty('--ag-mini-ring', ringSize + 'px');
                } else {
                    effectiveW = 0;
                    autoHidden = true;
                }
            } else {
                // Полный режим: выравниваем верхнюю, нижнюю и правую грани точно по чёрному фрейму чата
                panel.style.removeProperty('height');
                panel.style.bottom = metrics.bottom + 'px';

                if (auxOpen) {
                    // Когда открыт файл справа: оставляем достаточно места файлу и сворачиваемся, если окно тесное
                    const maxForAux = Math.round(vw * 0.22);
                    const candidateW = Math.min(savedWidth, maxForAux);
                    if (vw >= 1120 && candidateW >= minNeeded) {
                        effectiveW = candidateW;
                        autoHidden = false;
                    } else {
                        effectiveW = 0;
                        autoHidden = true;
                    }

                    const target = effectiveW > 0 ? findRightContentContainer(metrics.top, effectiveW) : null;
                    if (reservedTarget && reservedTarget !== target) {
                        releaseLayoutReservation();
                    }
                    if (target && effectiveW > 0) {
                        reservedTarget = target;
                        target.setAttribute('data-ag-act-reserved', '1');
                        target.style.setProperty('padding-right', `${effectiveW}px`, 'important');
                        target.style.setProperty('box-sizing', 'border-box', 'important');
                    } else {
                        releaseLayoutReservation();
                    }
                } else {
                    // Когда открыт только чат в полном виде:
                    // НЕ сжимаем и НЕ двигаем скролл-контейнер чата — чат остаётся идеально по центру над полем ввода
                    // и никогда не сползает при переключении режимов, а скроллбар рисуется слева от панели!
                    releaseLayoutReservation();
                    const chatFrameW = vw - metrics.left - metrics.right;
                    const maxSafeW = Math.floor(chatFrameW - 720);
                    if (maxSafeW >= minNeeded) {
                        effectiveW = Math.min(savedWidth, maxSafeW);
                        autoHidden = false;
                    } else {
                        effectiveW = 0;
                        autoHidden = true;
                    }
                }
            }

            const isHiddenNow = effectiveW <= 0;
            panel.classList.toggle('collapsed', isHiddenNow);
            panel.classList.toggle('compact', effectiveW > 0 && effectiveW < 220);
            tab.classList.toggle('hidden', !isHiddenNow);
            if (effectiveW > 0) {
                panel.style.width = effectiveW + 'px';
            }

            // В компактном режиме ограничиваем верхнюю границу скроллбара чата, чтобы он не заезжал под окно агента
            if (!isHiddenNow && panelMode === 'mini' && !auxOpen) {
                const miniCardH = panel.offsetHeight || miniHeight;
                syncChatScrollbarOffset(miniCardH + 16);
            } else {
                syncChatScrollbarOffset(0);
            }

            const curTarget = reservedTarget;
            if ((forceResizeEvent || lastAppliedWidth !== effectiveW || lastAppliedTarget !== curTarget) && !isDispatchingResize) {
                lastAppliedWidth = effectiveW;
                lastAppliedTarget = curTarget;
                isDispatchingResize = true;
                requestAnimationFrame(() => {
                    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
                    isDispatchingResize = false;
                });
            }
        } catch (e) {}
    }

    function scheduleSync(forceResizeEvent) {
        if (syncRaf) return;
        syncRaf = requestAnimationFrame(() => {
            syncRaf = 0;
            window.__ag_activity_panel_raf = 0;
            syncLayout(!!forceResizeEvent);
        });
        window.__ag_activity_panel_raf = syncRaf;
    }

    syncLayout(true);

    // Мгновенная реакция (<16мс) на открытие/закрытие файлов и вкладок
    try {
        layoutMo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.target && (m.target === panel || panel.contains(m.target) || m.target === tab || m.target === scrollOverlay)) continue;
                if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
                    scheduleSync(false);
                    break;
                }
            }
        });
        window.__ag_activity_panel_mo = layoutMo;
        layoutMo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}

    const setCollapsed = (next) => {
        userCollapsed = !!next;
        try {
            localStorage.setItem(STORAGE_COLLAPSED_KEY, userCollapsed ? '1' : '0');
        } catch (e) {}
        savePrefsToServer({ userCollapsed });
        syncLayout(true);
    };

    collapseBtn.addEventListener('click', () => setCollapsed(true));

    // Перетаскивание язычка по правой грани (клик открывает панель, протяжка >= 4px перемещает)
    let isTabPointerDown = false;
    let tabWasDragged = false;
    let suppressNextTabClick = false;
    let tabDragStartY = 0;
    let tabDragStartTop = 0;

    tab.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0) return;
        isTabPointerDown = true;
        tabWasDragged = false;
        tabDragStartY = ev.clientY;
        tabDragStartTop = tab.getBoundingClientRect().top;
    });

    tab.addEventListener('click', (ev) => {
        if (suppressNextTabClick) {
            suppressNextTabClick = false;
            ev.preventDefault();
            ev.stopPropagation();
            return;
        }
        setCollapsed(false);
    });

    const cornerResizer = document.getElementById('ag-act-corner-resizer');

    // Изменение размера панели (левый край в полном режиме / нижний левый угол в компактном) и перетаскивание язычка
    let isResizing = false;
    let isMiniResizing = false;
    const onMouseMove = (ev) => {
        if (isTabPointerDown) {
            const dy = ev.clientY - tabDragStartY;
            if (!tabWasDragged && Math.abs(dy) >= 4) {
                tabWasDragged = true;
                tab.classList.add('dragging');
                document.body.style.cursor = 'ns-resize';
            }
            if (tabWasDragged) {
                const clampedTop = applyTabPosition(Math.round(tabDragStartTop + dy));
                const vh = window.innerHeight || 720;
                tabYRatio = Math.min(1, Math.max(0, (clampedTop + TAB_H / 2) / vh));
            }
            return;
        }
        if (isMiniResizing) {
            const vw = window.innerWidth || 1280;
            const vh = window.innerHeight || 720;
            const pTop = parseFloat(panel.style.top) || 76;
            const pRight = parseFloat(panel.style.right) || 0;
            const nextW = Math.min(400, Math.max(170, Math.round(vw - pRight - ev.clientX)));
            const nextH = Math.min(Math.min(440, vh - pTop - 24), Math.max(180, Math.round(ev.clientY - pTop)));
            miniWidth = nextW;
            miniHeight = nextH;
            panel.style.width = nextW + 'px';
            panel.style.height = nextH + 'px';
            const ringSize = Math.max(72, Math.min(220, Math.round(Math.min(nextW * 0.60, (nextH - 118) * 0.86))));
            panel.style.setProperty('--ag-mini-ring', ringSize + 'px');
            syncChatScrollbarOffset(nextH + 16);
            return;
        }
        if (!isResizing) return;
        const vw = window.innerWidth || 1280;
        const pRight = parseFloat(panel.style.right) || 0;
        let maxDrag = Math.min(760, Math.max(200, Math.round(vw * 0.48)));
        if (!isAuxPaneOpen()) {
            const cRect = findComposerBoxRect();
            if (cRect) {
                const limitByComposer = Math.floor(vw - pRight - cRect.right - COMPOSER_GAP);
                if (limitByComposer >= 190) {
                    maxDrag = Math.min(maxDrag, limitByComposer);
                }
            }
        }
        const nextW = Math.min(maxDrag, Math.max(190, Math.round(vw - pRight - ev.clientX)));
        savedWidth = nextW;
        panel.style.width = nextW + 'px';
        syncLayout(true);
    };
    const onMouseUp = () => {
        if (isTabPointerDown) {
            isTabPointerDown = false;
            if (tabWasDragged) {
                tab.classList.remove('dragging');
                document.body.style.cursor = '';
                suppressNextTabClick = true;
                setTimeout(() => { suppressNextTabClick = false; }, 100);
                try {
                    localStorage.setItem(STORAGE_TAB_Y_KEY, tabYRatio.toFixed(4));
                } catch (e) {}
                savePrefsToServer({ tabYRatio: Number(tabYRatio.toFixed(4)) });
            }
            tabWasDragged = false;
            return;
        }
        if (isMiniResizing) {
            isMiniResizing = false;
            if (cornerResizer) cornerResizer.classList.remove('dragging');
            document.body.style.cursor = '';
            try {
                localStorage.setItem(STORAGE_MINI_W_KEY, String(miniWidth));
                localStorage.setItem(STORAGE_MINI_H_KEY, String(miniHeight));
            } catch (e) {}
            savePrefsToServer({ miniWidth, miniHeight });
            return;
        }
        if (!isResizing) return;
        isResizing = false;
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        try {
            localStorage.setItem(STORAGE_WIDTH_KEY, String(savedWidth));
        } catch (e) {}
        savePrefsToServer({ savedWidth });
        syncLayout(true);
    };
    resizer.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        isResizing = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'ew-resize';
    });
    if (cornerResizer) {
        cornerResizer.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            isMiniResizing = true;
            cornerResizer.classList.add('dragging');
            document.body.style.cursor = 'nesw-resize';
        });
    }
    const onWindowResize = () => {
        applyTabPosition();
        if (!isDispatchingResize) scheduleSync(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);

    // Конвертация ArrayBuffer -> base64 data URI (работает под любым CSP и в isolated preload world)
    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;
        const chunks = [];
        for (let i = 0; i < bytes.length; i += chunkSize) {
            chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
        }
        return btoa(chunks.join(''));
    }

    // IndexedDB для хранения пользовательских GIF/анимаций (поддерживает большие файлы без лимита localStorage)
    const IDB_NAME = 'ag_activity_custom_assets_v1';
    const IDB_STORE = 'slots';
    function openAssetsDb() {
        return new Promise((resolve, reject) => {
            try {
                const req = indexedDB.open(IDB_NAME, 1);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        db.createObjectStore(IDB_STORE);
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) {
                reject(e);
            }
        });
    }
    async function idbGetSlot(slot) {
        try {
            const db = await openAssetsDb();
            return await new Promise((resolve) => {
                const tx = db.transaction(IDB_STORE, 'readonly');
                const req = tx.objectStore(IDB_STORE).get(slot);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }
    async function idbSetSlot(slot, record) {
        try {
            const db = await openAssetsDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                tx.objectStore(IDB_STORE).put(record, slot);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {}
    }
    async function idbDeleteSlot(slot) {
        try {
            const db = await openAssetsDb();
            await new Promise((resolve) => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                tx.objectStore(IDB_STORE).delete(slot);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        } catch (e) {}
    }

    const settingsBtn = document.getElementById('ag-act-settings-btn');
    const settingsPane = document.getElementById('ag-act-settings');
    const settingsDoneBtn = document.getElementById('ag-act-settings-done');
    const modeFullBtn = document.getElementById('ag-act-mode-full');
    const modeMiniBtn = document.getElementById('ag-act-mode-mini');
    const langAutoBtn = document.getElementById('ag-act-lang-auto');
    const langEnBtn = document.getElementById('ag-act-lang-en');
    const langRuBtn = document.getElementById('ag-act-lang-ru');
    const slotWorkingEl = document.getElementById('ag-act-slot-working');
    const slotIdleEl = document.getElementById('ag-act-slot-idle');
    const tagWorkingEl = document.getElementById('ag-act-tag-working');
    const tagIdleEl = document.getElementById('ag-act-tag-idle');
    const pickWorkingBtn = document.getElementById('ag-act-pick-working');
    const pickIdleBtn = document.getElementById('ag-act-pick-idle');
    const resetWorkingBtn = document.getElementById('ag-act-reset-working');
    const resetIdleBtn = document.getElementById('ag-act-reset-idle');
    const fileWorkingInput = document.getElementById('ag-act-file-working');
    const fileIdleInput = document.getElementById('ag-act-file-idle');

    const updateLangButtons = () => {
        if (langAutoBtn) langAutoBtn.classList.toggle('active', langMode === 'auto');
        if (langEnBtn) langEnBtn.classList.toggle('active', langMode === 'en');
        if (langRuBtn) langRuBtn.classList.toggle('active', langMode === 'ru');
    };

    const applyTranslations = () => {
        panel.querySelectorAll('[data-i18n]').forEach((el) => {
            const k = el.getAttribute('data-i18n');
            if (k) el.textContent = t(k);
        });
        panel.querySelectorAll('[data-i18n-html]').forEach((el) => {
            const k = el.getAttribute('data-i18n-html');
            if (k) el.innerHTML = t(k);
        });
        panel.querySelectorAll('[data-i18n-title]').forEach((el) => {
            const k = el.getAttribute('data-i18n-title');
            if (k) el.title = t(k);
        });
        panel.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const k = el.getAttribute('data-i18n-placeholder');
            if (k) el.placeholder = t(k);
        });
        tab.title = t('tabTitle');
        if (tagWorkingEl && tagWorkingEl.dataset.tagKey) {
            tagWorkingEl.textContent = t(tagWorkingEl.dataset.tagKey);
        }
        if (tagIdleEl && tagIdleEl.dataset.tagKey) {
            tagIdleEl.textContent = t(tagIdleEl.dataset.tagKey);
        }
        panel.querySelectorAll('.ag-act-preset-del').forEach((btn) => {
            const nm = btn.getAttribute('data-preset-name') || '';
            btn.title = nm ? `${t('deletePresetTitle')} «${nm}»` : t('deletePresetTitle');
        });
        updateLangButtons();
        updatePresetThemeAndUI();
        renderStatus();
    };

    const setLangMode = (nextLang, persist) => {
        langMode = (nextLang === 'en' || nextLang === 'ru') ? nextLang : 'auto';
        effectiveLang = langMode === 'auto' ? detectAppLanguage() : langMode;
        if (persist !== false) {
            try { localStorage.setItem(STORAGE_LANG_KEY, langMode); } catch (e) {}
            savePrefsToServer({ langMode });
        }
        applyTranslations();
    };

    const refreshAutoLanguage = () => {
        if (langMode !== 'auto') return;
        const detected = detectAppLanguage();
        if (detected !== effectiveLang) {
            effectiveLang = detected;
            applyTranslations();
        }
    };

    if (langAutoBtn) langAutoBtn.addEventListener('click', () => setLangMode('auto', true));
    if (langEnBtn) langEnBtn.addEventListener('click', () => setLangMode('en', true));
    if (langRuBtn) langRuBtn.addEventListener('click', () => setLangMode('ru', true));

    const updateModeButtons = () => {
        if (modeFullBtn) modeFullBtn.classList.toggle('active', panelMode === 'full');
        if (modeMiniBtn) modeMiniBtn.classList.toggle('active', panelMode === 'mini');
    };
    const setPanelMode = (nextMode) => {
        panelMode = nextMode === 'mini' ? 'mini' : 'full';
        try {
            localStorage.setItem(STORAGE_MODE_KEY, panelMode);
        } catch (e) {}
        savePrefsToServer({ panelMode });
        updateModeButtons();
        syncLayout(true);
    };
    updateModeButtons();
    if (modeFullBtn) modeFullBtn.addEventListener('click', () => setPanelMode('full'));
    if (modeMiniBtn) modeMiniBtn.addEventListener('click', () => setPanelMode('mini'));

    const toggleSettings = (force) => {
        const next = typeof force === 'boolean' ? force : !settingsPane.classList.contains('open');
        settingsPane.classList.toggle('open', next);
        settingsBtn.classList.toggle('active', next);
        panel.classList.toggle('settings-open', next);
        if (next) loadPresetThumbnails();
        requestAnimationFrame(() => syncLayout(false));
    };
    settingsBtn.addEventListener('click', () => toggleSettings());
    settingsDoneBtn.addEventListener('click', () => toggleSettings(false));

    function setImgSrc(imgEl, dataUri) {
        imgEl.onload = () => imgEl.classList.add('loaded');
        imgEl.src = dataUri;
        if (imgEl.complete && imgEl.naturalWidth > 0) {
            imgEl.classList.add('loaded');
        }
    }

    function setSlotTag(slot, tagKey) {
        const el = slot === 'working' ? tagWorkingEl : tagIdleEl;
        if (!el) return;
        if (!tagKey) {
            el.dataset.tagKey = '';
            el.textContent = '';
            return;
        }
        el.dataset.tagKey = tagKey;
        el.textContent = t(tagKey);
    }

    async function applyCustomFile(slot, file) {
        if (!file || !file.type || !file.type.startsWith('image/')) return;
        const imgEl = slot === 'working' ? elImgWorking : elImgIdle;
        setSlotTag(slot, 'tagLoading');
        try {
            const buf = await file.arrayBuffer();
            const mime = file.type || 'image/gif';
            const dataUri = `data:${mime};base64,` + arrayBufferToBase64(buf);
            setImgSrc(imgEl, dataUri);
            await idbSetSlot(slot, { dataUri, name: file.name || 'custom' });
            setSlotTag(slot, 'tagCustom');
        } catch (e) {
            setSlotTag(slot, 'tagError');
        }
    }

    async function fetchFromAnyServer(endpoint, options) {
        const order = [activeBaseUrl, ...BASE_URLS.filter((u) => u !== activeBaseUrl)];
        for (const base of order) {
            try {
                const resp = await fetch(base + endpoint, Object.assign({ cache: 'no-store' }, options || {}));
                if (resp.ok) {
                    activeBaseUrl = base;
                    return resp;
                }
            } catch (e) {}
        }
        throw new Error('Activity server unavailable');
    }

    function savePrefsToServer(patch) {
        try {
            fetchFromAnyServer('/activity-prefs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch)
            }).catch(() => {});
        } catch (e) {}
    }

    let prefsHydrated = false;
    async function hydratePrefsFromServer() {
        if (prefsHydrated) return;
        try {
            const resp = await fetchFromAnyServer('/activity-prefs');
            const prefs = await resp.json();
            prefsHydrated = true;
            if (!prefs || typeof prefs !== 'object') return;

            let layoutChanged = false;
            if (Array.isArray(prefs.customPresets)) {
                customPresets = prefs.customPresets.filter((p) => p && typeof p.id === 'string' && p.id.startsWith('custom-') && typeof p.name === 'string' && p.name.trim());
                saveCustomPresetsMeta();
            }
            if (typeof prefs.activePreset === 'string' && isValidPresetId(prefs.activePreset)) {
                activePreset = prefs.activePreset;
                try { localStorage.setItem(STORAGE_PRESET_KEY, activePreset); } catch (e) {}
            }
            if (prefs.panelMode === 'mini' || prefs.panelMode === 'full') {
                if (panelMode !== prefs.panelMode) layoutChanged = true;
                panelMode = prefs.panelMode;
                try { localStorage.setItem(STORAGE_MODE_KEY, panelMode); } catch (e) {}
                updateModeButtons();
            }
            if (typeof prefs.savedWidth === 'number' && prefs.savedWidth >= 190 && prefs.savedWidth <= 760) {
                if (savedWidth !== prefs.savedWidth) layoutChanged = true;
                savedWidth = prefs.savedWidth;
                try { localStorage.setItem(STORAGE_WIDTH_KEY, String(savedWidth)); } catch (e) {}
            }
            if (typeof prefs.miniWidth === 'number' && prefs.miniWidth >= 170 && prefs.miniWidth <= 400) {
                if (miniWidth !== prefs.miniWidth) layoutChanged = true;
                miniWidth = prefs.miniWidth;
                try { localStorage.setItem(STORAGE_MINI_W_KEY, String(miniWidth)); } catch (e) {}
            }
            if (typeof prefs.miniHeight === 'number' && prefs.miniHeight >= 180 && prefs.miniHeight <= 440) {
                if (miniHeight !== prefs.miniHeight) layoutChanged = true;
                miniHeight = prefs.miniHeight;
                try { localStorage.setItem(STORAGE_MINI_H_KEY, String(miniHeight)); } catch (e) {}
            }
            if (typeof prefs.userCollapsed === 'boolean') {
                if (userCollapsed !== prefs.userCollapsed) layoutChanged = true;
                userCollapsed = prefs.userCollapsed;
                try { localStorage.setItem(STORAGE_COLLAPSED_KEY, userCollapsed ? '1' : '0'); } catch (e) {}
            }
            if (typeof prefs.tabYRatio === 'number' && prefs.tabYRatio >= 0 && prefs.tabYRatio <= 1) {
                tabYRatio = prefs.tabYRatio;
                try { localStorage.setItem(STORAGE_TAB_Y_KEY, tabYRatio.toFixed(4)); } catch (e) {}
                applyTabPosition();
            }
            if (prefs.langMode === 'auto' || prefs.langMode === 'en' || prefs.langMode === 'ru') {
                langMode = prefs.langMode;
                effectiveLang = langMode === 'auto' ? detectAppLanguage() : langMode;
                try { localStorage.setItem(STORAGE_LANG_KEY, langMode); } catch (e) {}
            }
            renderCustomPresetsList();
            applyTranslations();
            if (layoutChanged) syncLayout(true);
        } catch (e) {
            // Сервер ещё запускается — повторим при следующей попытке ensureAssetsLoaded
        }
    }

    const presetDataCache = new Map();
    let thumbsLoaded = false;

    function updatePresetThemeAndUI() {
        const isBlue = activePreset === 'blue-lobster';
        panel.classList.toggle('theme-blue-lobster', isBlue);
        tab.classList.toggle('theme-blue-lobster', isBlue);
        const boxes = panel.querySelectorAll('.ag-act-preset-box');
        boxes.forEach((btn) => {
            const p = btn.getAttribute('data-preset');
            const isMatch = (p === activePreset) || (p === 'lobster' && isBlue);
            btn.classList.toggle('active', isMatch);
            btn.classList.toggle('blue-secret', p === 'lobster' && isBlue);
            const st = btn.querySelector('.ag-act-preset-state');
            if (st) {
                if (p === 'lobster' && isBlue) st.textContent = t('presetBlueSecret');
                else if (isMatch) st.textContent = t('presetSelected');
                else st.textContent = t('presetSelect');
            }
        });
        // Обновляем мини-превью на кнопке лобстера (синий / красный)
        const lobThumb = panel.querySelector('img[data-thumb="lobster"]');
        if (lobThumb && thumbsLoaded) {
            const targetP = isBlue ? 'blue-lobster' : 'lobster';
            loadPresetDataUri(targetP, 'idle').then((uri) => {
                if (uri) lobThumb.src = uri;
            }).catch(() => {});
        }
    }

    const presetNameInput = document.getElementById('ag-act-preset-name-input');
    const presetSaveBtn = document.getElementById('ag-act-preset-save-btn');
    const customPresetsContainer = document.getElementById('ag-act-custom-presets-container');

    function saveCustomPresetsMeta() {
        try {
            localStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
        } catch (e) {}
    }

    async function loadPresetDataUri(presetId, slot) {
        const key = `${presetId}:${slot}`;
        if (presetDataCache.has(key)) return presetDataCache.get(key);
        if (presetId && presetId.startsWith('custom-')) {
            try {
                const resp = await fetchFromAnyServer(`/activity-custom-presets/${presetId}/${slot}?t=${Date.now()}`);
                const mime = resp.headers.get('content-type') || 'image/gif';
                const buf = await resp.arrayBuffer();
                const uri = `data:${mime};base64,` + arrayBufferToBase64(buf);
                presetDataCache.set(key, uri);
                return uri;
            } catch (e) {}
            const rec = await idbGetSlot(`preset:${presetId}:${slot}`);
            if (rec && rec.dataUri) {
                presetDataCache.set(key, rec.dataUri);
                return rec.dataUri;
            }
            return loadPresetDataUri('spider', slot);
        }
        const endpoint = presetId === 'spider'
            ? `/activity-assets/${slot}.gif?t=${Date.now()}`
            : `/activity-assets/presets/${presetId}/${slot}.gif?t=${Date.now()}`;
        const resp = await fetchFromAnyServer(endpoint);
        const buf = await resp.arrayBuffer();
        const uri = 'data:image/gif;base64,' + arrayBufferToBase64(buf);
        presetDataCache.set(key, uri);
        return uri;
    }

    async function loadPresetThumbnails() {
        if (!thumbsLoaded) {
            thumbsLoaded = true;
            const list = ['spider', 'cat', 'snake', 'koi', 'lobster'];
            for (const p of list) {
                const img = panel.querySelector(`img[data-thumb="${p}"]`);
                if (!img) continue;
                const actualP = (p === 'lobster' && activePreset === 'blue-lobster') ? 'blue-lobster' : p;
                try {
                    const uri = await loadPresetDataUri(actualP, 'idle');
                    img.src = uri;
                } catch (e) {}
            }
        }
        for (const cp of customPresets) {
            const img = panel.querySelector(`img[data-thumb="${cp.id}"]`);
            if (!img || img.getAttribute('src')) continue;
            try {
                const uri = await loadPresetDataUri(cp.id, 'idle');
                img.src = uri;
            } catch (e) {}
        }
    }

    function renderCustomPresetsList() {
        if (!customPresetsContainer) return;
        customPresetsContainer.innerHTML = '';
        for (const cp of customPresets) {
            const row = document.createElement('div');
            row.className = 'ag-act-preset-row is-custom';

            const nameEl = document.createElement('span');
            nameEl.className = 'ag-act-preset-name';
            nameEl.textContent = cp.name;
            nameEl.title = cp.name;

            const wrap = document.createElement('div');
            wrap.className = 'ag-act-preset-box-wrap';

            const btn = document.createElement('button');
            btn.className = 'ag-act-preset-box';
            btn.type = 'button';
            btn.setAttribute('data-preset', cp.id);

            const thumb = document.createElement('img');
            thumb.className = 'ag-act-preset-thumb';
            thumb.setAttribute('data-thumb', cp.id);
            thumb.alt = '';

            const st = document.createElement('span');
            st.className = 'ag-act-preset-state';
            st.textContent = t('presetSelect');

            btn.appendChild(thumb);
            btn.appendChild(st);
            btn.addEventListener('click', () => {
                lobsterClickCount = 0;
                selectPreset(cp.id, true);
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'ag-act-preset-del';
            delBtn.type = 'button';
            delBtn.setAttribute('data-preset-name', cp.name);
            delBtn.title = `${t('deletePresetTitle')} «${cp.name}»`;
            delBtn.textContent = '×';
            delBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                deleteCustomPreset(cp.id);
            });

            wrap.appendChild(btn);
            wrap.appendChild(delBtn);
            row.appendChild(nameEl);
            row.appendChild(wrap);
            customPresetsContainer.appendChild(row);

            loadPresetDataUri(cp.id, 'idle').then((uri) => {
                if (uri) thumb.src = uri;
            }).catch(() => {});
        }
        updatePresetThemeAndUI();
    }

    async function createCustomPreset() {
        if (!presetNameInput) return;
        const name = presetNameInput.value.trim();
        if (!name) {
            presetNameInput.classList.add('invalid');
            presetNameInput.focus();
            setTimeout(() => presetNameInput.classList.remove('invalid'), 800);
            return;
        }
        if (presetSaveBtn) presetSaveBtn.disabled = true;
        try {
            const [customW, customI] = await Promise.all([idbGetSlot('working'), idbGetSlot('idle')]);
            let workingUri = (customW && customW.dataUri) || (elImgWorking && elImgWorking.src && elImgWorking.src.startsWith('data:') ? elImgWorking.src : '');
            let idleUri = (customI && customI.dataUri) || (elImgIdle && elImgIdle.src && elImgIdle.src.startsWith('data:') ? elImgIdle.src : '');
            if (!workingUri) workingUri = await loadPresetDataUri(activePreset, 'working');
            if (!idleUri) idleUri = await loadPresetDataUri(activePreset, 'idle');

            const newId = 'custom-' + Date.now();
            try {
                await fetchFromAnyServer('/activity-custom-presets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: newId,
                        name,
                        workingDataUri: workingUri,
                        idleDataUri: idleUri,
                        select: true
                    })
                });
            } catch (e) {}
            await Promise.all([
                idbSetSlot(`preset:${newId}:working`, { dataUri: workingUri, name }),
                idbSetSlot(`preset:${newId}:idle`, { dataUri: idleUri, name })
            ]);
            presetDataCache.set(`${newId}:working`, workingUri);
            presetDataCache.set(`${newId}:idle`, idleUri);

            customPresets.push({ id: newId, name });
            saveCustomPresetsMeta();
            presetNameInput.value = '';
            renderCustomPresetsList();
            await selectPreset(newId, true);
        } catch (e) {
            // Игнорируем ошибку сохранения
        } finally {
            if (presetSaveBtn) presetSaveBtn.disabled = false;
        }
    }

    async function deleteCustomPreset(presetId) {
        const idx = customPresets.findIndex((p) => p.id === presetId);
        if (idx === -1) return;
        customPresets.splice(idx, 1);
        saveCustomPresetsMeta();
        presetDataCache.delete(`${presetId}:working`);
        presetDataCache.delete(`${presetId}:idle`);
        try {
            await fetchFromAnyServer(`/activity-custom-presets/${presetId}`, { method: 'DELETE' });
        } catch (e) {}
        await Promise.all([
            idbDeleteSlot(`preset:${presetId}:working`),
            idbDeleteSlot(`preset:${presetId}:idle`)
        ]);
        renderCustomPresetsList();
        if (activePreset === presetId) {
            await selectPreset('spider', true);
        }
    }

    if (presetSaveBtn) {
        presetSaveBtn.addEventListener('click', () => createCustomPreset());
    }
    if (presetNameInput) {
        presetNameInput.addEventListener('keydown', (ev) => {
            ev.stopPropagation();
            if (ev.key === 'Enter') {
                ev.preventDefault();
                createCustomPreset();
            }
        });
    }

    async function selectPreset(presetId, clearCustom) {
        if (!isValidPresetId(presetId)) return;
        activePreset = presetId;
        try { localStorage.setItem(STORAGE_PRESET_KEY, activePreset); } catch (e) {}
        savePrefsToServer({ activePreset });
        updatePresetThemeAndUI();
        if (clearCustom) {
            await Promise.all([idbDeleteSlot('working'), idbDeleteSlot('idle')]);
        }
        try {
            await Promise.all([loadDefaultSlot('working'), loadDefaultSlot('idle')]);
            assetsLoaded = true;
        } catch (e) {}
    }

    // Секретный счётчик: 5 кликов по рамке с лобстером (в настройках или прямо по кругу панели!)
    let lobsterClickCount = 0;
    let lobsterClickTimer = null;
    function registerLobsterSecretClick(fromSettingsBox) {
        lobsterClickCount += 1;
        if (lobsterClickTimer) clearTimeout(lobsterClickTimer);
        lobsterClickTimer = setTimeout(() => { lobsterClickCount = 0; }, 2500);

        if (lobsterClickCount >= 5) {
            lobsterClickCount = 0;
            clearTimeout(lobsterClickTimer);
            lobsterClickTimer = null;
            const nextPreset = activePreset === 'blue-lobster' ? 'lobster' : 'blue-lobster';
            selectPreset(nextPreset, true);
            return true;
        }
        if (fromSettingsBox && activePreset !== 'lobster' && activePreset !== 'blue-lobster') {
            selectPreset('lobster', true);
        }
        return false;
    }

    panel.querySelectorAll('.ag-act-preset-box').forEach((btn) => {
        btn.addEventListener('click', () => {
            const p = btn.getAttribute('data-preset');
            if (p === 'lobster') {
                registerLobsterSecretClick(true);
            } else {
                lobsterClickCount = 0;
                selectPreset(p, true);
            }
        });
    });

    // 5 кликов по самой круглой рамке панели, когда выбран лобстер — тоже включает/выключает Синего лобстера!
    panel.querySelectorAll('.ag-act-ring').forEach((ringEl) => {
        ringEl.addEventListener('click', () => {
            if (activePreset === 'lobster' || activePreset === 'blue-lobster') {
                registerLobsterSecretClick(false);
            }
        });
    });

    renderCustomPresetsList();

    async function loadDefaultSlot(slot) {
        const imgEl = slot === 'working' ? elImgWorking : elImgIdle;
        const uri = await loadPresetDataUri(activePreset, slot);
        setImgSrc(imgEl, uri);
        setSlotTag(slot, '');
    }

    async function loadSlot(slot) {
        const custom = await idbGetSlot(slot);
        if (custom && custom.dataUri) {
            setImgSrc(slot === 'working' ? elImgWorking : elImgIdle, custom.dataUri);
            setSlotTag(slot, 'tagCustom');
            return;
        }
        await loadDefaultSlot(slot);
    }

    function bindSlotControls(slot, slotEl, pickBtn, resetBtn, fileInput) {
        pickBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });
        fileInput.addEventListener('change', () => {
            const f = fileInput.files && fileInput.files[0];
            if (f) applyCustomFile(slot, f);
        });
        resetBtn.addEventListener('click', async () => {
            await idbDeleteSlot(slot);
            try { await loadDefaultSlot(slot); } catch (e) {}
        });
        slotEl.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            slotEl.classList.add('dragover');
        });
        slotEl.addEventListener('dragleave', () => {
            slotEl.classList.remove('dragover');
        });
        slotEl.addEventListener('drop', (ev) => {
            ev.preventDefault();
            slotEl.classList.remove('dragover');
            const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
            if (f) applyCustomFile(slot, f);
        });
    }

    bindSlotControls('working', slotWorkingEl, pickWorkingBtn, resetWorkingBtn, fileWorkingInput);
    bindSlotControls('idle', slotIdleEl, pickIdleBtn, resetIdleBtn, fileIdleInput);

    let assetsLoaded = false;
    let assetsLoading = false;

    async function ensureAssetsLoaded() {
        if (assetsLoaded || assetsLoading) return;
        assetsLoading = true;
        try {
            await hydratePrefsFromServer();
            await Promise.all([
                loadSlot('working'),
                loadSlot('idle')
            ]);
            assetsLoaded = true;
        } catch (e) {
            window.__ag_activity_panel_asset_retry = setTimeout(() => {
                assetsLoading = false;
                ensureAssetsLoaded();
            }, 2500);
            return;
        }
        assetsLoading = false;
    }

    let currentState = { state: 'idle', detail: 'Готов к работе', startedAt: null, updatedAt: 0, now: Date.now() };
    let inFlight = false;
    let wasWorkingState = false;
    let cancelCountAtStart = 0;
    let lastCancelResetUpdatedAt = 0;

    const CANCEL_NOTICE_RE = /Пользователь отменил выполнение агента|User cancel+ed|Agent execution cancel+ed|Cancelled by user|Canceled by user|Stopped by user|Generation stopped/i;

    function countVisibleCancelNotices() {
        try {
            let count = 0;
            const els = document.querySelectorAll('p, div, span');
            for (const el of els) {
                if (!el || el.childElementCount > 2) continue;
                if (panel.contains(el) || tab.contains(el)) continue;
                const txt = (el.textContent || '').trim();
                if (txt.length < 12 || txt.length > 140) continue;
                if (!CANCEL_NOTICE_RE.test(txt)) continue;
                const r = el.getBoundingClientRect();
                if (r.width > 20 && r.height > 8) count += 1;
            }
            return count;
        } catch (e) {
            return 0;
        }
    }

    function triggerCancelledIdle(seenUpdatedAt) {
        const refUpdated = seenUpdatedAt || currentState.updatedAt || 0;
        if (refUpdated && lastCancelResetUpdatedAt === refUpdated) return;
        lastCancelResetUpdatedAt = refUpdated || Date.now();
        currentState = {
            state: 'idle',
            detail: 'Готов к работе',
            startedAt: null,
            updatedAt: Date.now(),
            now: Date.now()
        };
        wasWorkingState = false;
        renderStatus();
        try {
            fetchFromAnyServer('/activity-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    state: 'idle',
                    detail: 'Готов к работе',
                    ifUpdatedAt: refUpdated
                })
            }).catch(() => {});
        } catch (e) {}
    }

    // Отслеживаем клик по кнопке Стоп/Отмена в интерфейсе Antigravity во время работы агента
    let stopClickCheckTimer = 0;
    const onGlobalStopClick = (ev) => {
        if (currentState.state !== 'working') return;
        const target = ev.target && ev.target.closest ? ev.target.closest('button, [role="button"]') : null;
        if (!target || panel.contains(target) || tab.contains(target)) return;
        const label = ((target.getAttribute('aria-label') || '') + ' ' + (target.getAttribute('title') || '') + ' ' + (target.textContent || '')).trim();
        if (!/stop|cancel|abort|останов|отмен|прерв/i.test(label)) return;
        const seenUpdated = currentState.updatedAt || 0;
        if (stopClickCheckTimer) clearTimeout(stopClickCheckTimer);
        stopClickCheckTimer = setTimeout(() => {
            stopClickCheckTimer = 0;
            if (currentState.state === 'working' && (currentState.updatedAt || 0) === seenUpdated) {
                const liveNow = readLiveDomStatus();
                if (!liveNow || countVisibleCancelNotices() > cancelCountAtStart) {
                    triggerCancelledIdle(seenUpdated);
                }
            }
        }, 450);
    };
    window.addEventListener('click', onGlobalStopClick, true);

    function formatElapsed(ms) {
        const sec = Math.max(0, Math.floor(ms / 1000));
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return m + ':' + s;
    }

    // Читаем живой статус текущей активности из DOM чата (фокус/шаг агента), если он отображается
    function readLiveDomStatus() {
        try {
            const candidates = document.querySelectorAll('[class*="shimmer"], [class*="animate-pulse"]');
            let lastValid = '';
            for (const el of candidates) {
                if (!el || panel.contains(el) || tab.contains(el)) continue;
                const r = el.getBoundingClientRect();
                if (r.width < 20 || r.height < 10 || r.height > 64) continue;
                const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
                if (txt.length >= 4 && txt.length <= 90 && !/^\d{2}:\d{2}$/.test(txt)) {
                    lastValid = txt;
                }
            }
            return lastValid;
        } catch (e) {
            return '';
        }
    }

    function renderStatus() {
        const now = Date.now();
        let isWorking = currentState.state === 'working';

        if (isWorking && !wasWorkingState) {
            wasWorkingState = true;
            cancelCountAtStart = countVisibleCancelNotices();
        } else if (!isWorking && wasWorkingState) {
            wasWorkingState = false;
        }

        // Если во время работы в чате появилось новое уведомление об отмене агента — мгновенно переводим в idle
        if (isWorking && countVisibleCancelNotices() > cancelCountAtStart) {
            triggerCancelledIdle(currentState.updatedAt || 0);
            return;
        }

        elHeaderDot.classList.toggle('working', isWorking);
        elTabDot.classList.toggle('working', isWorking);

        if (isWorking) {
            elWorking.classList.add('active');
            elIdle.classList.remove('active');
            const hookDetail = (currentState.detail || '').trim();
            if (panelMode === 'mini') {
                // В компактном виде показываем только короткий статус,
                // чтобы длинный текст не сжимал и не дёргал круг с гифкой
                const isThinking = !hookDetail || hookDetail === 'Думаю…' || hookDetail.startsWith('Анализир') || hookDetail.startsWith('Размышл') || /^think|^analyz/i.test(hookDetail);
                elDetail.textContent = isThinking ? t('thinkingShort') : t('workingShort');
            } else {
                const isGeneric = !hookDetail || hookDetail === 'Думаю…' || hookDetail === 'Обрабатываю…' || hookDetail === 'Работаю…';
                const liveDom = isGeneric ? readLiveDomStatus() : '';
                elDetail.textContent = localizeStatusDetail(liveDom || hookDetail);
            }
            elTimer.textContent = formatElapsed(now - (currentState.startedAt || now));
        } else {
            elWorking.classList.remove('active');
            elIdle.classList.add('active');
        }
    }

    async function pollStatus() {
        if (inFlight) return;
        inFlight = true;
        try {
            const resp = await fetchFromAnyServer('/activity-status');
            const data = await resp.json();
            if (data && typeof data.state === 'string') {
                // Если этот конкретный working уже был сброшен локально из-за отмены — не возвращаем его
                if (data.state === 'working' && lastCancelResetUpdatedAt && Number(data.updatedAt || 0) <= lastCancelResetUpdatedAt) {
                    currentState = { state: 'idle', detail: 'Готов к работе', startedAt: null, updatedAt: data.updatedAt || 0, now: Date.now() };
                } else {
                    currentState = data;
                }
            }
            if (!assetsLoaded) ensureAssetsLoaded();
        } catch (e) {
            // Игнорируем кратковременные ошибки при старте/перезапуске сервера
        } finally {
            inFlight = false;
            renderStatus();
        }
    }

    applyTranslations();
    ensureAssetsLoaded();
    pollStatus();
    window.__ag_activity_panel_poll = setInterval(pollStatus, 450);
    window.__ag_activity_panel_tick = setInterval(() => {
        refreshAutoLanguage();
        renderStatus();
    }, 500);
    // Регулярная синхронизация (600 мс) гарантирует мгновенную подстройку при переключении на старые чаты
    window.__ag_activity_panel_top_sync = setInterval(() => syncLayout(false), 600);

    const disposeSelf = () => {
        if (stopClickCheckTimer) clearTimeout(stopClickCheckTimer);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mousemove', onThumbMove);
        window.removeEventListener('mouseup', onThumbUp);
        window.removeEventListener('scroll', onGlobalScrollCapture, true);
        window.removeEventListener('click', onGlobalStopClick, true);
        window.removeEventListener('resize', onWindowResize);
    };
    window.__ag_activity_panel_dispose = disposeSelf;
}
