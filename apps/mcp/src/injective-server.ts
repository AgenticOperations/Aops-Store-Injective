export interface MCPOrderIntent {
  seatId: string;
  marketId: string;
  isBuy: boolean;
  quantity: number;
  price: number;
}

export class InjectiveMCPServer {
  registerTools() {
    return [
      { name: 'submit_order_intent', description: 'Submit an order intent to the mandate risk engine' },
      { name: 'get_seat_limits', description: 'Read current risk envelope and high-water mark' },
      { name: 'get_fills_history', description: 'Query verified Injective batch auction fills' }
    ];
  }
}
