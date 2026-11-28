import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import vm from 'vm';
import { execFileSync } from 'child_process';

const BEGIN_MARKER = '// BEGIN AG-ACTIVITY-PANEL';
const END_MARKER = '// END AG-ACTIVITY-PANEL';

const LOADER_SNIPPET = `${BEGIN_MARKER}
;(function __agActivityPanelBoot() {
  if (typeof window === 'undefined' || window !== window.top) return;
  if (window.__ag_activity_standalone_booted) return;
  window.__ag_activity_standalone_booted = true;
  const BASE = 'http://127.0.0.1:39229';
  let loadedHash = '';
  async function loadPanel() {
    try {
      const r = await fetch(BASE + '/panel.js?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return false;
      const h = r.headers.get('X-AG-Panel-Hash') || '';
      const code = await r.text();
      if (!code || !code.includes('initActivityPanel')) return false;
      (0, eval)(code);
      loadedHash = h || 'loaded';
      return true;
    } catch (e) {
      return false;
    }
  }
  async function checkHotReload() {
    try {
      const missingDom = !document.getElementById('ag-activity-panel-root');
      if (!loadedHash || missingDom) {
        await loadPanel();
        return;
      }
      const r = await fetch(BASE + '/panel-hash', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      if (d && d.hash && d.hash !== loadedHash) {
        await loadPanel();
      }
    } catch (e) {}
  }
  const start = () => {
    loadPanel();
    setInterval(checkHotReload, 4000);
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
${END_MARKER}`;

function detectAsarFromRunningProcess() {
  if (process.platform !== 'win32') return '';
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "(Get-Process -Name 'Antigravity' -ErrorAction SilentlyContinue | Select-Object -First 1).Path"
      ],
      { encoding: 'utf8', timeout: 2500, windowsHide: true }
    ).trim();
    if (out) {
      const candidate = path.join(path.dirname(out), 'resources', 'app.asar');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {}
  return '';
}

function resolveAsarPath(explicitPath) {
  if (explicitPath && fs.existsSync(explicitPath)) return explicitPath;
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Antigravity.app/Contents/Resources/app.asar',
      '/Applications/Antigravity IDE.app/Contents/Resources/app.asar',
      path.join(os.homedir(), 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'app.asar')
    ];
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
  }
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const candidates = [
    path.join(localAppData, 'Programs', 'Antigravity', 'resources', 'app.asar'),
    path.join(localAppData, 'Antigravity', 'resources', 'app.asar'),
    path.join(programFiles, 'Antigravity', 'resources', 'app.asar'),
    path.join(programFilesX86, 'Antigravity', 'resources', 'app.asar')
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) return found;
  const fromProc = detectAsarFromRunningProcess();
  return fromProc || candidates[0];
}

function readAsar(asarPath) {
  const buf = fs.readFileSync(asarPath);
  const headerPickleSize = buf.readUInt32LE(4);
  const jsonByteLen = buf.readUInt32LE(12);
  const headerJsonStr = buf.subarray(16, 16 + jsonByteLen).toString('utf8');
  const dataStart = 8 + headerPickleSize;
  const header = JSON.parse(headerJsonStr);
  return { buf, header, dataStart };
}

function readAntigravityVersion(buf, header, dataStart) {
  try {
    const pkgEntry = header?.files?.['package.json'];
    if (!pkgEntry || typeof pkgEntry.offset === 'undefined') return '';
    const raw = buf.subarray(dataStart + Number(pkgEntry.offset), dataStart + Number(pkgEntry.offset) + Number(pkgEntry.size)).toString('utf8');
    const pkg = JSON.parse(raw);
    return String(pkg.version || '');
  } catch {
    return '';
  }
}

