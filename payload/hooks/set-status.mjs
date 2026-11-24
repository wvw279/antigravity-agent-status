import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || path.resolve(__dirname, '..');
const DATA_DIR = process.env.PLUGIN_DATA || path.join(PLUGIN_ROOT, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');

const targetState = process.argv[2] === 'working' ? 'working' : 'idle';
const fallbackDetail = process.argv[3] || (targetState === 'working' ? 'Анализирую запрос…' : 'Готов к работе');

// Read stdin payload (non-blocking / safe if empty)
let stdinText = '';
try {
  stdinText = fs.readFileSync(0, 'utf8');
} catch {}

let payload = {};
try {
  if (stdinText && stdinText.trim()) payload = JSON.parse(stdinText);
} catch {}

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return {};
}

function truncate(str, maxLen = 64) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1).trimEnd() + '…';
}

function shortBase(p) {
  if (!p || typeof p !== 'string') return '';
  const cleaned = p.replace(/[\\/]+$/, '');
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] || cleaned;
}

const TOOL_LABELS = {
  run_command: 'Выполняю команду…',
  read_file: 'Читаю файл…',
  write_file: 'Записываю файл…',
  edit_file: 'Редактирую файл…',
  search_web: 'Ищу в интернете…',
  invoke_subagent: 'Запускаю субагента…',
  call_mcp_tool: 'Вызываю MCP-инструмент…',
  update_focus: 'Обновляю статус…',
  update_steps: 'Обновляю план…',
  manage_task: 'Проверяю фоновую задачу…'
};

let detail = fallbackDetail;
const toolCall = payload?.toolCall || payload?.tool_call || null;
const tName = String(toolCall?.name || payload?.tool_name || payload?.toolName || '');
const tArgs = parseArgs(toolCall?.arguments || toolCall?.args || toolCall?.input || payload?.tool_input || payload?.arguments);

if (targetState === 'working' && tName) {
  if (tName === 'update_focus' && tArgs.focus) {
    detail = truncate(tArgs.focus, 72);
  } else if (tName === 'update_steps' && Array.isArray(tArgs.steps)) {
    const activeStep = tArgs.steps.find((s) => s && s.status === 'in_progress' && s.title);
    detail = activeStep ? truncate(activeStep.title, 68) : 'Обновляю план…';
  } else if (tName === 'read_file' && tArgs.Path) {
    detail = `Читаю ${truncate(shortBase(tArgs.Path), 42)}…`;
  } else if (tName === 'edit_file' && tArgs.Path) {
    detail = `Редактирую ${truncate(shortBase(tArgs.Path), 38)}…`;
  } else if (tName === 'write_file' && tArgs.Path) {
    detail = `Записываю ${truncate(shortBase(tArgs.Path), 38)}…`;
  } else if (tName === 'run_command') {
    if (tArgs.toolSummary) {
      detail = truncate(tArgs.toolSummary, 64);
    } else if (tArgs.CommandLine) {
      detail = `Команда: ${truncate(tArgs.CommandLine, 42)}`;
    } else {
      detail = TOOL_LABELS.run_command;
    }
  } else if (tName === 'search_web' && tArgs.query) {
    detail = `Ищу: ${truncate(tArgs.query, 48)}`;
  } else if (tName === 'call_mcp_tool' && tArgs.ToolName) {
    detail = `MCP: ${truncate(tArgs.ToolName, 44)}…`;
  } else if (tName === 'invoke_subagent' && (tArgs.Role || tArgs.TypeName)) {
    detail = `Агент: ${truncate(tArgs.Role || tArgs.TypeName, 44)}…`;
  } else {
    detail = TOOL_LABELS[tName] || `Инструмент: ${truncate(tName, 40)}…`;
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const now = Date.now();
let startedAt = targetState === 'working' ? now : null;

// Preserve original startedAt if already working so elapsed timer stays continuous
if (targetState === 'working' && fs.existsSync(STATUS_FILE)) {
  try {
    const prev = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    if (prev.state === 'working' && prev.startedAt && (now - (prev.updatedAt || 0) < 180000)) {
      startedAt = prev.startedAt;
    }
  } catch {}
}

const nextData = {
  state: targetState,
  detail,
  startedAt,
  updatedAt: now
};

// Atomic-ish write to both PLUGIN_DATA and PLUGIN_ROOT/data so any reader sees live updates
const TARGET_FILES = Array.from(new Set([
  STATUS_FILE,
  path.join(PLUGIN_ROOT, 'data', 'status.json')
]));

const jsonStr = JSON.stringify(nextData);
for (const filePath of TARGET_FILES) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, jsonStr, 'utf8');
    fs.renameSync(tmp, filePath);
  } catch {
    try {
      fs.writeFileSync(filePath, jsonStr, 'utf8');
    } catch {}
  }
}

// Hooks contract requires a JSON object on stdout
process.stdout.write('{}\n');
