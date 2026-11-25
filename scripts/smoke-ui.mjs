#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.SMOKE_URL || 'http://localhost:3000';
const SESSION = `smoke_${Date.now().toString(36)}`;

function pw(...args) {
  return execFileSync('playwright-cli', [`-s=${SESSION}`, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 45_000,
  });
}

function pwEval(fnSource) {
  const out = pw('eval', fnSource);
  const marker = '### Result';
  const idx = out.indexOf(marker);
  if (idx === -1) return out.trim();
  const tail = out.slice(idx + marker.length).trim();
  const endIdx = tail.indexOf('\n### ');
  const raw = (endIdx === -1 ? tail : tail.slice(0, endIdx)).trim();
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  } catch {
    return raw;
  }
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`Smoke assertion failed: ${msg}`);
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

let failed = false;
try {
  console.log(`🔎 Running desktop + mobile portrait + iPhone landscape UI smoke test against ${URL} ...`);

  // 1. Open Desktop 1440x900
  pw('open', URL);
  pw('resize', '1440', '900');
  sleep(800);

  // Install runtime error collector & dismiss boot splash if visible
  const bootInfo = pwEval(`() => {
    window.__smokeErrors = [];
    window.addEventListener('error', (e) => window.__smokeErrors.push(e.message || String(e)));
    window.addEventListener('unhandledrejection', (e) => window.__smokeErrors.push(String(e.reason || e)));
    const buttons = Array.from(document.querySelectorAll('button'))
      .filter((b) => !b.disabled)
      .map((b) => (b.textContent || '').trim())
      .filter(Boolean);
    return JSON.stringify({
      title: document.title,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      buttonCount: buttons.length,
    });
  }`);
  assert(bootInfo && bootInfo.buttonCount > 0, 'Title screen should render interactive buttons');
  assert(bootInfo.overflowX <= 2, `Desktop title screen has horizontal overflow (${bootInfo.overflowX}px)`);
  console.log(`  ✓ Desktop title screen loaded (${bootInfo.buttonCount} controls, overflowX=${bootInfo.overflowX}px)`);

  // 2. Advance through Title Menu ("Yeni Oyun") -> Scenario/Country Start ("Seferi Başlat") -> Live Map
  for (let step = 0; step < 5; step++) {
    const state = pwEval(`() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const mapCanvas = canvases.find((c) => {
        const r = c.getBoundingClientRect();
        return r.width >= 300 && r.height >= 300;
      });
      const btns = Array.from(document.querySelectorAll('button')).filter((b) => !b.disabled);
      const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').trim();
      const startBtn =
        btns.find((b) => norm(b.textContent).includes('ile seferi başlat')) ||
        btns.find((b) => norm(b.textContent) === 'seferi başlat') ||
        btns.find((b) => norm(b.textContent).includes('yeni oyun')) ||
        btns.find((b) => norm(b.textContent).includes('seferi başlat'));
      if (startBtn) {
        startBtn.click();
        return JSON.stringify({ inGame: false, clicked: startBtn.textContent.trim() });
      }
      if (mapCanvas) {
        const r = mapCanvas.getBoundingClientRect();
        return JSON.stringify({ inGame: true, w: Math.round(r.width), h: Math.round(r.height) });
      }
      return JSON.stringify({ inGame: false, clicked: null });
    }`);
    if (state && state.inGame) break;
    sleep(800);
  }

  // Wait for world map to initialize and render
  sleep(700);
  const desktopGame = pwEval(`() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const mapCanvas = canvases.find((c) => {
      const r = c.getBoundingClientRect();
      return r.width >= 300 && r.height >= 300;
    });
    const rect = mapCanvas ? mapCanvas.getBoundingClientRect() : null;
    return JSON.stringify({
      hasCanvas: Boolean(mapCanvas && rect && rect.width >= 300 && rect.height >= 300),
      canvasSize: rect ? [Math.round(rect.width), Math.round(rect.height)] : null,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      errors: window.__smokeErrors || [],
    });
  }`);
  assert(desktopGame.hasCanvas, `Map canvas not rendered cleanly on desktop: ${JSON.stringify(desktopGame)}`);
  assert(desktopGame.overflowX <= 2, `Desktop in-game view has horizontal overflow (${desktopGame.overflowX}px)`);
  assert((desktopGame.errors || []).length === 0, `Desktop runtime errors: ${JSON.stringify(desktopGame.errors)}`);
  console.log(`  ✓ Desktop campaign map rendered (${desktopGame.canvasSize?.join('x')}, overflowX=${desktopGame.overflowX}px, 0 errors)`);

  // 3. Test illustrated Construction Drawer, queue 2 buildings sequentially, and verify corner ProductionQueueHudWidget
  const buildCheck = pwEval(`() => {
    const btns = Array.from(document.querySelectorAll('button')).filter((b) => !b.disabled);
    const bldBtn = btns.find((b) => {
      const txt = ((b.textContent || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.getAttribute('aria-label') || '')).toLocaleLowerCase('tr-TR');
      return txt.includes('inşaat');
    });
    if (bldBtn) bldBtn.click();
    return JSON.stringify({ clicked: Boolean(bldBtn) });
  }`);
  sleep(500);

  const constructionVisuals = pwEval(`() => {
    const drawer = document.querySelector('[data-testid="construction-drawer"]');
    if (!drawer) return JSON.stringify({ found: false });
    const imgs = Array.from(drawer.querySelectorAll('img'));
    const loadedImgs = imgs.filter((img) => img.complete && img.naturalWidth > 0).length;
    // Queue 1st building (factory) in first eligible city
    const firstCityBtn = drawer.querySelector('[data-testid^="construct-city-btn-"]:not([disabled])');
    if (firstCityBtn) firstCityBtn.click();
    return JSON.stringify({
      found: true,
      imgCount: imgs.length,
      loadedImgs,
      queuedFirst: Boolean(firstCityBtn),
    });
  }`);
  sleep(250);

  // Select 2nd building (barracks) and queue it in the same city to form a sequential queue
  pwEval(`() => {
    const barracksItem = document.querySelector('[data-testid="construction-item-bld:barracks"]');
    if (barracksItem) barracksItem.click();
    return JSON.stringify({ selectedSecond: Boolean(barracksItem) });
  }`);
  sleep(200);
  pwEval(`() => {
    const drawer = document.querySelector('[data-testid="construction-drawer"]');
    const firstCityBtn = drawer?.querySelector('[data-testid^="construct-city-btn-"]:not([disabled])');
    if (firstCityBtn) firstCityBtn.click();
    return JSON.stringify({ queuedSecond: Boolean(firstCityBtn) });
  }`);
  sleep(200);
  pw('press', 'Escape');
  sleep(250);

  // Advance time briefly at 5x so percentage progresses
  pw('press', '5');
  sleep(700);
  pw('press', ' '); // pause

  const queueHudCheck = pwEval(`() => {
    const hud = document.querySelector('[data-testid="production-queue-hud"]');
    const pctEl = document.querySelector('[data-testid="production-queue-lead-pct"]');
    const trailEl = document.querySelector('[data-testid="production-queue-trail"]');
    const rect = hud ? hud.getBoundingClientRect() : null;
    const oldSiyasiBtn = document.querySelector('[aria-label="Harita katmanlarını aç veya kapat"]');
    const minimapDock = document.querySelector('[data-testid="minimap-hud-dock"]');
    const minimapHud = document.querySelector('[data-testid="aoh3-minimap-hud"]');
    const minimapCanvas = document.querySelector('[data-testid="aoh3-minimap-canvas"]');
    const modeBtns = document.querySelectorAll('[data-testid="minimap-mapmode-frame"] button');
    const collapseBtn = document.querySelector('[data-testid="minimap-collapse-btn"]');
    const dockZ = minimapDock ? Number(getComputedStyle(minimapDock).zIndex) || 0 : 999;
    return JSON.stringify({
      visible: Boolean(hud && rect && rect.width > 100 && rect.height > 30),
      pctText: pctEl ? pctEl.textContent?.trim() : null,
      hasBehindQueueTrail: Boolean(trailEl),
      oldSiyasiRemoved: !oldSiyasiBtn,
      minimapVisible: Boolean(minimapHud && minimapCanvas && minimapCanvas.getBoundingClientRect().width >= 140),
      modeIconCount: modeBtns.length,
      hasCollapseBtn: Boolean(collapseBtn),
      dockZUnderMenus: dockZ > 0 && dockZ < 40,
      errors: window.__smokeErrors || [],
    });
  }`);
  assert(buildCheck?.clicked && constructionVisuals?.found, `Construction drawer failed to open: ${JSON.stringify(constructionVisuals)}`);
  assert(constructionVisuals.imgCount >= 8 && constructionVisuals.loadedImgs >= 8, `Construction artwork images did not load: ${JSON.stringify(constructionVisuals)}`);
  assert(queueHudCheck?.visible, `Corner ProductionQueueHudWidget not visible after queuing construction: ${JSON.stringify(queueHudCheck)}`);
  assert(queueHudCheck.hasBehindQueueTrail, `Queued second building should appear behind active item in corner HUD: ${JSON.stringify(queueHudCheck)}`);
  assert(queueHudCheck.oldSiyasiRemoved, 'Old top-left Siyasi dropdown button should be removed');
  assert(queueHudCheck.minimapVisible && queueHudCheck.modeIconCount === 10 && queueHudCheck.hasCollapseBtn, `Minimap HUD incomplete: ${JSON.stringify(queueHudCheck)}`);
  assert(queueHudCheck.dockZUnderMenus, `Minimap & notifications dock z-index must stay under open menus (<40): ${JSON.stringify(queueHudCheck)}`);
  console.log(`  ✓ Illustrated Construction (${constructionVisuals.loadedImgs}/${constructionVisuals.imgCount}), Corner Queue (${queueHudCheck.pctText}), & Minimap HUD (10 icons, z<40) verified`);

  // Verify minimap collapse toggle & map-mode icon switching
  const minimapInteract = pwEval(`() => {
    const ecoBtn = document.querySelector('[data-testid="minimap-mode-ECONOMIC"]');
    if (ecoBtn) ecoBtn.click();
    const collapseBtn = document.querySelector('[data-testid="minimap-collapse-btn"]');
    if (collapseBtn) collapseBtn.click();
    const collapsedNoCanvas = !document.querySelector('[data-testid="aoh3-minimap-canvas"]');
    if (collapseBtn) collapseBtn.click();
    const restoredCanvas = Boolean(document.querySelector('[data-testid="aoh3-minimap-canvas"]'));
    const polBtn = document.querySelector('[data-testid="minimap-mode-POLITICAL"]');
    if (polBtn) polBtn.click();
    return JSON.stringify({ collapsedNoCanvas, restoredCanvas });
  }`);
  assert(minimapInteract.collapsedNoCanvas && minimapInteract.restoredCanvas, `Minimap collapse toggle failed: ${JSON.stringify(minimapInteract)}`);

  const drawerResults = [];
  for (const label of ['ekonomi', 'teknoloji', 'diplomasi', 'ordu']) {
    const opened = pwEval(`() => {
      const btns = Array.from(document.querySelectorAll('button')).filter((b) => !b.disabled);
      const btn = btns.find((b) => {
        const txt = ((b.textContent || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.getAttribute('aria-label') || '')).toLocaleLowerCase('tr-TR');
        return txt.includes(${JSON.stringify(label)});
      });
      if (btn) { btn.click(); return JSON.stringify({ found: true }); }
      return JSON.stringify({ found: false });
    }`);
    sleep(220);
    drawerResults.push(`${label}:${opened?.found ? 'ok' : 'skip'}`);
    pw('press', 'Escape');
    sleep(100);
  }
  console.log(`  ✓ Desktop 5x tick & lazy drawers checked (${drawerResults.join(', ')})`);

  // 4. Switch to Mobile Portrait 390x844 (iPhone 14/15 Portrait)
  pw('resize', '390', '844');
  sleep(400);
  const mobileCheck = pwEval(`() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const mapCanvas = canvases.find((c) => {
      const r = c.getBoundingClientRect();
      return r.width >= 300 && r.height >= 300;
    });
    const rect = mapCanvas ? mapCanvas.getBoundingClientRect() : null;
    return JSON.stringify({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      canvasVisible: Boolean(mapCanvas && rect && rect.width >= 300 && rect.height >= 300),
      canvasSize: rect ? [Math.round(rect.width), Math.round(rect.height)] : null,
      errors: window.__smokeErrors || [],
    });
  }`);
  assert(mobileCheck.canvasVisible, `Map canvas missing on mobile portrait viewport: ${JSON.stringify(mobileCheck)}`);
  assert(mobileCheck.overflowX <= 2, `Mobile portrait viewport has horizontal overflow (${mobileCheck.overflowX}px)`);
  assert((mobileCheck.errors || []).length === 0, `Runtime errors detected on mobile portrait: ${JSON.stringify(mobileCheck.errors)}`);
  console.log(`  ✓ iPhone Portrait 390x844 layout verified (canvas ${mobileCheck.canvasSize?.join('x')}, overflowX=${mobileCheck.overflowX}px, 0 errors)`);

  // 5. Switch to iPhone Landscape 844x390 (Yatay Ekran) and verify compact 44px top header, left nav rail, drawer fit, and zero overflow
  pw('resize', '844', '390');
  sleep(450);

  // Open a drawer in iPhone landscape to ensure it fits within 390px height without overflowing
  pwEval(`() => {
    const btns = Array.from(document.querySelectorAll('button')).filter((b) => !b.disabled);
    const econBtn = btns.find((b) => {
      const txt = ((b.textContent || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.getAttribute('aria-label') || '')).toLocaleLowerCase('tr-TR');
      return txt.includes('ekonomi');
    });
    if (econBtn) econBtn.click();
    return JSON.stringify({ clicked: Boolean(econBtn) });
  }`);
  sleep(300);

  const landscapeCheck = pwEval(`() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const mapCanvas = canvases.find((c) => {
      const r = c.getBoundingClientRect();
      return r.width >= 500 && r.height >= 280;
    });
    const rect = mapCanvas ? mapCanvas.getBoundingClientRect() : null;
    const header = document.querySelector('.hud-header');
    const headerRect = header ? header.getBoundingClientRect() : null;
    const nav = document.querySelector('.hud-bottom-nav');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const drawer = document.querySelector('.hud-drawer-card');
    const drawerRect = drawer ? drawer.getBoundingClientRect() : null;
    return JSON.stringify({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      overflowY: document.documentElement.scrollHeight - window.innerHeight,
      canvasVisible: Boolean(mapCanvas && rect && rect.width >= 700 && rect.height >= 300),
      canvasSize: rect ? [Math.round(rect.width), Math.round(rect.height)] : null,
      headerHeight: headerRect ? Math.round(headerRect.height) : null,
      navIsLeftRail: Boolean(navRect && navRect.width <= 80 && navRect.left < 60),
      drawerFitsViewport: !drawerRect || (drawerRect.bottom <= window.innerHeight + 2 && drawerRect.top >= 0),
      errors: window.__smokeErrors || [],
    });
  }`);
  assert(landscapeCheck.canvasVisible, `Map canvas missing on iPhone landscape: ${JSON.stringify(landscapeCheck)}`);
  assert(landscapeCheck.overflowX <= 2, `iPhone landscape has horizontal overflow (${landscapeCheck.overflowX}px)`);
  assert(landscapeCheck.overflowY <= 2, `iPhone landscape has vertical overflow (${landscapeCheck.overflowY}px)`);
  assert(landscapeCheck.headerHeight && landscapeCheck.headerHeight <= 48, `iPhone landscape header should be compact 44px (got ${landscapeCheck.headerHeight}px)`);
  assert(landscapeCheck.navIsLeftRail, `iPhone landscape nav should dock to left rail: ${JSON.stringify(landscapeCheck)}`);
  assert(landscapeCheck.drawerFitsViewport, `iPhone landscape drawer overflows viewport: ${JSON.stringify(landscapeCheck)}`);
  assert((landscapeCheck.errors || []).length === 0, `Runtime errors detected on iPhone landscape: ${JSON.stringify(landscapeCheck.errors)}`);
  console.log(`  ✓ iPhone Landscape 844x390 verified (canvas ${landscapeCheck.canvasSize?.join('x')}, header=${landscapeCheck.headerHeight}px, leftRail=true, drawerFits=true, overflow=0px)`);

  // 6. Verify zero browser console errors (ignoring HMR WebSocket messages)
  const consoleOut = pw('console', 'error');
  const filteredErrors = consoleOut
    .split('\n')
    .filter((line) => line.includes('[ERROR]') && !line.includes('WebSocket'));
  assert(filteredErrors.length === 0, `Browser console errors found:\n${filteredErrors.join('\n')}`);

  console.log('✅ Desktop + iPhone Portrait + iPhone Landscape UI smoke check passed with 0 errors!');
} catch (err) {
  failed = true;
  console.error('❌ UI Smoke check failed:', err?.message || err);
} finally {
  try {
    pw('close');
  } catch {
    // ignore close errors
  }
  const pwDir = path.resolve(process.cwd(), '.playwright-cli');
  if (fs.existsSync(pwDir)) {
    fs.rmSync(pwDir, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}
