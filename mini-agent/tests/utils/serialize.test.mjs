import { describe, it, expect } from "bun:test";
import { recursiveMerge, UNSET } from "../../src/utils/serialize.mjs";

describe("UNSET", () => {
  it("is a unique sentinel value", () => {
    expect(UNSET).toBeDefined();
    expect(UNSET).toBe(UNSET);
  });
});

describe("recursiveMerge", () => {
  it("merges flat dicts, later wins", () => {
    expect(recursiveMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("merges nested dicts recursively", () => {
    expect(recursiveMerge({ a: { b: 1, c: 2 } }, { a: { c: 3 } })).toEqual({ a: { b: 1, c: 3 } });
  });

  it("skips UNSET values", () => {
    expect(recursiveMerge({ a: 1, b: 2 }, { b: UNSET })).toEqual({ a: 1, b: 2 });
  });

  it("skips null/undefined dicts", () => {
    expect(recursiveMerge(null, { a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it("returns empty object for no args", () => {
    expect(recursiveMerge()).toEqual({});
  });
});
