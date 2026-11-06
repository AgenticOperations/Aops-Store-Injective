export class GridTradingAgent {
  constructor(public readonly seatId: string, public readonly centerPrice: number) {}

  generateGridOrders(currentPrice: number) {
    const spacing = 0.01;
    return [
      { isBuy: true, price: currentPrice * (1 - spacing), quantity: 10 },
      { isBuy: false, price: currentPrice * (1 + spacing), quantity: 10 },
    ];
  }
}
