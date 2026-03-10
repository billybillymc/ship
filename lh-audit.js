/**
 * Lighthouse Accessibility Audit Script
 * Runs Lighthouse a11y audits on all major pages with authentication
 */
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
  // Dynamic import for lighthouse (ESM)
  const { default: lighthouse } = await import('lighthouse');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--remote-debugging-port=9222'],
  });

  // Login first
  console.error('Logging in...');
  const loginPage = await browser.newPage();
  await loginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 15000 });
  await loginPage.type('#email', 'dev@ship.local');
  await loginPage.type('#password', 'admin123');
  await loginPage.click('button[type="submit"]');
  await loginPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  console.error(`Logged in, at: ${loginPage.url()}`);
  await loginPage.close();

  const results = [];

  for (const page of PAGES) {
    const url = `${BASE}${page.path}`;
    console.error(`\nLighthouse: ${page.name} (${page.path})...`);

    try {
      const result = await lighthouse(url, {
        port: 9222,
        onlyCategories: ['accessibility'],
        output: 'json',
        formFactor: 'desktop',
        screenEmulation: { disabled: true },
      });

      const score = result.lhr.categories.accessibility.score * 100;
      const failedAudits = Object.values(result.lhr.audits)
        .filter(a => a.score !== null && a.score < 1)
        .map(a => ({
          id: a.id,
          title: a.title,
          score: a.score,
          impact: a.details?.items?.[0]?.node?.snippet ? 'has-elements' : 'general',
          items: (a.details?.items || []).slice(0, 3).map(i => i.node?.snippet || i.node?.selector || ''),
        }));

      results.push({ page: page.name, path: page.path, score, failedAudits });
      console.error(`  Score: ${score}, Failed audits: ${failedAudits.length}`);
    } catch (e) {
      results.push({ page: page.name, path: page.path, score: 'ERROR', error: e.message.slice(0, 200) });
      console.error(`  ERROR: ${e.message.slice(0, 200)}`);
    }
  }

  await browser.close();

  // Print results
  console.log('\n============================================');
  console.log('  LIGHTHOUSE ACCESSIBILITY SCORES');
  console.log('============================================\n');
  console.log('Page'.padEnd(25) + 'Score'.padEnd(8) + 'Failed Audits');
  console.log('-'.repeat(60));

  for (const r of results) {
    console.log(`${r.page.padEnd(25)}${String(r.score).padEnd(8)}${r.failedAudits ? r.failedAudits.length : 'ERR'}`);
  }

  console.log('\n--- Failed Audit Details ---\n');

  for (const r of results) {
    if (!r.failedAudits || r.failedAudits.length === 0) continue;
    console.log(`\n${r.page} (${r.path}) - Score: ${r.score}`);
    r.failedAudits.forEach(a => {
      console.log(`  FAIL: ${a.id} - ${a.title}`);
      a.items.forEach(s => { if (s) console.log(`    ${s.slice(0, 120)}`); });
    });
  }

  fs.writeFileSync('lh-results.json', JSON.stringify(results, null, 2));
  console.log('\nFull results: lh-results.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
