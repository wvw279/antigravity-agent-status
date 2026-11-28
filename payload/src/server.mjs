import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..');

// Resolve data directory from --data_dir=..., env PLUGIN_DATA, or local fallback
let dataDir = process.env.PLUGIN_DATA || path.join(PLUGIN_ROOT, 'data');
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--data_dir=')) {
    dataDir = arg.slice('--data_dir='.length);
  }
}
fs.mkdirSync(dataDir, { recursive: true });

const STATUS_FILE = path.join(dataDir, 'status.json');
const LOCAL_STATUS_FILE = path.join(PLUGIN_ROOT, 'data', 'status.json');
const PREFS_FILE = path.join(dataDir, 'prefs.json');
const CUSTOM_PRESETS_DIR = path.join(dataDir, 'custom-presets');
const HTML_FILE = path.join(PLUGIN_ROOT, 'dist', 'app.html');
const PANEL_JS_FILE = path.join(PLUGIN_ROOT, 'src', 'activity-panel.js');
const PATCHER_FILE = path.join(PLUGIN_ROOT, 'patch-asar.mjs');
const AUTO_PATCHER_FILE = path.join(PLUGIN_ROOT, 'auto-patcher.mjs');
const AUTO_PATCHER_STATUS_FILE = path.join(dataDir, 'auto-patcher.json');
const DOCS_SYNC_FILE = '';
const APP_URI = 'ui://activity-indicator/app.html';

let lastDocsSyncMs = 0;
function triggerDocsSync() {
  const now = Date.now();
  if (now - lastDocsSyncMs < 5000) return;
  if (!fs.existsSync(DOCS_SYNC_FILE)) return;
  lastDocsSyncMs = now;
  try {
    const child = spawn(process.execPath, [DOCS_SYNC_FILE], {
      windowsHide: true,
      stdio: 'ignore',
      detached: true
    });
    child.unref();
  } catch {}
}

function readStatus() {
  const now = Date.now();
  const candidates = Array.from(new Set([STATUS_FILE, LOCAL_STATUS_FILE]));
  let best = null;
  for (const f of candidates) {
    try {
      if (fs.existsSync(f)) {
        const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (!best || (parsed.updatedAt || 0) > (best.updatedAt || 0)) {
          best = parsed;
        }
      }
    } catch {}
  }
  if (best) {
    if (best.state === 'working' && best.updatedAt && (now - best.updatedAt > 180000)) {
      return { state: 'idle', detail: 'Ожидание задачи', startedAt: null, updatedAt: best.updatedAt, now };
    }
    return {
      state: best.state === 'working' ? 'working' : 'idle',
      detail: best.detail || (best.state === 'working' ? 'Работаю…' : 'Ожидание задачи'),
      startedAt: best.startedAt || best.updatedAt || now,
      updatedAt: best.updatedAt || now,
      now
    };
  }
  return { state: 'idle', detail: 'Ожидание задачи', startedAt: null, updatedAt: now, now };
}

let cachedPanel = { mtimeMs: 0, size: 0, hash: '', wrapped: '' };
function getPanelBundle() {
  try {
    if (!fs.existsSync(PANEL_JS_FILE)) return null;
    const st = fs.statSync(PANEL_JS_FILE);
    if (cachedPanel.mtimeMs !== st.mtimeMs || cachedPanel.size !== st.size || !cachedPanel.hash) {
      const raw = fs.readFileSync(PANEL_JS_FILE, 'utf8');
      const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
      const wrapped = `(() => {\n${raw}\nfunction __agBootPanel() {\n  if (document.body && document.head) {\n    initActivityPanel();\n  } else {\n    setTimeout(__agBootPanel, 150);\n  }\n}\n__agBootPanel();\n})();\n`;
      cachedPanel = { mtimeMs: st.mtimeMs, size: st.size, hash, wrapped };
      triggerDocsSync();
    }
    return cachedPanel;
  } catch {
    return null;
  }
}

const server = new McpServer(
  { name: 'activity-indicator', version: '1.2.0' },
  { capabilities: { resources: {}, tools: {} } }
);

// 1. UI resource (self-contained HTML)
server.registerResource(
  'activity-indicator-ui',
  APP_URI,
  {
    title: 'Индикатор работы агента',
    description: 'Визуальный индикатор активности агента',
    mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { prefersBorder: false } }
  },
  async () => {
    const html = fs.existsSync(HTML_FILE)
      ? fs.readFileSync(HTML_FILE, 'utf8')
      : '<!doctype html><html><body><p>dist/app.html not built</p></body></html>';
    return {
      contents: [
        {
          uri: APP_URI,
          mimeType: 'text/html;profile=mcp-app',
          text: html,
          _meta: { ui: { prefersBorder: false } }
        }
      ]
    };
  }
);

