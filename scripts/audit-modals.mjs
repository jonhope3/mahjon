/**
 * Viewport audit: modal/popup sizing across 6 target devices.
 * Run: npx --yes playwright@1.49.0 install chromium && node scripts/audit-modals.mjs
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.MAHJON_URL || 'http://127.0.0.1:5173';
const OUT = join(process.cwd(), 'tmp-modal-audit');

const TARGETS = [
  { id: 'iphone14', ...devices['iPhone 14'] },
  { id: 'iphone14ProMax', ...devices['iPhone 14 Pro Max'] },
  {
    id: 'pixel7',
    ...devices['Pixel 7'],
  },
  {
    id: 'ipadA16',
    viewport: { width: 820, height: 1180 },
    userAgent: devices['iPad Pro 11'].userAgent,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  {
    id: 'ipadProM4',
    viewport: { width: 1024, height: 1366 },
    userAgent: devices['iPad Pro 11'].userAgent,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  {
    id: 'macbookPro16',
    viewport: { width: 1728, height: 1117 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 2,
  },
];

function fail(issues, msg) {
  issues.push(msg);
}

async function measureDialog(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const vv = window.visualViewport;
    const vw = vv?.width ?? innerWidth;
    const vh = vv?.height ?? innerHeight;
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      left: Math.round(r.left),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
      vw: Math.round(vw),
      vh: Math.round(vh),
      overflowY: cs.overflowY,
      maxHeight: cs.maxHeight,
      fits:
        r.left >= -1 &&
        r.top >= -1 &&
        r.right <= vw + 1 &&
        r.bottom <= vh + 1,
      widthRatio: r.width / vw,
      heightRatio: r.height / vh,
    };
  }, selector);
}

async function auditDevice(browser, target) {
  const context = await browser.newContext({
    ...target,
    viewport: target.viewport,
  });
  const page = await context.newPage();
  const issues = [];
  const notes = [];

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.menu-settings-btn', { timeout: 15000 });

    // Settings
    await page.click('.menu-settings-btn');
    await page.waitForSelector('.settings-panel', { timeout: 5000 });
    const settings = await measureDialog(page, '.settings-panel');
    if (!settings) fail(issues, 'settings missing');
    else {
      notes.push(`settings ${settings.w}×${settings.h} (vh ratio ${settings.heightRatio.toFixed(2)})`);
      if (!settings.fits) fail(issues, `settings overflows viewport (${settings.w}×${settings.h} in ${settings.vw}×${settings.vh})`);
      if (settings.widthRatio < 0.35 && settings.vw >= 1280)
        fail(issues, `settings too narrow on desktop (${settings.w}px / ${settings.vw}px)`);
      if (settings.widthRatio > 0.98 && settings.vw >= 1280)
        fail(issues, `settings nearly full-bleed on desktop`);
      const footer = await page.locator('.settings-footer').boundingBox();
      if (!footer) fail(issues, 'settings footer missing');
      else if (footer.y + footer.height > settings.vh + 2)
        fail(issues, 'settings footer below fold');
      // Escape must dismiss
      await page.keyboard.press('Escape');
      const stillOpen = await page.locator('.settings-panel').count();
      if (stillOpen > 0) {
        fail(issues, 'Escape did not close settings');
        const cancel = page.getByRole('button', { name: 'Cancel' });
        if (await cancel.count()) await cancel.click();
      }
    }
    await page.screenshot({ path: join(OUT, `${target.id}-settings.png`), fullPage: false });
    await page.waitForSelector('.settings-panel', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(150);

    // Hand card via How to Play isn't ideal — open Help isn't on menu.
    // Use tutorial? Skip if no path. Open Custom isn't needed.
    // Hand card only in-game / charleston / tutorial. Open tutorial then we can't easily.
    // Inject HandCard by clicking through Quick Start is heavy.
    // Measure CSS-applied modal by opening settings is enough for shell;
    // also open How to Play for tutorial chrome.

    await page.click('#tutorial-btn');
    await page.waitForSelector('.tutorial-screen', { timeout: 5000 });
    const tut = await page.evaluate(() => {
      const el = document.querySelector('.tutorial-screen');
      const r = el.getBoundingClientRect();
      const vw = innerWidth;
      const vh = innerHeight;
      return {
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        overflowsX: el.scrollWidth > el.clientWidth + 2,
        vw,
        vh,
        h: Math.round(r.height),
      };
    });
    notes.push(`tutorial clientW=${tut.clientW} scrollW=${tut.scrollW}`);
    if (tut.overflowsX) fail(issues, 'tutorial horizontal overflow');
    await page.screenshot({ path: join(OUT, `${target.id}-tutorial.png`), fullPage: false });

    // Back to menu
    const exit = page.getByRole('button', { name: /Exit|Previous/ });
    if (await exit.count()) {
      // Keep clicking Previous/Exit until menu
      for (let i = 0; i < 12; i++) {
        if (await page.locator('.main-menu #quick-start-btn').count()) break;
        const btn = page.getByRole('button', { name: /Exit|Previous/ }).first();
        if (await btn.count()) await btn.click();
        else break;
        await page.waitForTimeout(150);
      }
    }

    // Multiplayer lobby + settings
    if (await page.locator('#multiplayer-btn').count()) {
      await page.click('#multiplayer-btn');
      await page.waitForSelector('.lobby-card', { timeout: 8000 });
      const lobby = await page.evaluate(() => {
        const el = document.querySelector('.main-menu');
        return {
          overflowsX: el ? el.scrollWidth > el.clientWidth + 2 : true,
          hasSettings: !!document.querySelector('.menu-settings-btn'),
        };
      });
      notes.push(`lobby overflowsX=${lobby.overflowsX} settings=${lobby.hasSettings}`);
      if (lobby.overflowsX) fail(issues, 'lobby horizontal overflow');
      if (!lobby.hasSettings) fail(issues, 'lobby missing settings gear');
      await page.click('.menu-settings-btn');
      await page.waitForSelector('.settings-panel', { timeout: 5000 });
      const lobbySettings = await measureDialog(page, '.settings-panel');
      if (lobbySettings && !lobbySettings.fits)
        fail(issues, `lobby settings overflows (${lobbySettings.w}×${lobbySettings.h})`);
      await page.screenshot({ path: join(OUT, `${target.id}-lobby-settings.png`), fullPage: false });
      const cancel2 = page.getByRole('button', { name: 'Cancel' });
      if (await cancel2.count()) await cancel2.click();
      else await page.keyboard.press('Escape');
      await page.waitForSelector('.settings-panel', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  } catch (e) {
    fail(issues, `exception: ${e.message}`);
  }

  await context.close();
  return { id: target.id, viewport: target.viewport, issues, notes };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const t of TARGETS) {
    process.stderr.write(`Auditing ${t.id} (${t.viewport.width}×${t.viewport.height})…\n`);
    results.push(await auditDevice(browser, t));
  }
  await browser.close();

  const summary = {
    ok: results.every(r => r.issues.length === 0),
    results,
  };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
