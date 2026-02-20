const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
const allIds = new Map();
let total = 0;
let dupes = [];
let issues = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  total += data.length;
  for (const p of data) {
    if (allIds.has(p.id)) {
      dupes.push({ id: p.id, file1: allIds.get(p.id), file2: file });
    } else {
      allIds.set(p.id, file);
    }
    const problems = [];
    if (!p.id) problems.push('no id');
    if (!p.name) problems.push('no name');
    if (!p.positions || !Array.isArray(p.positions) || p.positions.length === 0) problems.push('no positions');
    if (!p.stats) problems.push('no stats');
    if (p.overall === undefined) problems.push('no overall');
    if (!p.category) problems.push('no category');
    if (!p.grades) problems.push('no grades');
    if (problems.length > 0) {
      issues.push(file + ': ' + (p.id || p.name || '???') + ' - ' + problems.join(', '));
    }
  }
}

console.log('Total players:', total);
console.log('Unique IDs:', allIds.size);
console.log('Duplicates:', dupes.length);
if (dupes.length > 0) {
  dupes.forEach(d => console.log('  DUP:', d.id, d.file1, '<->', d.file2));
}
console.log('Schema issues:', issues.length);
if (issues.length > 0) {
  issues.slice(0, 30).forEach(i => console.log('  ', i));
  if (issues.length > 30) console.log('  ... and', (issues.length - 30), 'more');
}