// 2. Entrypoint tool for side pane
server.registerTool(
  'open_activity_indicator',
  {
    title: 'Статус агента',
    description: 'Открывает панель визуального индикатора активности агента.',
    inputSchema: {},
    _meta: {
      ui: { resourceUri: APP_URI },
      'com.google.antigravity/ui': {
        entrypoints: [
          { type: 'aux_pane', title: 'Статус агента' }
        ]
      }
    }
  },
  async () => {
    const status = readStatus();
    return {
      content: [{ type: 'text', text: `Панель «Статус агента» открыта. Статус: ${status.state}.` }],
      structuredContent: status
    };
  }
);

// 3. App-only polling tool (hidden from model)
server.registerTool(
  'get_status',
  {
    title: 'Get loader status',
    description: 'Returns current agent working/idle status.',
    inputSchema: {},
    _meta: {
      ui: { visibility: ['app'] }
    }
  },
  async () => {
    const status = readStatus();
    return {
      content: [{ type: 'text', text: status.state }],
      structuredContent: status
    };
  }
);

// 4. Полностью автономный локальный HTTP-сервер (порт 39229)
function readPrefs() {
  try {
    if (fs.existsSync(PREFS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function writePrefs(prefs) {
  try {
    fs.mkdirSync(path.dirname(PREFS_FILE), { recursive: true });
    const tmp = PREFS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2), 'utf8');
    fs.renameSync(tmp, PREFS_FILE);
  } catch {
    try { fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2), 'utf8'); } catch {}
  }
}

function readJsonBody(req, maxBytes = 40 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function parseDataUri(uri) {
  if (typeof uri !== 'string') return null;
  const m = uri.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) return null;
  return { mime: m[1] || 'image/gif', buf: Buffer.from(m[2], 'base64') };
}

