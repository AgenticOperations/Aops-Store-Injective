export class MomentumTradingAgent {
  constructor(public readonly seatId: string) {}

  evaluateSignal(movingAverageFast: number, movingAverageSlow: number) {
    return movingAverageFast > movingAverageSlow ? 'BUY' : 'SELL';
  }
}
