/**
 * Accessibility Audit Script
 * Uses pa11y programmatic API with puppeteer browser reuse and login
 */
const pa11y = require('pa11y');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const PAGES = [
  { name: 'Login', path: '/login', noAuth: true },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'My Week', path: '/my-week' },
  { name: 'Documents', path: '/docs' },
  { name: 'Issues', path: '/issues' },
  { name: 'Projects', path: '/projects' },
  { name: 'Programs', path: '/programs' },
  { name: 'Team Allocation', path: '/team/allocation' },
  { name: 'Team Directory', path: '/team/directory' },
  { name: 'Team Status', path: '/team/status' },
  { name: 'Settings', path: '/settings' },
];

async function main() {
  // Launch browser once
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Login first
  console.error('Logging in...');
  const loginPage = await browser.newPage();
  await loginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 15000 });
  await loginPage.type('#email', 'dev@ship.local');
  await loginPage.type('#password', 'admin123');
  await loginPage.click('button[type="submit"]');
  await loginPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  // Wait a bit for redirect
  await new Promise(r => setTimeout(r, 3000));
  const afterLoginUrl = loginPage.url();
  console.error(`After login URL: ${afterLoginUrl}`);
  await loginPage.close();

  const results = [];

  for (const page of PAGES) {
    const url = `${BASE}${page.path}`;
    console.error(`\nScanning: ${page.name} (${page.path})...`);

    try {
      const result = await pa11y(url, {
        timeout: 30000,
        wait: 5000,
        standard: 'WCAG2AA',
        runners: ['htmlcs', 'axe'],
        includeNotices: false,
        includeWarnings: true,
        browser: browser,
        screenCapture: `./a11y-screenshots/${page.name.replace(/\s+/g, '-').toLowerCase()}.png`,
      });
      results.push({ page: page.name, path: page.path, issues: result.issues || [], documentTitle: result.documentTitle });
      console.error(`  Found ${result.issues.length} issues`);
    } catch (e) {
      results.push({ page: page.name, path: page.path, error: e.message.slice(0, 300) });
      console.error(`  ERROR: ${e.message.slice(0, 200)}`);
    }
  }

  await browser.close();

  // Print summary
  console.log('\n========================================');
  console.log('  PA11Y ACCESSIBILITY AUDIT RESULTS');
  console.log('  Standard: WCAG 2.1 AA');
  console.log('  Runners: HTML_CodeSniffer + axe-core');
  console.log('========================================\n');

  let totalError = 0, totalWarning = 0;

  for (const r of results) {
    if (r.error) {
      console.log(`\n--- ${r.page} (${r.path}) ---`);
      console.log(`  SCAN ERROR: ${r.error}`);
      continue;
    }
    const issues = r.issues;
    const errors = issues.filter(i => i.type === 'error');
    const warnings = issues.filter(i => i.type === 'warning');

    totalError += errors.length;
    totalWarning += warnings.length;

    console.log(`\n--- ${r.page} (${r.path}) --- [Title: ${r.documentTitle || 'N/A'}]`);
    console.log(`  Errors: ${errors.length}, Warnings: ${warnings.length}`);

    // Group and print errors
    const groupedErrors = {};
    errors.forEach(e => {
      const key = e.code + '|' + e.message;
      if (!groupedErrors[key]) groupedErrors[key] = { msg: e.message, code: e.code, selectors: [], contexts: [] };
      groupedErrors[key].selectors.push(e.selector);
      groupedErrors[key].contexts.push(e.context);
    });

    Object.values(groupedErrors).forEach(g => {
      console.log(`  ERROR [${g.code}]: ${g.msg}`);
      g.selectors.slice(0, 3).forEach((s, i) => {
        console.log(`    at: ${s}`);
        if (g.contexts[i]) console.log(`    ctx: ${g.contexts[i].slice(0, 120)}`);
      });
      if (g.selectors.length > 3) console.log(`    ... and ${g.selectors.length - 3} more`);
    });

    // Group and print warnings
    const groupedWarnings = {};
    warnings.forEach(w => {
      const key = w.code + '|' + w.message;
      if (!groupedWarnings[key]) groupedWarnings[key] = { msg: w.message, code: w.code, count: 0 };
      groupedWarnings[key].count++;
    });

    Object.values(groupedWarnings).forEach(g => {
      console.log(`  WARN [${g.code}] (x${g.count}): ${g.msg}`);
    });
  }

  console.log('\n========================================');
  console.log('  TOTALS');
  console.log('========================================');
  console.log(`Total Errors (Critical/Serious): ${totalError}`);
  console.log(`Total Warnings (Moderate):       ${totalWarning}`);
  console.log('========================================\n');

  // Write full JSON
  fs.writeFileSync('a11y-results.json', JSON.stringify(results, null, 2));
  console.log('Full results: a11y-results.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
