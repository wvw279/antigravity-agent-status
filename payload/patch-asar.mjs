import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import vm from 'vm';

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
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
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
    fs.writeFileSync(asarPath, outBuf);
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

const argv = process.argv.slice(2);
const args = new Set(argv);
const isUnpatch = args.has('--unpatch');
const isCheckAndPatch = args.has('--check-and-patch');
let explicitAsar = '';
for (const a of argv) {
  if (a.startsWith('--asar=')) {
    explicitAsar = a.slice('--asar='.length).replace(/^"|"$/g, '');
  }
}

const asarPath = resolveAsarPath(explicitAsar);
if (!fs.existsSync(asarPath)) {
  console.error('[patch-asar] app.asar не найден:', asarPath);
  process.exit(1);
}

const { buf, header, dataStart } = readAsar(asarPath);
const preloadEntry = header?.files?.dist?.files?.['preload.js'];
if (!preloadEntry || typeof preloadEntry.offset === 'undefined') {
  console.error('[patch-asar] dist/preload.js не найден внутри app.asar');
  process.exit(1);
}

const oldOffset = Number(preloadEntry.offset);
const oldSize = Number(preloadEntry.size);
const oldPreloadCode = buf.subarray(dataStart + oldOffset, dataStart + oldOffset + oldSize).toString('utf8');

const alreadyUpToDate = oldPreloadCode.includes(LOADER_SNIPPET) && !hasLegacyInlinePanel(oldPreloadCode);
if (isCheckAndPatch && alreadyUpToDate) {
  process.exit(0);
}
if (isUnpatch && !oldPreloadCode.includes(BEGIN_MARKER)) {
  console.log('[patch-asar] Загрузчик уже отсутствует в app.asar.');
  process.exit(0);
}

const nextPreloadCode = isUnpatch ? stripOurBlock(oldPreloadCode) : injectOurBlock(oldPreloadCode);

// Проверяем синтаксис перед записью в app.asar
new vm.Script(nextPreloadCode, { filename: 'dist/preload.js' });

const dataSection = buf.subarray(dataStart);
const nextPreloadBuf = Buffer.from(nextPreloadCode, 'utf8');
preloadEntry.offset = String(dataSection.length);
preloadEntry.size = nextPreloadBuf.length;
if (preloadEntry.integrity) {
  preloadEntry.integrity = buildIntegrity(nextPreloadBuf, preloadEntry.integrity.blockSize || 4 * 1024 * 1024);
}

writePatchedAsar(asarPath, header, dataSection, nextPreloadBuf);
console.log(
  isUnpatch
    ? '[patch-asar] Загрузчик «Статус агента» удалён из app.asar.'
    : '[patch-asar] Автономный загрузчик «Статус агента» успешно вшит в app.asar (syntax OK).'
);
