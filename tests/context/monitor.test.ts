import { test, expect, describe } from 'vitest';
import { ContextMonitor } from '../../src/context/monitor';

describe('ContextMonitor', () => {
  test('estimates usage from text', () => {
    const monitor = new ContextMonitor(1000); // Small max for testing
    let compactTriggered = false;
    
    monitor.onThreshold(40, 'compact', () => {
      compactTriggered = true;
    });

    // Add text that pushes over 40% of 1000 tokens
    monitor.estimateUsage('a'.repeat(500)); // ~125 tokens
    expect(compactTriggered).toBe(false);
    
    monitor.estimateUsage('b'.repeat(500)); // ~250 tokens total = 25%
    expect(compactTriggered).toBe(false);
    
    monitor.estimateUsage('c'.repeat(1000)); // ~500 tokens total = 50%
    expect(compactTriggered).toBe(true);
  });

  test('reset clears triggered thresholds', () => {
    const monitor = new ContextMonitor(100);
    let triggered = false;
    monitor.onThreshold(40, 'compact', () => { triggered = true; });
    
    monitor.estimateUsage('a'.repeat(200));
    expect(triggered).toBe(true);
    
    monitor.reset();
    triggered = false;
    monitor.estimateUsage('a'.repeat(200));
    expect(triggered).toBe(true); // Should trigger again after reset
  });
});