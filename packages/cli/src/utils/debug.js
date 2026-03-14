/**
 * 调试日志工具
 *
 * 使用：DEBUG=1 pnpm cli:dev
 * 日志文件：~/.pokemon-cli/debug.log
 * 另开终端：tail -f ~/.pokemon-cli/debug.log  (或 Get-Content -Wait)
 */
import { appendFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_PATH = join(homedir(), '.pokemon-cli', 'debug.log');
const ENABLED = process.env.DEBUG === '1';

function ensureDir() {
  const dir = join(homedir(), '.pokemon-cli');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function fmt(arg) {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'object') {
    try { return JSON.stringify(arg, null, 0); } catch { return String(arg); }
  }
  return String(arg);
}

export const debug = ENABLED
  ? (...args) => {
      ensureDir();
      const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
      appendFileSync(LOG_PATH, `[${ts}] ${args.map(fmt).join(' ')}\n`);
    }
  : () => {};

export const debugClear = ENABLED
  ? () => { ensureDir(); writeFileSync(LOG_PATH, `--- session start ${new Date().toISOString()} ---\n`); }
  : () => {};
