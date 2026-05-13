import { describe, it, expect } from "bun:test";
import { render } from "../../src/utils/template.mjs";

describe("render", () => {
  it("renders simple variable", () => {
    expect(render("Hello {{name}}", { name: "world" })).toBe("Hello world");
  });

  it("renders conditionals", () => {
    expect(render("{%- if x -%}yes{%- endif -%}", { x: true })).toBe("yes");
    expect(render("{%- if x -%}yes{%- endif -%}", { x: false })).toBe("");
  });

  it("renders nested object properties", () => {
    expect(render("{{output.returncode}}", { output: { returncode: 0 } })).toBe("0");
  });

  it("renders for loops", () => {
    expect(render("{% for i in items %}{{i}}{% endfor %}", { items: [1, 2, 3] })).toBe("123");
  });
});
