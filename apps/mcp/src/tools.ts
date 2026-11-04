import { MCPOrderIntent } from './injective-server';

export async function handleOrderIntent(intent: MCPOrderIntent) {
  console.log(`[MCP Tool] Forwarding intent for ${intent.seatId} to mandate contract`);
  return { status: 'FORWARDED_TO_MANDATE', intent };
}
