// Smoke test: spawn electron, wait for the "did-finish-load" marker, then quit.
// Fails if the process errors or doesn't signal within the timeout.
const { spawn } = require('node:child_process');
const path = require('node:path');

const electron = require('electron');
const projectRoot = path.join(__dirname, '..');

const TIMEOUT_MS = 30_000;
const READY_MARKER = 'HUSH_SMOKE_READY';
const INJECT_FLAG = '--hush-smoke';

const args = ['.', INJECT_FLAG];
const child = spawn(electron, args, {
  cwd: projectRoot,
  env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', HUSH_SMOKE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let settled = false;
const timer = setTimeout(() => {
  if (!settled) {
    settled = true;
    console.error(`[smoke] no ready marker within ${TIMEOUT_MS}ms`);
    try { child.kill('SIGKILL'); } catch {}
    process.exit(1);
  }
}, TIMEOUT_MS);

function finish(code) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  try { child.kill('SIGTERM'); } catch {}
  process.exit(code);
}

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (text.includes(READY_MARKER)) finish(0);
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
child.on('error', (err) => {
  console.error('[smoke] failed to spawn electron:', err);
  finish(1);
});
child.on('exit', (code) => {
  if (!settled) {
    console.error(`[smoke] electron exited early with code ${code}`);
    finish(code && code !== 0 ? 1 : 1);
  }
});
