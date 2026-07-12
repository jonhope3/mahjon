/**
 * Visual QA pass across target phones + Mac.
 * node scripts/visual-qa-pass.mjs
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.MAHJON_URL || 'http://127.0.0.1:5173';
const OUT = join(process.cwd(), 'tmp-modal-audit');

const TARGETS = [
  { id: 'iphone14', ...devices['iPhone 14'] },
  { id: 'pixel7', ...devices['Pixel 7'] },
  {
    id: 'macbookPro16',
    viewport: { width: 1728, height: 1117 },
    deviceScaleFactor: 2,
  },
];

function issuesFromShot(metrics, id) {
  const out = [];
  if (metrics.homeOverflowX) out.push(`${id}: home horizontal overflow`);
  if (metrics.selectableSample) out.push(`${id}: body text still selectable`);
  if (metrics.homeDeadSpace > 0.42 && metrics.vw < 500)
    out.push(`${id}: home feels sparse (dead space ${(metrics.homeDeadSpace * 100).toFixed(0)}%)`);
  if (metrics.primaryBtnH < 48) out.push(`${id}: primary CTA too short (${metrics.primaryBtnH}px)`);
  if (metrics.game && metrics.game.actionBarClipped)
    out.push(`${id}: action bar clipped off-screen`);
  if (metrics.game && metrics.game.handOverflowBad)
    out.push(`${id}: hand tiles overflow board badly`);
  return out;
}

async function runTarget(browser, target) {
  const context = await browser.newContext({ ...target, viewport: target.viewport });
  const page = await context.newPage();
  const m = { id: target.id, vw: target.viewport.width, vh: target.viewport.height };

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#quick-start-btn');

  Object.assign(
    m,
    await page.evaluate(() => {
      const menu = document.querySelector('.main-menu');
      const btn = document.querySelector('#quick-start-btn');
      const actions = document.querySelector('.menu-actions');
      const bodySelect = getComputedStyle(document.body).userSelect;
      const br = btn?.getBoundingClientRect();
      const ar = actions?.getBoundingClientRect();
      const mr = menu?.getBoundingClientRect();
      const dead =
        mr && ar ? Math.max(0, (mr.bottom - ar.bottom - 80) / mr.height) : 0;
      return {
        homeOverflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        selectableSample: !['none', '-moz-none'].includes(bodySelect),
        primaryBtnH: br ? Math.round(br.height) : 0,
        homeDeadSpace: dead,
      };
    }),
  );
  await page.screenshot({ path: join(OUT, `${target.id}-qa-home.png`) });

  await page.click('.menu-settings-btn');
  await page.waitForSelector('.settings-panel');
  await page.screenshot({ path: join(OUT, `${target.id}-qa-settings.png`) });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.settings-panel', { state: 'detached', timeout: 4000 }).catch(async () => {
    const c = page.getByRole('button', { name: 'Cancel' });
    if (await c.count()) await c.click();
  });

  await page.click('#multiplayer-btn');
  await page.waitForSelector('.lobby-card', { timeout: 8000 });
  await page.screenshot({ path: join(OUT, `${target.id}-qa-lobby.png`) });
  await page.getByRole('button', { name: '← Back' }).click().catch(() => {});
  await page.waitForSelector('#quick-start-btn', { timeout: 5000 }).catch(() => {});

  // Quick start → board
  if (await page.locator('#quick-start-btn').count()) {
    await page.click('#quick-start-btn');
    await page.waitForSelector('.game-board, .game-board.mobile', { timeout: 10000 });
    await page.waitForTimeout(800);
    m.game = await page.evaluate(() => {
      const board = document.querySelector('.game-board');
      const bar =
        document.querySelector('.mobile-action-bar') ||
        document.querySelector('.action-bar');
      const hand =
        document.querySelector('.mobile-player-hand') ||
        document.querySelector('.player-hand');
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const bb = bar?.getBoundingClientRect();
      const hb = hand?.getBoundingClientRect();
      return {
        isMobileShell: !!document.querySelector('.game-board.mobile'),
        actionBarClipped: bb ? bb.bottom > vh + 4 || bb.top > vh : true,
        handOverflowBad: hb ? hb.width > vw + 8 : false,
        boardH: board ? Math.round(board.getBoundingClientRect().height) : 0,
      };
    });
    await page.screenshot({ path: join(OUT, `${target.id}-qa-game.png`) });
  }

  await context.close();
  m.issues = issuesFromShot(m, target.id);
  return m;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const t of TARGETS) {
    process.stderr.write(`QA ${t.id}…\n`);
    results.push(await runTarget(browser, t));
  }
  await browser.close();
  const summary = {
    ok: results.every(r => r.issues.length === 0),
    results,
  };
  writeFileSync(join(OUT, 'qa-pass.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(2);
});
