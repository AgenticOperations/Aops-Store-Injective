import { describe, it, expect } from 'vitest';
import { runReplayDemo } from './replay-demo';

describe('Demo Replay', () => {
  it('loads all demo events cleanly', () => {
    const events = runReplayDemo();
    expect(events.length).toBe(4);
  });
});
