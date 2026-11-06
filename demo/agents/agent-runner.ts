import { GridTradingAgent } from './grid-trader';

export function runDemoBots() {
  console.log('Spawning Builder A (Single Bot) and Builder B (Spam Bots)...');
  const botA = new GridTradingAgent('seat-demo-a', 25.0);
  return { botA };
}
