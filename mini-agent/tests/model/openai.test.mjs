import { describe, it, expect } from "bun:test";
import { OpenAIModel } from "../../src/model/openai.mjs";

const minimalConfig = {
  modelName: "gpt-4o",
  baseUrl: "https://api.example.com/v1",
  apiKey: "test-key",
  observationTemplate: "<returncode>{{output.returncode}}</returncode>\n<output>{{output.output}}</output>",
  formatErrorTemplate: "Error: {{error}}",
  model_kwargs: {},
};

describe("OpenAIModel", () => {
  it("creates OpenAI client with correct config", () => {
    const model = new OpenAIModel(minimalConfig);
    expect(model.config.modelName).toBe("gpt-4o");
  });

  it("formatMessage returns correct structure", () => {
    const model = new OpenAIModel(minimalConfig);
    const msg = model.formatMessage({ role: "system", content: "hello" });
    expect(msg.role).toBe("system");
    expect(msg.content).toBe("hello");
  });

  it("getTemplateVars returns config", () => {
    const model = new OpenAIModel(minimalConfig);
    const vars = model.getTemplateVars();
    expect(vars.model_name).toBe("gpt-4o");
  });

  it("prepareMessages strips 'extra' keys", () => {
    const model = new OpenAIModel(minimalConfig);
    const messages = [{ role: "user", content: "hi", extra: { foo: "bar" } }];
    const prepared = model.prepareMessages(messages);
    expect(prepared[0].extra).toBeUndefined();
    expect(prepared[0].role).toBe("user");
  });

  it("calculateCost returns 0 for no usage", () => {
    const model = new OpenAIModel(minimalConfig);
    expect(model.calculateCost({})).toBe(0);
  });

  it("calculateCost computes from usage and prices", () => {
    const model = new OpenAIModel({ ...minimalConfig, prices: { input: 5, output: 15 } });
    const response = { usage: { prompt_tokens: 1000, completion_tokens: 500 } };
    expect(model.calculateCost(response)).toBeCloseTo(0.0125);
  });
});
