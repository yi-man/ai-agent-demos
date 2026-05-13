import { describe, it, expect } from "bun:test";
import { GlobalModelStats } from "../../src/model/stats.mjs";

describe("GlobalModelStats", () => {
  it("tracks cost and n_calls", () => {
    const stats = new GlobalModelStats();
    stats.add(0.5);
    expect(stats.cost).toBe(0.5);
    expect(stats.nCalls).toBe(1);
    stats.add(0.3);
    expect(stats.cost).toBeCloseTo(0.8);
    expect(stats.nCalls).toBe(2);
  });

  it("throws when cost limit exceeded", () => {
    const stats = new GlobalModelStats({ costLimit: 1.0, callLimit: 0 });
    stats.add(0.5);
    expect(() => stats.add(0.6)).toThrow(/Global cost/);
  });

  it("throws when call limit exceeded", () => {
    const stats = new GlobalModelStats({ costLimit: 0, callLimit: 2 });
    stats.add(0.1);
    stats.add(0.1);
    expect(() => stats.add(0.1)).toThrow(/Global cost/);
  });
});
