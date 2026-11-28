import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

/**
 * Автономный автопатчер «Статус агента» для Antigravity.
 *
 * Режимы работы:
 *  1. При каждом запуске Antigravity проверяет app.asar (<15 мс). Если загрузчик на месте — мгновенно выходит.
 *  2. Если обновление Antigravity перезаписало app.asar — сразу вшивает загрузчик обратно и показывает
 *     ненавязчивое системное уведомление о необходимости одного перезапуска.
 *  3. Если app.asar в этот момент заблокирован процессом Antigravity.exe (EBUSY/EPERM) —
 *     переходит в тихий режим ожидания закрытия Antigravity и патчит app.asar в момент выхода,
 *     чтобы при следующем открытии панель сразу была на месте.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = __dirname;
const PATCHER_FILE = path.join(PLUGIN_ROOT, 'patch-asar.mjs');

let dataDir = process.env.PLUGIN_DATA || path.join(os.homedir(), '.gemini', 'antigravity', 'plugin_data', 'activity-indicator');
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--data_dir=')) {
    dataDir = arg.slice('--data_dir='.length).replace(/^"|"$/g, '');
  }
}
fs.mkdirSync(dataDir, { recursive: true });

const LOCK_FILE = path.join(dataDir, 'auto-patcher.lock');
const STATUS_JSON = path.join(dataDir, 'auto-patcher.json');
const LOG_FILE = path.join(dataDir, 'auto-patcher.log');
const PREFS_FILE = path.join(dataDir, 'prefs.json');

const isSilent = process.argv.includes('--silent');
const maxWaitMs = 45 * 60 * 1000; // До 45 минут ожидания закрытия Antigravity при блокировке файла

function logLine(msg) {
  try {
    const ts = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`, 'utf8');
    // Держим лог компактным (< 64 КБ)
    const st = fs.statSync(LOG_FILE);
    if (st.size > 65536) {
      const lines = fs.readFileSync(LOG_FILE, 'utf8').split(/\r?\n/).slice(-120);
      fs.writeFileSync(LOG_FILE, lines.join('\n') + '\n', 'utf8');
    }
  } catch {}
}

function writeState(obj) {
  try {
    const data = { ...obj, updatedAt: Date.now() };
    const tmp = STATUS_JSON + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, STATUS_JSON);
  } catch {}
}

function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const prev = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      if (prev && prev.pid && prev.pid !== process.pid && isPidAlive(prev.pid)) {
        return false;
      }
    }
  } catch {}
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), 'utf8');
    return true;
  } catch {
    return true;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const cur = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      if (cur && cur.pid === process.pid) fs.unlinkSync(LOCK_FILE);
    }
  } catch {}
}

function detectUserLang() {
  try {
    if (fs.existsSync(PREFS_FILE)) {
      const p = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
      if (p && (p.langMode === 'ru' || p.langMode === 'en')) return p.langMode;
    }
  } catch {}
  const locale = (process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || 'en').toLowerCase();
  return /^(ru|uk|be|kk)/.test(locale) ? 'ru' : 'en';
}

function showWindowsTrayNotice(agVersion) {
  if (isSilent || process.platform !== 'win32') return;
  try {
    const lang = detectUserLang();
    const verText = agVersion ? ` (${agVersion})` : '';
    const title = lang === 'ru' ? 'Статус агента — Автопатчер' : 'Agent Status — Auto-Patcher';
    const body = lang === 'ru'
      ? `Antigravity обновился${verText} — панель автоматически восстановлена. Перезапустите Antigravity 1 раз, чтобы она появилась.`
      : `Antigravity updated${verText} — the panel was automatically restored. Restart Antigravity once to display it.`;

    const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$n.BalloonTipTitle = '${title.replace(/'/g, "''")}'
$n.BalloonTipText = '${body.replace(/'/g, "''")}'
$n.Visible = $true
$n.ShowBalloonTip(7000)
Start-Sleep -Seconds 7
$n.Dispose()
`;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps], {
      windowsHide: true,
      stdio: 'ignore',
      detached: true
    });
    child.unref();
  } catch {}
}

function runPatchOnce() {
  const res = spawnSync(
    process.execPath,
    [PATCHER_FILE, '--check-and-patch', '--report-status', '--json'],
    { encoding: 'utf8', windowsHide: true, timeout: 25000 }
  );
  let info = {};
  try {
    const line = (res.stdout || '').trim().split(/\r?\n/).pop() || '';
    if (line.startsWith('{')) info = JSON.parse(line);
  } catch {}
  return { code: res.status ?? 1, info };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(PATCHER_FILE)) process.exit(0);
  if (!acquireLock()) process.exit(0);

  process.on('exit', releaseLock);
  process.on('SIGINT', () => { releaseLock(); process.exit(0); });
  process.on('SIGTERM', () => { releaseLock(); process.exit(0); });

  const first = runPatchOnce();
  if (first.code === 0) {
    writeState({
      state: 'ok',
      antigravityVersion: first.info.agVersion || '',
      asarPath: first.info.asarPath || '',
      preloadRelPath: first.info.preloadRelPath || 'dist/preload.js'
    });
    releaseLock();
    process.exit(0);
  }

  if (first.code === 2) {
    logLine(`Auto-healed app.asar for Antigravity ${first.info.agVersion || 'unknown'} (${first.info.preloadRelPath || 'dist/preload.js'})`);
    writeState({
      state: 'healed',
      healedAt: Date.now(),
      antigravityVersion: first.info.agVersion || '',
      asarPath: first.info.asarPath || '',
      preloadRelPath: first.info.preloadRelPath || 'dist/preload.js'
    });
    showWindowsTrayNotice(first.info.agVersion);
    releaseLock();
    process.exit(0);
  }

  if (first.code === 3) {
    // Файл app.asar заблокирован процессом Antigravity — ждём освобождения (закрытия IDE) и патчим!
    logLine(`app.asar locked (${first.info.asarPath || ''}) — waiting for Antigravity to close...`);
    writeState({
      state: 'waiting_for_exit',
      antigravityVersion: first.info.agVersion || '',
      asarPath: first.info.asarPath || ''
    });

    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      await sleep(3000);
      const attempt = runPatchOnce();
      if (attempt.code === 2 || attempt.code === 0) {
        logLine(`Deferred auto-patch succeeded (code=${attempt.code}, Antigravity ${attempt.info.agVersion || 'unknown'})`);
        writeState({
          state: attempt.code === 2 ? 'healed_on_exit' : 'ok',
          healedAt: Date.now(),
          antigravityVersion: attempt.info.agVersion || '',
          asarPath: attempt.info.asarPath || '',
          preloadRelPath: attempt.info.preloadRelPath || 'dist/preload.js'
        });
        releaseLock();
        process.exit(0);
      }
      if (attempt.code !== 3) {
        logLine(`Deferred auto-patch stopped with code=${attempt.code}: ${attempt.info.error || ''}`);
        break;
      }
    }
  } else {
    logLine(`Auto-patch check failed (code=${first.code}): ${first.info.error || first.info.status || 'unknown'}`);
    writeState({
      state: 'error',
      error: first.info.error || first.info.status || 'unknown',
      antigravityVersion: first.info.agVersion || ''
    });
  }

  releaseLock();
  process.exit(0);
}

main();
