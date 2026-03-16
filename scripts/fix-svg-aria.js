// Adds aria-hidden="true" to all <svg elements in .tsx files that don't already have it
const fs = require('fs');
const path = require('path');
// Use simple recursive file finding
function findFiles(dir, ext) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const srcDir = path.join(__dirname, '..', 'web', 'src');
const files = findFiles(srcDir, '.tsx');

let totalFixed = 0;
let filesChanged = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Pattern 1: <svg className= (most common)
  content = content.replace(/<svg className=/g, (match) => {
    return '<svg aria-hidden="true" className=';
  });

  // Pattern 2: <svg xmlns=
  content = content.replace(/<svg xmlns=/g, (match) => {
    return '<svg aria-hidden="true" xmlns=';
  });

  // Pattern 3: <svg viewBox= (no className)
  content = content.replace(/<svg viewBox=/g, (match) => {
    return '<svg aria-hidden="true" viewBox=';
  });

  // Pattern 4: <svg fill=
  content = content.replace(/<svg fill=/g, (match) => {
    return '<svg aria-hidden="true" fill=';
  });

  // Pattern 5: <svg\n (multiline)
  content = content.replace(/<svg\n/g, '<svg aria-hidden="true"\n');

  // Clean up double aria-hidden (from SVGs that already had it)
  content = content.replace(/aria-hidden="true" aria-hidden="true"/g, 'aria-hidden="true"');
  // Also handle: aria-hidden="true" ... aria-hidden="true" on same tag (shouldn't happen with our patterns)

  if (content !== original) {
    const count = (content.match(/aria-hidden="true"/g) || []).length - (original.match(/aria-hidden="true"/g) || []).length;
    if (count > 0) {
      fs.writeFileSync(file, content);
      totalFixed += count;
      filesChanged++;
      console.log(`  ${path.relative(srcDir, file)}: +${count} aria-hidden`);
    }
  }
}

console.log(`\nDone: added ${totalFixed} aria-hidden attributes across ${filesChanged} files`);
