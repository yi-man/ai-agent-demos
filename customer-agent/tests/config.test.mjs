import { describe, it, expect } from 'bun:test';
import config from '../src/config.mjs';

describe('config', () => {
  it('should load config with all required fields', () => {
    expect(config.apiKey).toBeString();
    expect(config.apiKey.length).toBeGreaterThan(0);
    expect(config.modelBaseUrl).toBe('https://token-plan-sgp.xiaomimimo.com/v1');
    expect(config.modelName).toBe('mimo-v2.5-pro');
  });

  it('should parse numeric values correctly', () => {
    expect(config.maxBargainRounds).toBe(5);
    expect(config.maxDiscountPercent).toBe(15);
    expect(config.manualModeTimeout).toBe(1800);
  });

  it('should have correct types for all fields', () => {
    expect(typeof config.apiKey).toBe('string');
    expect(typeof config.modelBaseUrl).toBe('string');
    expect(typeof config.modelName).toBe('string');
    expect(typeof config.maxBargainRounds).toBe('number');
    expect(typeof config.maxDiscountPercent).toBe('number');
    expect(typeof config.manualModeTimeout).toBe('number');
  });
});
