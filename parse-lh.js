const fs = require('fs');
const data = fs.readFileSync(process.argv[2], 'utf8');
const json = JSON.parse(data);
console.log('Lighthouse Accessibility Score:', json.categories.accessibility.score * 100);
console.log();
console.log('Failed audits:');
const failed = Object.values(json.audits).filter(a => a.score !== null && a.score < 1);
failed.forEach(a => {
  console.log('  FAIL:', a.id, '-', a.title);
  if (a.details && a.details.items) {
    a.details.items.slice(0, 5).forEach(i => {
      console.log('   ', i.node ? i.node.snippet : '');
    });
  }
});
console.log();
console.log('Passed:', Object.values(json.audits).filter(a => a.score === 1).length);
console.log('N/A:', Object.values(json.audits).filter(a => a.score === null).length);
