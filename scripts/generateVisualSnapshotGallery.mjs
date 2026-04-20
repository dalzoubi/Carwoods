#!/usr/bin/env node
/**
 * Builds a single HTML page listing every PNG under e2e/visual/*-snapshots/
 * with a human-readable title derived from snapshot naming conventions.
 *
 * When Playwright wrote failure artifacts (`*-actual.png`, `*-diff.png`) under
 * test-results/, the gallery shows baseline vs last-run actual (and optional diff).
 *
 * Run after visual tests via npm run test:visual / test:visual:update.
 *
 * Output: e2e/visual/visual-gallery.html (next to snapshot folders). Browsers often
 * block file:// loads that traverse `../`; paths stay under e2e/visual/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VISUAL_DIR = path.join(ROOT, 'e2e', 'visual');
const TEST_RESULTS_DIR = path.join(ROOT, 'test-results');
const OUT_HTML = path.join(VISUAL_DIR, 'visual-gallery.html');
const RUNTIME_IMG_DIR = path.join(VISUAL_DIR, '.gallery-runtime');

/** Must stay aligned with e2e/visual/fixtures.mjs VIEWPORTS */
const VIEWPORT_DETAIL = {
  mobile: '375 × 812',
  tablet: '768 × 1024',
  desktop: '1440 × 900',
};

/** Marketing routes — keep in sync with e2e/visual/marketing.visual.spec.mjs */
const MARKETING_PATHS = {
  home: '/',
  apply: '/apply',
  features: '/features',
  pricing: '/pricing',
  'contact-us': '/contact-us',
  'property-management': '/property-management',
  'for-property-managers': '/for-property-managers',
  'tenant-selection-criteria': '/tenant-selection-criteria',
  'application-required-documents': '/application-required-documents',
  privacy: '/privacy',
  'terms-of-service': '/terms-of-service',
  accessibility: '/accessibility',
};

const ADMIN_PATHS = {
  'admin-config': '/portal/admin/config',
  'admin-landlords-guard': '/portal/admin/landlords',
  'admin-notification-test-guard': '/portal/admin/health/notification-test',
};

