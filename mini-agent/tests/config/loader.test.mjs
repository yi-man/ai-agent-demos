import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { AgentConfigSchema, ModelConfigSchema, EnvironmentConfigSchema } from "../../src/config/schemas.mjs";
import { keyValueSpecToNestedDict, interpolateEnvVars } from "../../src/config/loader.mjs";

describe("Zod schemas", () => {
  it("AgentConfigSchema validates required fields", () => {
    const result = AgentConfigSchema.safeParse({ system_template: "sys", instance_template: "task" });
    expect(result.success).toBe(true);
    expect(result.data.step_limit).toBe(0);
    expect(result.data.mode).toBe("confirm");
  });

  it("AgentConfigSchema rejects invalid mode", () => {
    const result = AgentConfigSchema.safeParse({ system_template: "sys", instance_template: "task", mode: "invalid" });
    expect(result.success).toBe(false);
  });

  it("ModelConfigSchema defaults base_url and api_key", () => {
    const prevUrl = process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
    const result = ModelConfigSchema.safeParse({ model_name: "gpt-4o", observation_template: "obs", format_error_template: "err" });
    expect(result.success).toBe(true);
    expect(result.data.base_url).toBe("https://api.openai.com/v1");
    process.env.OPENAI_BASE_URL = prevUrl;
  });

  it("ModelConfigSchema picks OPENAI_BASE_URL and MSWEA_MODEL_NAME from env when omitted", () => {
    const prevUrl = process.env.OPENAI_BASE_URL;
    const prevModel = process.env.MSWEA_MODEL_NAME;
    process.env.OPENAI_BASE_URL = "https://example-vendor.com/v1";
    process.env.MSWEA_MODEL_NAME = "my-endpoint-model";
    const result = ModelConfigSchema.safeParse({ observation_template: "obs", format_error_template: "err" });
    expect(result.success).toBe(true);
    expect(result.data.base_url).toBe("https://example-vendor.com/v1");
    expect(result.data.model_name).toBe("my-endpoint-model");
    process.env.OPENAI_BASE_URL = prevUrl;
    process.env.MSWEA_MODEL_NAME = prevModel;
  });

  it("EnvironmentConfigSchema defaults timeout", () => {
    const result = EnvironmentConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.timeout).toBe(30);
  });
});

describe("keyValueSpecToNestedDict", () => {
  it("parses dot-notation key=value", () => {
    expect(keyValueSpecToNestedDict("model.model_name=gpt-4o")).toEqual({ model: { model_name: "gpt-4o" } });
  });

  it("parses JSON values", () => {
    expect(keyValueSpecToNestedDict("model.model_kwargs.temperature=0.5")).toEqual({ model: { model_kwargs: { temperature: 0.5 } } });
  });
});

describe("interpolateEnvVars", () => {
  it("replaces ${VAR} with env value", () => {
    process.env.TEST_INTERPOLATE = "hello";
    expect(interpolateEnvVars("${TEST_INTERPOLATE} world")).toBe("hello world");
    delete process.env.TEST_INTERPOLATE;
  });

  it("leaves unreferenced vars as-is", () => {
    expect(interpolateEnvVars("no vars here")).toBe("no vars here");
  });
});
