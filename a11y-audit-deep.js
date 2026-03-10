/**
 * Deep Accessibility Audit - Aggressive scan
 * Tests: editor pages, interactive states, zoom reflow, experimental axe rules
 */
const pa11y = require('pa11y');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Include editor/detail pages and more states
const PAGES = [
  // List pages (re-scan with stricter rules)
  { name: 'Login', path: '/login' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'My Week', path: '/my-week' },
  { name: 'Documents', path: '/docs' },
  { name: 'Issues', path: '/issues' },
  { name: 'Projects', path: '/projects' },
  { name: 'Programs', path: '/programs' },
  { name: 'Team Allocation', path: '/team/allocation' },
  { name: 'Team Directory', path: '/team/directory' },
  { name: 'Team Status', path: '/team/status' },
  { name: 'Team Org Chart', path: '/team/org-chart' },
  { name: 'Team Reviews', path: '/team/reviews' },
  { name: 'Settings', path: '/settings' },
  // Editor/detail pages
  { name: 'Issue Editor', path: '/documents/da3ac42c-25f3-48ed-be1a-82f9df738579' },
  { name: 'Issue Editor 2', path: '/documents/82cff1b7-4068-4be6-9834-baac6b975605' },
];

async function runScan(browser, page, standard, includeNotices) {
  const url = `${BASE}${page.path}`;
  try {
    const result = await pa11y(url, {
      timeout: 30000,
      wait: 5000,
      standard: standard,
      runners: ['htmlcs', 'axe'],
      includeNotices: includeNotices,
      includeWarnings: true,
      browser: browser,
    });
    return { page: page.name, path: page.path, standard, issues: result.issues || [], title: result.documentTitle };
  } catch (e) {
    return { page: page.name, path: page.path, standard, error: e.message.slice(0, 300) };
  }
}

async function testZoomReflow(browser, pagePath, pageName) {
  // Test at 200% zoom for WCAG 1.4.4 (Resize text) and 400% for 1.4.10 (Reflow)
  const issues = [];
  const page = await browser.newPage();

  for (const zoom of [200, 400]) {
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: zoom / 100 });
    await page.goto(`${BASE}${pagePath}`, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    // Check for horizontal scrollbar (reflow failure)
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    // Check for text overflow/clipping
    const overflowIssues = await page.evaluate(() => {
      const problems = [];
      const els = document.querySelectorAll('*');
      for (const el of els) {
        const style = window.getComputedStyle(el);
        if (style.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 2) {
          const text = el.textContent?.trim().slice(0, 50);
          if (text && text.length > 3) {
            problems.push({ selector: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''), text });
          }
        }
      }
      return problems.slice(0, 10);
    });

    if (hasHScroll) {
      issues.push({ zoom, type: 'horizontal-scroll', msg: `Page requires horizontal scrolling at ${zoom}% zoom` });
    }
    if (overflowIssues.length > 0) {
      issues.push({ zoom, type: 'text-clipping', msg: `${overflowIssues.length} elements have clipped/hidden overflow at ${zoom}%`, details: overflowIssues });
    }

    await page.screenshot({ path: `./a11y-screenshots/${pageName.replace(/\s+/g, '-').toLowerCase()}-${zoom}pct.png` });
  }

  await page.close();
  return { page: pageName, path: pagePath, zoomIssues: issues };
}