const PORTAL_PATHS = {
  dashboard: '/portal',
  profile: '/portal/profile',
  requests: '/portal/requests',
  payments: '/portal/payments',
  documents: '/portal/documents',
  status: '/portal/status',
  inbox: '/portal/inbox',
  'inbox-notifications': '/portal/inbox/notifications',
  tenants: '/portal/tenants',
  properties: '/portal/properties',
  notices: '/portal/notices',
  'login-landing': '/portal (login landing — session cleared)',
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Strip Playwright snapshot suffix from basename (no .png).
 * Example: marketing-home-mobile-visual-chromium → marketing-home-mobile
 */
function snapshotStem(basename) {
  return basename.replace(/\.png$/i, '').replace(/-visual-chromium$/i, '');
}

function extractViewport(stem) {
  const m = stem.match(/^(.*)-(mobile|tablet|desktop)$/);
  if (!m) return null;
  return { rest: m[1], viewport: m[2] };
}

function titleCaseSlug(slug) {
  return slug
    .split(/[-_]/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * @returns {{ headline: string, subline: string } | null}
 */
function describeStem(stem) {
  if (stem === 'sanity-home-desktop') {
    return {
      headline: 'Sanity — Home (desktop)',
      subline:
        'Light mode · Full-page capture · Route `/` — ensures the marketing suite still produces at least one desktop baseline.',
    };
  }

  const vp = extractViewport(stem);
  if (!vp) return null;

  const { rest, viewport } = vp;
  const vpLabel = VIEWPORT_DETAIL[viewport]
    ? `${viewport} (${VIEWPORT_DETAIL[viewport]})`
    : viewport;

  if (rest.startsWith('marketing-')) {
    const body = rest.slice('marketing-'.length);
    let theme = 'light';
    let slug = body;
    if (body.endsWith('-dark')) {
      theme = 'dark';
      slug = body.slice(0, -'-dark'.length);
    }
    const route = MARKETING_PATHS[slug];
    const routeBit = route ? `\`${route}\`` : slug;
    const themeBit = theme === 'dark' ? 'Dark preview (`/dark/…`)' : 'Light';
    return {
      headline: `Marketing · ${titleCaseSlug(slug)} · ${viewport}`,
      subline: `${themeBit} · Full-page screenshot · Route ${routeBit} · Viewport ${vpLabel}`,
    };
  }

  if (rest.startsWith('admin-')) {
    const slug = rest.slice('admin-'.length);
    const route = ADMIN_PATHS[slug];
    const routeBit = route ? `\`${route}\`` : slug;
    return {
      headline: `Admin portal · ${titleCaseSlug(slug)} · ${viewport}`,
      subline: `Landlord dev-auth · ${routeBit} · Viewport ${vpLabel}`,
    };
  }

  if (rest.startsWith('portal-')) {
    const slug = rest.slice('portal-'.length);
    const route = PORTAL_PATHS[slug];
    const routeBit = route ? `\`${route}\`` : slug;
    return {
      headline: `Tenant portal · ${titleCaseSlug(slug)} · ${viewport}`,
      subline: `PORTAL_E2E build · ${routeBit} · Viewport ${vpLabel}`,
    };
  }

  return {
    headline: stem,
    subline: `Viewport ${vpLabel}`,
  };
}

function collectSnapshotFiles() {
  const entries = [];
  if (!fs.existsSync(VISUAL_DIR)) return entries;

  for (const name of fs.readdirSync(VISUAL_DIR, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    if (!name.name.endsWith('.mjs-snapshots')) continue;
    const dir = path.join(VISUAL_DIR, name.name);
    for (const file of fs.readdirSync(dir)) {
      if (!file.toLowerCase().endsWith('.png')) continue;
      entries.push({
        folder: name.name,
        file,
        abs: path.join(dir, file),
        stem: snapshotStem(file),
      });
    }
  }

  entries.sort((a, b) => {
    const s = a.folder.localeCompare(b.folder);
    if (s !== 0) return s;
    return a.stem.localeCompare(b.stem);
  });

  return entries;
}

/**
 * Playwright writes `stem-actual.png` (and usually `stem-diff.png` beside it) under
 * test-results/ when a screenshot assertion fails. `stem` matches the snapshot name
 * used in fixtures (e.g. marketing-home-mobile), same as our baseline stem.
 *
 * @returns {Map<string, { actual: string, diff?: string }>}
 */
function collectLastRunComparisons() {
  /** @type {Map<string, { actual: string, diff?: string, mtime: number }>} */
  const byStem = new Map();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(p);
        continue;
      }
      if (!ent.name.endsWith('-actual.png')) continue;
      const stem = ent.name.slice(0, -'-actual.png'.length);
      let stat;
      try {
        stat = fs.statSync(p);
      } catch {
        continue;
      }
      const diffPath = path.join(path.dirname(p), `${stem}-diff.png`);
      const diff = fs.existsSync(diffPath) ? diffPath : undefined;
      const prev = byStem.get(stem);
      if (!prev || stat.mtimeMs >= prev.mtime) {
        byStem.set(stem, { actual: p, diff, mtime: stat.mtimeMs });
      }
    }
  }

  walk(TEST_RESULTS_DIR);

  /** @type {Map<string, { actual: string, diff?: string }>} */
  const out = new Map();
  for (const [stem, v] of byStem) {
    out.set(stem, { actual: v.actual, diff: v.diff });
  }
  return out;
}

/**
 * Copy last-run failure PNGs next to the HTML so img src avoids `../../test-results/`
 * (also blocked under file:// for many browsers).
 *
 * @returns {Map<string, { actualSrc: string, diffSrc?: string }>}
 */
function prepareComparisonAssets(comparisons) {
  /** @type {Map<string, { actualSrc: string, diffSrc?: string }>} */
  const urls = new Map();

  fs.rmSync(RUNTIME_IMG_DIR, { recursive: true, force: true });
  if (comparisons.size === 0) return urls;

  fs.mkdirSync(RUNTIME_IMG_DIR, { recursive: true });

  for (const [stem, v] of comparisons) {
    const actualName = `${stem}-actual.png`;
    const actualDest = path.join(RUNTIME_IMG_DIR, actualName);
    fs.copyFileSync(v.actual, actualDest);

    const entry = {
      actualSrc: `./.gallery-runtime/${actualName}`,
    };
    if (v.diff) {
      const diffName = `${stem}-diff.png`;
      fs.copyFileSync(v.diff, path.join(RUNTIME_IMG_DIR, diffName));
      entry.diffSrc = `./.gallery-runtime/${diffName}`;
    }
    urls.set(stem, entry);
  }

  return urls;
}

/**
 * Paths for <img src> relative to OUT_HTML (`e2e/visual/visual-gallery.html`).
 * Prefix `./` so file:// resolves reliably.
 */
function relFromGallery(absPath) {
  let r = path.relative(path.dirname(OUT_HTML), absPath).split(path.sep).join('/');
  if (r && !r.startsWith('.') && !path.isAbsolute(r)) {
    r = `./${r}`;
  }
  return r;
}

function sectionTitleFromFolder(folderName) {
  const spec = folderName.replace(/\.mjs-snapshots$/i, '');
  if (spec === 'marketing.visual.spec') return 'Marketing site (public routes)';
  if (spec === 'admin.visual.spec') return 'Admin / guard screens';
  if (spec === 'portal.visual.spec') return 'Tenant portal (authenticated)';
  return spec;
}

function buildHtml(items, comparisons, comparisonAssets) {
  const generatedAt = new Date().toISOString();

  let mismatchCount = 0;
  for (const item of items) {
    if (comparisons.has(item.stem) && comparisonAssets.has(item.stem)) mismatchCount += 1;
  }

  let body = '';
  let currentFolder = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nextFolder = i + 1 < items.length ? items[i + 1].folder : null;

    if (item.folder !== currentFolder) {
      currentFolder = item.folder;
      body += `  <section class="suite">\n`;
      body += `    <h2>${escapeHtml(sectionTitleFromFolder(item.folder))}</h2>\n`;
      body += `    <p class="suite-meta">${escapeHtml(item.folder)}</p>\n`;
    }

    const meta = describeStem(item.stem);
    const headline = meta?.headline ?? item.stem;
    const subline = meta?.subline ?? '';
    const cmp = comparisons.get(item.stem);
    const asset = comparisonAssets.get(item.stem);
    const showCompare = cmp && asset;
    const mismatchClass = showCompare ? ' shot-mismatch' : '';

    body += `    <article class="shot${mismatchClass}">\n`;
    body += `      <header class="shot-head">\n`;
    body += `        <h3>${escapeHtml(headline)}</h3>\n`;
    if (subline) body += `        <p class="sub">${escapeHtml(subline)}</p>\n`;
    body += `        <p class="file"><code>${escapeHtml(item.file)}</code></p>\n`;
    if (showCompare) {
      body += `        <p class="compare-badge">Last run differed — baseline vs captured below (copied from <code>test-results/</code> into <code>.gallery-runtime/</code>).</p>\n`;
    }
    body += `      </header>\n`;

    if (showCompare) {
      body += `      <div class="compare-grid">\n`;
      body += `        <div class="compare-cell">\n`;
      body += `          <h4>Baseline (expected)</h4>\n`;
      body += `          <div class="compare-img">\n`;
        body += `            <img src="${escapeHtml(relFromGallery(item.abs))}" alt="Baseline: ${escapeHtml(headline)}" loading="lazy" />\n`;
      body += `          </div>\n`;
      body += `        </div>\n`;
      body += `        <div class="compare-cell">\n`;
      body += `          <h4>Last run (actual)</h4>\n`;
      body += `          <div class="compare-img">\n`;
      body += `            <img src="${escapeHtml(asset.actualSrc)}" alt="Actual: ${escapeHtml(headline)}" loading="lazy" />\n`;
      body += `          </div>\n`;
      body += `        </div>\n`;
      if (asset.diffSrc) {
        body += `        <div class="compare-cell compare-diff">\n`;
        body += `          <h4>Diff (Playwright)</h4>\n`;
        body += `          <div class="compare-img">\n`;
        body += `            <img src="${escapeHtml(asset.diffSrc)}" alt="Diff: ${escapeHtml(headline)}" loading="lazy" />\n`;
        body += `          </div>\n`;
        body += `        </div>\n`;
      }
      body += `      </div>\n`;
    } else {
      body += `      <div class="shot-img-wrap">\n`;
      body += `        <img src="${escapeHtml(relFromGallery(item.abs))}" alt="${escapeHtml(headline)}" loading="lazy" />\n`;
      body += `      </div>\n`;
    }
    body += `    </article>\n`;

    if (nextFolder !== currentFolder) {
      body += `  </section>\n`;
    }
  }

  const compareHint =
    mismatchCount > 0
      ? `${mismatchCount} baseline${mismatchCount === 1 ? '' : 's'} include a last-run capture from test-results/ (before · after · diff).`
      : 'No <code>*-actual.png</code> files in <code>test-results/</code> — after a failed visual run, reopen this page to see baseline vs captured side by side.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Visual regression gallery — Carwoods</title>
  <style>
    :root {
      --bg: #0f1419;
      --surface: #1a2332;
      --text: #e7ecf3;
      --muted: #9aa8bc;
      --accent: #6cb4ee;
      --border: #2d3a4d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .page-head {
      position: sticky;
      top: 0;
      z-index: 10;
      padding: 1.25rem 1.5rem;
      background: linear-gradient(180deg, var(--surface) 0%, rgba(26,35,50,0.97) 100%);
      border-bottom: 1px solid var(--border);
    }
    .page-head h1 {
      margin: 0 0 0.35rem;
      font-size: 1.35rem;
      font-weight: 650;
    }
    .page-head .meta {
      margin: 0;
      font-size: 0.875rem;
      color: var(--muted);
    }
    .page-head .meta-second {
      margin-top: 0.5rem;
      font-size: 0.8125rem;
    }
    main {
      padding: 1rem 1.25rem 3rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    section.suite {
      margin-bottom: 2.5rem;
    }
    section.suite > h2 {
      margin: 0 0 0.25rem;
      font-size: 1.15rem;
      color: var(--accent);
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.35rem;
    }
    .suite-meta {
      margin: 0 0 1rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    article.shot {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 1.25rem;
      overflow: hidden;
    }
    .shot-head {
      padding: 1rem 1.1rem;
      border-bottom: 1px solid var(--border);
    }
    .shot-head h3 {
      margin: 0 0 0.35rem;
      font-size: 1rem;
      font-weight: 600;
    }
    .shot-head .sub {
      margin: 0 0 0.5rem;
      font-size: 0.875rem;
      color: var(--muted);
    }
    .shot-head .file {
      margin: 0;
      font-size: 0.75rem;
      color: var(--muted);
    }
    .shot-head code {
      font-size: 0.75rem;
      word-break: break-all;
    }
    .shot-img-wrap {
      padding: 0.75rem;
      background: #0b0f14;
      overflow: auto;
      text-align: center;
    }
    .shot-img-wrap img {
      max-width: 100%;
      height: auto;
      vertical-align: middle;
      border-radius: 6px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    }
    article.shot-mismatch {
      border-color: #8b7355;
      box-shadow: 0 0 0 1px rgba(212, 165, 116, 0.25);
    }
    .compare-badge {
      margin: 0.6rem 0 0;
      font-size: 0.8rem;
      color: #e8c49a;
    }
    .compare-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      padding: 0.75rem;
      background: #0b0f14;
      align-items: start;
    }
    .compare-cell h4 {
      margin: 0 0 0.5rem;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .compare-img {
      overflow: auto;
      text-align: center;
      padding: 0.35rem;
      background: rgba(0,0,0,0.25);
      border-radius: 8px;
    }
    .compare-img img {
      max-width: 100%;
      height: auto;
      vertical-align: middle;
      border-radius: 6px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    }
    .compare-diff .compare-img {
      background: rgba(255, 80, 80, 0.06);
    }
  </style>
</head>
<body>
  <header class="page-head">
    <h1>Visual regression gallery</h1>
    <p class="meta">${escapeHtml(items.length)} baseline screenshot${items.length === 1 ? '' : 's'} · Generated ${escapeHtml(generatedAt)} · Save as <code>e2e/visual/visual-gallery.html</code> and open locally (paths stay under <code>e2e/visual/</code> so images load over <code>file://</code>).</p>
    <p class="meta meta-second">${compareHint}</p>
  </header>
  <main>
${body}
  </main>
</body>
</html>
`;
}

function writePlaywrightReportRedirectStub() {
  const dir = path.join(ROOT, 'playwright-report');
  fs.mkdirSync(dir, { recursive: true });
  const stubPath = path.join(dir, 'visual-gallery.html');
  fs.writeFileSync(
    stubPath,
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=../e2e/visual/visual-gallery.html" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Visual gallery — redirect</title>
</head>
<body style="margin: 2rem; font-family: system-ui, sans-serif; background: #111; color: #eee;">
  <p>The gallery HTML now lives next to snapshots (fixes blank images under <code>file://</code>):</p>
  <p><a href="../e2e/visual/visual-gallery.html" style="color:#8cf">Open e2e/visual/visual-gallery.html</a></p>
  <script>location.replace("../e2e/visual/visual-gallery.html");</script>
</body>
</html>
`,
    'utf8',
  );
}

function main() {
  const items = collectSnapshotFiles();
  const comparisons = collectLastRunComparisons();
  const comparisonAssets = prepareComparisonAssets(comparisons);
  const outDir = path.dirname(OUT_HTML);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_HTML, buildHtml(items, comparisons, comparisonAssets), 'utf8');
  writePlaywrightReportRedirectStub();
  const withCompare = [...comparisons.keys()].filter((k) => items.some((i) => i.stem === k)).length;
  console.log(
    `Visual gallery written to ${path.relative(ROOT, OUT_HTML)} (${items.length} screenshots${withCompare ? `, ${withCompare} with last-run comparison` : ''}).`,
  );
}

main();
