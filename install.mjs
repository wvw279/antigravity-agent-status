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
    console.log('      -> Enabled activity-indicator in config.json');
  } catch (e) {
    console.warn('      [!] Could not update config.json:', e.message);
  }
}

console.log('==========================================================');
console.log('  Installing Agent Status (v1.7.0) for Antigravity');
console.log('==========================================================\n');

if (!fs.existsSync(PAYLOAD_DIR)) {
  console.error('[ERROR] The payload folder was not found next to the installer.');
  console.error('Please extract the entire ZIP archive before running INSTALL.bat!');
  process.exit(1);
}

const asarPath = resolveAsarPath();
if (!fs.existsSync(asarPath)) {
  console.error('[ERROR] Antigravity app.asar not found at:');
  console.error('  ' + asarPath);
  console.error('Use the Browse button in the installer window to select Antigravity.exe.');
  process.exit(1);
}

console.log('[1/4] Copying plugin files, hooks, and animation presets...');
copyDirRecursive(PAYLOAD_DIR, PLUGIN_DIR);
fs.mkdirSync(path.join(PLUGIN_DIR, 'data'), { recursive: true });
console.log('      -> ' + PLUGIN_DIR);

console.log('\n[2/4] Enabling plugin in Antigravity configuration...');
enablePluginInConfig();

const sdkPath = path.join(PLUGIN_DIR, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json');
if (!fs.existsSync(sdkPath)) {
  console.log('\n[3/4] Installing local server dependencies (npm install)...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmCmd, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: PLUGIN_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (res.status !== 0) {
    console.error('\n[ERROR] Failed to install npm dependencies.');
    console.error('Please check your internet connection and run INSTALL.bat again.');
    process.exit(1);
  }
} else {
  console.log('\n[3/4] Local server dependencies are already installed — skipping.');
}

console.log('\n[4/4] Injecting standalone panel loader into Antigravity...');
console.log('      -> ' + asarPath);
const patcherScript = path.join(PLUGIN_DIR, 'patch-asar.mjs');
try {
  execFileSync(process.execPath, [patcherScript, '--asar=' + asarPath], { stdio: 'inherit' });
} catch (err) {
  console.error('\n[ERROR] Failed to patch app.asar.');
  console.error('Make sure Antigravity is completely closed and try again.');
  process.exit(1);
}

console.log('\n[DONE] Agent Status (v1.7.0) installed successfully!');
