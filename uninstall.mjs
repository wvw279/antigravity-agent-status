import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

const HOME = os.homedir();
const GEMINI_CONFIG_DIR = path.join(HOME, '.gemini', 'config');
const CONFIG_JSON_PATH = path.join(GEMINI_CONFIG_DIR, 'config.json');
const PLUGIN_DIR = path.join(GEMINI_CONFIG_DIR, 'plugins', 'activity-indicator');
const PLUGIN_DATA_DIR = path.join(HOME, '.gemini', 'antigravity', 'plugin_data', 'activity-indicator');

let explicitAsar = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--asar=')) {
    explicitAsar = a.slice('--asar='.length).replace(/^"|"$/g, '');
  }
}

console.log('==========================================================');
console.log('  Удаление панели «Статус агента» из Antigravity');
console.log('==========================================================\n');

const patcherScript = path.join(PLUGIN_DIR, 'patch-asar.mjs');
if (fs.existsSync(patcherScript)) {
  console.log('[1/3] Удаляю загрузчик из app.asar...');
  try {
    const args = [patcherScript, '--unpatch'];
    if (explicitAsar) args.push('--asar=' + explicitAsar);
    execFileSync(process.execPath, args, { stdio: 'inherit' });
  } catch (err) {
    console.error('\n[ОШИБКА] Не удалось очистить app.asar.');
    console.error('Закройте Antigravity полностью и повторите удаление.');
    process.exit(1);
  }
} else {
  console.log('[1/3] Скрипт patch-asar.mjs не найден — пропускаю очистку app.asar.');
}

console.log('\n[2/3] Убираю плагин из config.json...');
try {
  if (fs.existsSync(CONFIG_JSON_PATH)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, 'utf8'));
    if (cfg && cfg.plugins && cfg.plugins['activity-indicator']) {
      delete cfg.plugins['activity-indicator'];
      fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(cfg, null, 2), 'utf8');
      console.log('[OK] Убрано из config.json');
    }
  }
} catch {}

console.log('\n[3/3] Удаляю файлы плагина...');
if (fs.existsSync(PLUGIN_DIR)) {
  fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
  console.log('[OK] Удалено: ' + PLUGIN_DIR);
} else {
  console.log('[OK] Папка плагина уже отсутствует.');
}

if (fs.existsSync(PLUGIN_DATA_DIR)) {
  fs.rmSync(PLUGIN_DATA_DIR, { recursive: true, force: true });
  console.log('[OK] Удалены данные: ' + PLUGIN_DATA_DIR);
}

console.log('\n[ГОТОВО] Панель «Статус агента» полностью удалена.');