async function testInteractiveStates(browser) {
  const issues = [];
  const page = await browser.newPage();

  // Test: Open command palette (Ctrl+K)
  await page.goto(`${BASE}/docs`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Test focus visible on nav items
  const focusIssues = await page.evaluate(() => {
    const problems = [];
    const interactive = document.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"], [role="button"]');
    for (const el of interactive) {
      el.focus();
      const style = window.getComputedStyle(el);
      const outlineWidth = parseFloat(style.outlineWidth) || 0;
      const boxShadow = style.boxShadow;
      const hasRing = boxShadow && boxShadow !== 'none';
      const hasOutline = outlineWidth > 0 && style.outlineStyle !== 'none';

      if (!hasRing && !hasOutline) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { // visible element
          problems.push({
            tag: el.tagName,
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
            selector: el.className ? el.tagName + '.' + el.className.split(' ').slice(0, 2).join('.') : el.tagName,
          });
        }
      }
    }
    return problems;
  });

  if (focusIssues.length > 0) {
    issues.push({ type: 'missing-focus-indicator', count: focusIssues.length, elements: focusIssues.slice(0, 20) });
  }

  // Test: Check for disabled states without aria-disabled
  const disabledIssues = await page.evaluate(() => {
    const problems = [];
    const els = document.querySelectorAll('[disabled], .disabled, .cursor-not-allowed');
    for (const el of els) {
      if (!el.hasAttribute('aria-disabled') && !el.hasAttribute('disabled')) {
        problems.push({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40) });
      }
    }
    return problems;
  });

  if (disabledIssues.length > 0) {
    issues.push({ type: 'missing-aria-disabled', count: disabledIssues.length, elements: disabledIssues });
  }

  // Test: Check all color values for contrast (brute force)
  const contrastData = await page.evaluate(() => {
    const results = [];
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const style = window.getComputedStyle(el);
      const color = style.color;
      const bg = style.backgroundColor;
      const text = (el.textContent || '').trim();
      if (text && text.length > 0 && text.length < 200 && color && bg) {
        // Parse rgba values
        const parseRgba = (str) => {
          const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          if (!m) return null;
          return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
        };
        const fg = parseRgba(color);
        const bgc = parseRgba(bg);
        if (fg && bgc && bgc.a > 0) {
          // Relative luminance
          const lum = ({r, g, b}) => {
            const [rs, gs, bs] = [r/255, g/255, b/255].map(c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4));
            return 0.2126*rs + 0.7152*gs + 0.0722*bs;
          };
          const l1 = lum(fg);
          const l2 = lum(bgc);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const fontSize = parseFloat(style.fontSize);
          const isBold = parseInt(style.fontWeight) >= 700;
          const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);
          const threshold = isLargeText ? 3 : 4.5;
          if (ratio < threshold) {
            results.push({
              ratio: Math.round(ratio * 100) / 100,
              threshold,
              text: text.slice(0, 50),
              color: color,
              bg: bg,
              selector: el.className ? el.className.split(' ').slice(0, 3).join(' ') : el.tagName,
              fontSize: fontSize,
              isLarge: isLargeText
            });
          }
        }
      }
    }
    // Deduplicate by color+bg combo
    const seen = new Set();
    return results.filter(r => {
      const key = r.color + '|' + r.bg;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  if (contrastData.length > 0) {
    issues.push({ type: 'computed-contrast-failures', count: contrastData.length, elements: contrastData });
  }

  await page.close();
  return issues;
}

async function testReducedMotion(browser) {
  const page = await browser.newPage();
  // Emulate prefers-reduced-motion
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Check if animations are still running
  const animations = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    const animated = [];
    for (const el of els) {
      const style = window.getComputedStyle(el);
      if (style.animationName && style.animationName !== 'none') {
        animated.push({ tag: el.tagName, animation: style.animationName, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60) });
      }
      if (style.transition && style.transition !== 'all 0s ease 0s' && style.transition !== 'none 0s ease 0s') {
        // transitions are ok-ish, just note them
      }
    }
    return animated;
  });

  await page.close();
  return animations;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Login
  console.error('Logging in...');
  const loginPage = await browser.newPage();
  await loginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 15000 });
  await loginPage.type('#email', 'dev@ship.local');
  await loginPage.type('#password', 'admin123');
  await loginPage.click('button[type="submit"]');
  await loginPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  console.error(`Logged in at: ${loginPage.url()}`);
  await loginPage.close();

  // 1. WCAG2AAA scan (stricter than AA)
  console.error('\n=== WCAG 2.1 AAA SCAN (stricter) ===');
  const aaaResults = [];
  for (const page of PAGES) {
    console.error(`  AAA scan: ${page.name}...`);
    const result = await runScan(browser, page, 'WCAG2AAA', true);
    aaaResults.push(result);
    if (!result.error) {
      const errors = result.issues.filter(i => i.type === 'error').length;
      const warnings = result.issues.filter(i => i.type === 'warning').length;
      const notices = result.issues.filter(i => i.type === 'notice').length;
      console.error(`    ${errors} errors, ${warnings} warnings, ${notices} notices`);
    }
  }

  // 2. Zoom/reflow test
  console.error('\n=== ZOOM/REFLOW TEST (200% and 400%) ===');
  const zoomResults = [];
  const zoomPages = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Issues', path: '/issues' },
    { name: 'Issue Editor', path: '/documents/da3ac42c-25f3-48ed-be1a-82f9df738579' },
    { name: 'Team Allocation', path: '/team/allocation' },
    { name: 'Team Status', path: '/team/status' },
  ];
  for (const page of zoomPages) {
    console.error(`  Zoom test: ${page.name}...`);
    const result = await testZoomReflow(browser, page.path, page.name);
    zoomResults.push(result);
  }

  // 3. Interactive state tests
  console.error('\n=== INTERACTIVE STATE TESTS ===');
  const interactiveResults = await testInteractiveStates(browser);

  // 4. Reduced motion test
  console.error('\n=== REDUCED MOTION TEST ===');
  const motionResults = await testReducedMotion(browser);

  await browser.close();

  // ============= OUTPUT =============
  console.log('\n================================================================');
  console.log('  DEEP ACCESSIBILITY AUDIT - AGGRESSIVE SCAN');
  console.log('================================================================\n');

  // AAA Results summary
  console.log('--- WCAG 2.1 AAA SCAN (stricter than AA) ---\n');
  let totalAAAErrors = 0, totalAAAWarnings = 0, totalAAANotices = 0;
  for (const r of aaaResults) {
    if (r.error) { console.log(`${r.page}: ERROR - ${r.error}`); continue; }
    const errors = r.issues.filter(i => i.type === 'error');
    const warnings = r.issues.filter(i => i.type === 'warning');
    const notices = r.issues.filter(i => i.type === 'notice');
    totalAAAErrors += errors.length;
    totalAAAWarnings += warnings.length;
    totalAAANotices += notices.length;
    console.log(`${r.page.padEnd(25)} Errors: ${String(errors.length).padEnd(5)} Warnings: ${String(warnings.length).padEnd(5)} Notices: ${notices.length}`);
  }
  console.log(`\nAAA TOTALS: ${totalAAAErrors} errors, ${totalAAAWarnings} warnings, ${totalAAANotices} notices`);

  // Print unique AAA error types across all pages
  console.log('\nUnique AAA error types:');
  const allAAAErrors = new Map();
  for (const r of aaaResults) {
    if (r.error) continue;
    for (const issue of r.issues.filter(i => i.type === 'error')) {
      const key = issue.code;
      if (!allAAAErrors.has(key)) allAAAErrors.set(key, { msg: issue.message.slice(0, 150), count: 0, pages: new Set() });
      allAAAErrors.get(key).count++;
      allAAAErrors.get(key).pages.add(r.page);
    }
  }
  for (const [code, data] of [...allAAAErrors.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  [${code}] x${data.count} on ${[...data.pages].join(', ')}`);
    console.log(`    ${data.msg}`);
  }

  // Print unique AAA warning types
  console.log('\nUnique AAA warning types:');
  const allAAAWarnings = new Map();
  for (const r of aaaResults) {
    if (r.error) continue;
    for (const issue of r.issues.filter(i => i.type === 'warning')) {
      const key = issue.code;
      if (!allAAAWarnings.has(key)) allAAAWarnings.set(key, { msg: issue.message.slice(0, 150), count: 0 });
      allAAAWarnings.get(key).count++;
    }
  }
  for (const [code, data] of [...allAAAWarnings.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  [${code}] x${data.count}: ${data.msg}`);
  }

  // Zoom results
  console.log('\n--- ZOOM/REFLOW TEST RESULTS ---\n');
  for (const r of zoomResults) {
    console.log(`${r.page} (${r.path}):`);
    if (r.zoomIssues.length === 0) {
      console.log('  No zoom issues found');
    } else {
      for (const issue of r.zoomIssues) {
        console.log(`  ${issue.type} at ${issue.zoom}%: ${issue.msg}`);
        if (issue.details) {
          issue.details.slice(0, 5).forEach(d => console.log(`    ${d.selector}: "${d.text.slice(0, 60)}"`));
        }
      }
    }
  }

  // Interactive state results
  console.log('\n--- INTERACTIVE STATE TEST RESULTS ---\n');
  for (const issue of interactiveResults) {
    console.log(`${issue.type} (${issue.count} elements):`);
    if (issue.type === 'computed-contrast-failures') {
      issue.elements.forEach(e => {
        console.log(`  Ratio ${e.ratio}:1 (need ${e.threshold}:1) — "${e.text.slice(0, 40)}" — color: ${e.color}, bg: ${e.bg}`);
        console.log(`    class: ${e.selector}`);
      });
    } else if (issue.type === 'missing-focus-indicator') {
      issue.elements.forEach(e => {
        console.log(`  ${e.tag}: "${e.text}" — ${e.selector}`);
      });
    } else {
      issue.elements.forEach(e => {
        console.log(`  ${JSON.stringify(e)}`);
      });
    }
  }

  // Reduced motion
  console.log('\n--- REDUCED MOTION TEST ---\n');
  if (motionResults.length === 0) {
    console.log('No CSS animations found running with prefers-reduced-motion: reduce');
  } else {
    console.log(`${motionResults.length} animations still running with reduced motion:`);
    motionResults.forEach(a => console.log(`  ${a.tag} — animation: ${a.animation} — ${a.cls}`));
  }

  // Save full results
  const fullResults = { aaaResults, zoomResults, interactiveResults, motionResults };
  fs.writeFileSync('a11y-deep-results.json', JSON.stringify(fullResults, null, 2));
  console.log('\nFull results: a11y-deep-results.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
