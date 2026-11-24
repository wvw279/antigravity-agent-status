import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAYLOAD_DIR = path.join(__dirname, 'payload');
const HOME = os.homedir();
const GEMINI_CONFIG_DIR = path.join(HOME, '.gemini', 'config');
const CONFIG_JSON_PATH = path.join(GEMINI_CONFIG_DIR, 'config.json');
const PLUGIN_DIR = path.join(GEMINI_CONFIG_DIR, 'plugins', 'activity-indicator');

let explicitAsar = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--asar=')) {
    explicitAsar = a.slice('--asar='.length).replace(/^"|"$/g, '');
  }
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function resolveAsarPath() {
  if (explicitAsar && fs.existsSync(explicitAsar)) return explicitAsar;
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Antigravity.app/Contents/Resources/app.asar',
      '/Applications/Antigravity IDE.app/Contents/Resources/app.asar',
      path.join(HOME, 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'app.asar')
    ];
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
  }
  const localAppData = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const candidates = [
    path.join(localAppData, 'Programs', 'Antigravity', 'resources', 'app.asar'),
    path.join(localAppData, 'Antigravity', 'resources', 'app.asar'),
    path.join(programFiles, 'Antigravity', 'resources', 'app.asar'),
    path.join(programFilesX86, 'Antigravity', 'resources', 'app.asar')
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function enablePluginInConfig() {
  try {
    fs.mkdirSync(GEMINI_CONFIG_DIR, { recursive: true });
    let cfg = {};
    if (fs.existsSync(CONFIG_JSON_PATH)) {
      try {
        cfg = JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, 'utf8'));
      } catch {
        cfg = {};
      }
    }
    if (!cfg || typeof cfg !== 'object') cfg = {};
    if (!cfg.plugins || typeof cfg.plugins !== 'object') cfg.plugins = {};
    cfg.plugins['activity-indicator'] = { enabled: true };
    fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    console.log('      -> Плагин activity-indicator включён в config.json');
  } catch (e) {
    console.warn('      [!] Не удалось обновить config.json:', e.message);
  }
}

console.log('==========================================================');
console.log('  Установка панели «Статус агента» (v1.5.1) для Antigravity');
console.log('==========================================================\n');

if (!fs.existsSync(PAYLOAD_DIR)) {
  console.error('[ОШИБКА] Папка payload не найдена рядом с установщиком.');
  console.error('Распакуйте весь архив в отдельную папку перед запуском!');
  process.exit(1);
}

const asarPath = resolveAsarPath();
if (!fs.existsSync(asarPath)) {
  console.error('[ОШИБКА] Файл app.asar Antigravity не найден:');
  console.error('  ' + asarPath);
  console.error('Укажите путь к папке Antigravity в окне установщика.');
  process.exit(1);
}

console.log('[1/4] Копирую файлы плагина, хуки и пресеты анимаций...');
copyDirRecursive(PAYLOAD_DIR, PLUGIN_DIR);
fs.mkdirSync(path.join(PLUGIN_DIR, 'data'), { recursive: true });
console.log('      -> ' + PLUGIN_DIR);

console.log('\n[2/4] Включаю плагин в конфигурации Antigravity...');
enablePluginInConfig();

const sdkPath = path.join(PLUGIN_DIR, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json');
if (!fs.existsSync(sdkPath)) {
  console.log('\n[3/4] Устанавливаю зависимости локального сервера (npm install)...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmCmd, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: PLUGIN_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (res.status !== 0) {
    console.error('\n[ОШИБКА] Не удалось установить npm-зависимости.');
    console.error('Проверьте подключение к интернету и повторите установку.');
    process.exit(1);
  }
} else {
  console.log('\n[3/4] Зависимости локального сервера уже установлены — пропускаю.');
}

console.log('\n[4/4] Вшиваю автономный загрузчик панели в Antigravity...');
console.log('      -> ' + asarPath);
const patcherScript = path.join(PLUGIN_DIR, 'patch-asar.mjs');
try {
  execFileSync(process.execPath, [patcherScript, '--asar=' + asarPath], { stdio: 'inherit' });
} catch (err) {
  console.error('\n[ОШИБКА] Не удалось обновить app.asar.');
  console.error('Закройте Antigravity полностью и повторите установку.');
  process.exit(1);
}

console.log('\n[ГОТОВО] Установка «Статус агента» (v1.5.1) успешно завершена!');