const STATUS_PORT = 39229;
const httpServer = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'X-AG-Panel-Hash');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const reqPath = (req.url || '/').split('?')[0];

  if (reqPath === '/activity-prefs' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(JSON.stringify(readPrefs()));
    return;
  }

  if (reqPath === '/activity-prefs' && req.method === 'POST') {
    try {
      const patch = await readJsonBody(req, 1024 * 1024);
      const prev = readPrefs();
      const next = { ...prev };
      const allowedKeys = ['activePreset', 'panelMode', 'savedWidth', 'miniWidth', 'miniHeight', 'userCollapsed', 'tabYRatio', 'langMode'];
      for (const k of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) {
          next[k] = patch[k];
        }
      }
      writePrefs(next);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false }));
    }
    return;
  }

  if (reqPath === '/activity-custom-presets' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req, 45 * 1024 * 1024);
      const id = String(body.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const name = String(body.name || '').trim().slice(0, 32);
      const wParsed = parseDataUri(body.workingDataUri);
      const iParsed = parseDataUri(body.idleDataUri);
      if (!id.startsWith('custom-') || !name || !wParsed || !iParsed) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid preset data' }));
        return;
      }
      const presetDir = path.join(CUSTOM_PRESETS_DIR, id);
      fs.mkdirSync(presetDir, { recursive: true });
      fs.writeFileSync(path.join(presetDir, 'working.bin'), wParsed.buf);
      fs.writeFileSync(path.join(presetDir, 'idle.bin'), iParsed.buf);

      const prefs = readPrefs();
      const list = Array.isArray(prefs.customPresets) ? prefs.customPresets.filter((p) => p && p.id !== id) : [];
      list.push({ id, name, mimeWorking: wParsed.mime, mimeIdle: iParsed.mime });
      prefs.customPresets = list;
      if (body.select !== false) {
        prefs.activePreset = id;
      }
      writePrefs(prefs);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, id, name }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false }));
    }
    return;
  }

  const customAssetMatch = reqPath.match(/^\/activity-custom-presets\/(custom-[a-zA-Z0-9_-]+)\/(working|idle)$/);
  if (customAssetMatch && req.method === 'GET') {
    const [, id, slot] = customAssetMatch;
    const binPath = path.join(CUSTOM_PRESETS_DIR, id, `${slot}.bin`);
    try {
      if (fs.existsSync(binPath)) {
        const prefs = readPrefs();
        const meta = Array.isArray(prefs.customPresets) ? prefs.customPresets.find((p) => p && p.id === id) : null;
        const mime = (slot === 'working' ? meta?.mimeWorking : meta?.mimeIdle) || 'image/gif';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(binPath));
        return;
      }
    } catch {}
    res.writeHead(404);
    res.end();
    return;
  }

  const customDeleteMatch = reqPath.match(/^\/activity-custom-presets\/(custom-[a-zA-Z0-9_-]+)$/);
  if (customDeleteMatch && req.method === 'DELETE') {
    const [, id] = customDeleteMatch;
    try {
      const presetDir = path.join(CUSTOM_PRESETS_DIR, id);
      if (fs.existsSync(presetDir)) {
        fs.rmSync(presetDir, { recursive: true, force: true });
      }
      const prefs = readPrefs();
      if (Array.isArray(prefs.customPresets)) {
        prefs.customPresets = prefs.customPresets.filter((p) => p && p.id !== id);
      }
      if (prefs.activePreset === id) {
        prefs.activePreset = 'spider';
      }
      writePrefs(prefs);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false }));
    }
    return;
  }

  if (reqPath === '/panel.js') {
    const bundle = getPanelBundle();
    if (!bundle) {
      res.writeHead(404);
      res.end('activity-panel.js not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-AG-Panel-Hash': bundle.hash
    });
    res.end(bundle.wrapped);
    return;
  }

  if (reqPath === '/panel-hash') {
    const bundle = getPanelBundle();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(JSON.stringify({ hash: bundle ? bundle.hash : '' }));
    return;
  }

  if (reqPath === '/activity-status') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(JSON.stringify(readStatus()));
    return;
  }

  if (reqPath === '/auto-patcher-status') {
    let st = { state: 'unknown' };
    try {
      if (fs.existsSync(AUTO_PATCHER_STATUS_FILE)) {
        st = JSON.parse(fs.readFileSync(AUTO_PATCHER_STATUS_FILE, 'utf8'));
      }
    } catch {}
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(JSON.stringify(st));
    return;
  }

  if (reqPath === '/activity-assets/working.gif' || reqPath === '/activity-assets/idle.gif') {
    const fileName = reqPath.endsWith('working.gif') ? 'working.gif' : 'idle.gif';
    const assetPath = path.join(PLUGIN_ROOT, 'assets', fileName);
    try {
      if (fs.existsSync(assetPath)) {
        res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'public, max-age=3600' });
        res.end(fs.readFileSync(assetPath));
        return;
      }
    } catch {}
  }

  const presetMatch = reqPath.match(/^\/activity-assets\/presets\/([a-z0-9-]+)\/(working|idle)\.gif$/);
  if (presetMatch) {
    const [, presetId, slot] = presetMatch;
    const assetPath = presetId === 'spider'
      ? path.join(PLUGIN_ROOT, 'assets', `${slot}.gif`)
      : path.join(PLUGIN_ROOT, 'assets', 'presets', presetId, `${slot}.gif`);
    try {
      if (fs.existsSync(assetPath)) {
        res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'public, max-age=3600' });
        res.end(fs.readFileSync(assetPath));
        return;
      }
    } catch {}
  }

  res.writeHead(404);
  res.end();
});
httpServer.on('error', () => {});
try {
  httpServer.listen(STATUS_PORT, '127.0.0.1');
  httpServer.unref();
} catch {}

// Завершаем процесс чисто, когда AntiGravity закрывает stdio-канал (чтобы не оставлять «висячих» процессов на порту 39229)
process.stdin.on('end', () => process.exit(0));
process.stdin.on('close', () => process.exit(0));

// 5. Автономный автопатчер: отслеживает обновления Antigravity и восстанавливает загрузчик в app.asar
//    (если файл заблокирован процессом IDE — тихо ждёт закрытия Antigravity и патчит сразу после выхода)
let isHealing = false;
function runAutoPatcher() {
  if (isHealing) return;
  const targetScript = fs.existsSync(AUTO_PATCHER_FILE) ? AUTO_PATCHER_FILE : PATCHER_FILE;
  if (!fs.existsSync(targetScript)) return;
  try {
    const args = targetScript === AUTO_PATCHER_FILE
      ? [targetScript, `--data_dir=${dataDir}`]
      : [targetScript, '--check-and-patch'];
    const child = spawn(process.execPath, args, {
      windowsHide: true,
      stdio: 'ignore',
      detached: true
    });
    isHealing = true;
    child.on('exit', () => { isHealing = false; });
    child.on('error', () => { isHealing = false; });
    child.unref();
  } catch {
    isHealing = false;
  }
}
setTimeout(runAutoPatcher, 4000);
const autoPatchInterval = setInterval(runAutoPatcher, 10 * 60 * 1000);
autoPatchInterval.unref();
setTimeout(triggerDocsSync, 3000);

const transport = new StdioServerTransport();
await server.connect(transport);