// Умный поиск главного preload.js внутри app.asar (поддержка будущих версий Antigravity)
function findMainPreloadEntry(header) {
  const direct = header?.files?.dist?.files?.['preload.js'];
  if (direct && typeof direct.offset !== 'undefined') {
    return { entry: direct, relPath: 'dist/preload.js' };
  }
  const preferredDirs = ['dist', 'out', 'build', 'app'];
  for (const dir of preferredDirs) {
    const cand = header?.files?.[dir]?.files?.['preload.js'];
    if (cand && typeof cand.offset !== 'undefined') {
      return { entry: cand, relPath: `${dir}/preload.js` };
    }
  }
  // Резервный поиск по дереву (исключая node_modules)
  let best = null;
  function walk(node, prefix) {
    if (!node || !node.files) return;
    for (const [name, child] of Object.entries(node.files)) {
      if (name === 'node_modules') continue;
      const rel = prefix ? `${prefix}/${name}` : name;
      if (child.files) {
        walk(child, rel);
      } else if (name === 'preload.js' && typeof child.offset !== 'undefined') {
        if (!best || Number(child.size || 0) > Number(best.entry.size || 0)) {
          best = { entry: child, relPath: rel };
        }
      }
    }
  }
  walk(header, '');
  return best;
}

function buildIntegrity(fileBuf, blockSize = 4 * 1024 * 1024) {
  const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');
  const blocks = [];
  for (let i = 0; i < fileBuf.length; i += blockSize) {
    const slice = fileBuf.subarray(i, Math.min(i + blockSize, fileBuf.length));
    blocks.push(crypto.createHash('sha256').update(slice).digest('hex'));
  }
  if (blocks.length === 0) {
    blocks.push(crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex'));
  }
  return { algorithm: 'SHA256', hash, blockSize, blocks };
}

function hasLegacyInlinePanel(code) {
  return code.includes('// ===== [MODULE: src/activity-panel.js] =====') ||
    /^\s*initActivityPanel\(\);\s*$/m.test(code);
}

function stripLegacyInlinePanel(code) {
  let out = code;
  const modStart = out.indexOf('// ===== [MODULE: src/activity-panel.js] =====');
  if (modStart >= 0) {
    const nextMod = out.indexOf('// ===== [MODULE:', modStart + 10);
    if (nextMod > modStart) {
      out = out.slice(0, modStart) + out.slice(nextMod);
    }
  }
  out = out.replace(/^\s*initActivityPanel\(\);\s*\r?\n/gm, '');
  return out;
}

function stripOurBlock(code) {
  const re = /\/\/ BEGIN AG-ACTIVITY-PANEL[\s\S]*?\/\/ END AG-ACTIVITY-PANEL\r?\n?/g;
  return code.replace(re, '');
}

function injectOurBlock(code) {
  const clean = stripLegacyInlinePanel(stripOurBlock(code));
  const strictMatch = clean.match(/^(['"]use strict['"];?\r?\n)/);
  if (strictMatch) {
    return strictMatch[1] + LOADER_SNIPPET + '\n' + clean.slice(strictMatch[1].length);
  }
  return LOADER_SNIPPET + '\n' + clean;
}

function writePatchedAsar(asarPath, header, dataSection, appendedBuf) {
  const jsonBuf = Buffer.from(JSON.stringify(header), 'utf8');
  const alignedJsonLen = (jsonBuf.length + 3) & ~3;
  const padLen = alignedJsonLen - jsonBuf.length;
  const headerPickleSize = alignedJsonLen + 8;
  const payloadSize = alignedJsonLen + 4;

  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerPickleSize, 4);
  prefix.writeUInt32LE(payloadSize, 8);
  prefix.writeUInt32LE(jsonBuf.length, 12);

  const padding = padLen > 0 ? Buffer.alloc(padLen) : Buffer.alloc(0);
  const outBuf = Buffer.concat([prefix, jsonBuf, padding, dataSection, appendedBuf]);

  const tmpPath = asarPath + '.ag-panel-tmp';
  fs.writeFileSync(tmpPath, outBuf);
  try {
    fs.renameSync(tmpPath, asarPath);
  } catch {
    try {
      fs.writeFileSync(asarPath, outBuf);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  }
}

const argv = process.argv.slice(2);
const args = new Set(argv);
const isUnpatch = args.has('--unpatch');
const isCheckAndPatch = args.has('--check-and-patch');
const isReportStatus = args.has('--report-status');
const isJson = args.has('--json');
let explicitAsar = '';
for (const a of argv) {
  if (a.startsWith('--asar=')) {
    explicitAsar = a.slice('--asar='.length).replace(/^"|"$/g, '');
  }
}

function finish(code, payload, humanMsg) {
  if (isJson) {
    process.stdout.write(JSON.stringify(payload) + '\n');
  } else if (humanMsg) {
    if (code === 1 || code === 3) console.error(humanMsg);
    else console.log(humanMsg);
  }
  process.exit(code);
}

const asarPath = resolveAsarPath(explicitAsar);
if (!fs.existsSync(asarPath)) {
  finish(1, { status: 'not_found', asarPath }, `[patch-asar] app.asar не найден: ${asarPath}`);
}

let parsed;
try {
  parsed = readAsar(asarPath);
} catch (err) {
  const locked = err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES');
  finish(locked && isReportStatus ? 3 : 1, { status: locked ? 'locked' : 'read_error', asarPath, error: err?.message }, `[patch-asar] Ошибка чтения app.asar: ${err?.message}`);
}

const { buf, header, dataStart } = parsed;
const agVersion = readAntigravityVersion(buf, header, dataStart);
const preloadInfo = findMainPreloadEntry(header);
if (!preloadInfo) {
  finish(1, { status: 'preload_not_found', asarPath, agVersion }, '[patch-asar] preload.js не найден внутри app.asar');
}

const { entry: preloadEntry, relPath: preloadRelPath } = preloadInfo;
const oldOffset = Number(preloadEntry.offset);
const oldSize = Number(preloadEntry.size);
const oldPreloadCode = buf.subarray(dataStart + oldOffset, dataStart + oldOffset + oldSize).toString('utf8');

const alreadyUpToDate = oldPreloadCode.includes(LOADER_SNIPPET) && !hasLegacyInlinePanel(oldPreloadCode);
if (isCheckAndPatch && alreadyUpToDate) {
  finish(0, { status: 'already_patched', asarPath, agVersion, preloadRelPath }, '');
}
if (isUnpatch && !oldPreloadCode.includes(BEGIN_MARKER)) {
  finish(0, { status: 'already_clean', asarPath, agVersion, preloadRelPath }, '[patch-asar] Загрузчик уже отсутствует в app.asar.');
}

const nextPreloadCode = isUnpatch ? stripOurBlock(oldPreloadCode) : injectOurBlock(oldPreloadCode);

// Проверяем синтаксис перед записью в app.asar
new vm.Script(nextPreloadCode, { filename: preloadRelPath });

const dataSection = buf.subarray(dataStart);
const nextPreloadBuf = Buffer.from(nextPreloadCode, 'utf8');
preloadEntry.offset = String(dataSection.length);
preloadEntry.size = nextPreloadBuf.length;
if (preloadEntry.integrity) {
  preloadEntry.integrity = buildIntegrity(nextPreloadBuf, preloadEntry.integrity.blockSize || 4 * 1024 * 1024);
}

try {
  writePatchedAsar(asarPath, header, dataSection, nextPreloadBuf);
} catch (err) {
  const locked = err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES');
  finish(
    locked && isReportStatus ? 3 : 1,
    { status: locked ? 'locked' : 'write_error', asarPath, agVersion, error: err?.message },
    `[patch-asar] Не удалось записать app.asar (${err?.code || 'ERR'}): ${err?.message}`
  );
}

const successCode = (!isUnpatch && isReportStatus) ? 2 : 0;
finish(
  successCode,
  { status: isUnpatch ? 'unpatched' : 'patched', asarPath, agVersion, preloadRelPath },
  isUnpatch
    ? `[patch-asar] Загрузчик «Статус агента» удалён из app.asar (Antigravity ${agVersion || 'unknown'}).`
    : `[patch-asar] Автономный загрузчик «Статус агента» успешно вшит в ${preloadRelPath} (Antigravity ${agVersion || 'unknown'}, syntax OK).`
);
