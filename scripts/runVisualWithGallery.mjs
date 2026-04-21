#!/usr/bin/env node
/**
 * Runs the visual-chromium Playwright project, then always refreshes
 * playwright-report/visual-gallery.html. Exits with Playwright's exit code so CI still fails on red runs.
 *
 * Forward extra CLI args to Playwright (e.g. `--update-snapshots`).
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const extraArgs = process.argv.slice(2);

const env = { ...process.env, PORTAL_E2E: 'true' };

const pw = spawnSync(
  'npx',
  ['playwright', 'test', '--project=visual-chromium', ...extraArgs],
  { cwd: ROOT, stdio: 'inherit', env, shell: true },
);

const code = pw.status ?? 1;

spawnSync(process.execPath, [path.join(__dirname, 'generateVisualSnapshotGallery.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});

process.exit(code);
