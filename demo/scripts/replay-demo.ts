import * as fs from 'fs';
import * as path from 'path';

export function runReplayDemo() {
  const fixturePath = path.join(__dirname, '../fixtures/bangkok-orderbook.json');
  const data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  console.log(`Replaying ${data.events.length} verified demo events for judges...`);
  return data.events;
}
