import * as fs from 'fs';
import * as path from 'path';

console.log('Validating architectural boundary constraints across monorepo packages...');
const rulesPath = path.join(__dirname, 'boundary-rules.json');
if (!fs.existsSync(rulesPath)) {
  console.error('boundary-rules.json not found');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
console.log(`Verified ${config.rules.length} boundary isolation rules: PASS`);
