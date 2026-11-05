import { describe, it, expect } from 'vitest';
import { InjectiveMCPServer } from './injective-server';

describe('InjectiveMCPServer', () => {
  it('exposes three core MCP tools', () => {
    const server = new InjectiveMCPServer();
    const tools = server.registerTools();
    expect(tools.length).toBe(3);
    expect(tools[0].name).toBe('submit_order_intent');
  });
});
