#!/usr/bin/env node
/**
 * electron-dev.cjs
 * Waits for the Vite dev server, then launches Electron with NODE_ENV=development.
 * This guarantees NODE_ENV is set on the Electron process regardless of shell &&-chaining quirks.
 */
const { spawn } = require('child_process');
const http = require('http');

const VITE_URL = 'http://localhost:5173';
const POLL_MS = 300;
const TIMEOUT_MS = 30000;

function checkServer(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => resolve(true)).on('error', () => resolve(false));
  });
}

async function waitForVite() {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ready = await checkServer(VITE_URL);
    if (ready) return;
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Error(`Vite server at ${VITE_URL} did not start within ${TIMEOUT_MS}ms`);
}

(async () => {
  console.log('[electron-dev] Waiting for Vite dev server...');
  await waitForVite();
  console.log('[electron-dev] Vite ready! Launching Electron with NODE_ENV=development');

  // The `electron` package exports the path to the Electron executable as its default export
  const electronPath = require('electron');
  const child = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });

  child.on('close', (code) => process.exit(code ?? 0));
})();
