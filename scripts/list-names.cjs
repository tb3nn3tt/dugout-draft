const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'data');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const names = new Set();
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  data.forEach(p => names.add(p.name));
});
const sorted = [...names].sort();
sorted.forEach(n => console.log(n));
console.log('\nTOTAL:', sorted.length);
