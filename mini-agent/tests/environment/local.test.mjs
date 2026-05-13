import { describe, it, expect } from "bun:test";
import { LocalEnvironment } from "../../src/environment/local.mjs";
import { Submitted } from "../../src/agent/exceptions.mjs";

describe("LocalEnvironment", () => {
  const env = new LocalEnvironment({ timeout: 5 });

  it("executes a simple command", async () => {
    const result = await env.execute({ command: "echo hello" });
    expect(result.returncode).toBe(0);
    expect(result.output.trim()).toBe("hello");
  });

  it("captures non-zero exit code", async () => {
    const result = await env.execute({ command: "exit 1" });
    expect(result.returncode).toBe(1);
  });

  it("captures timeout as exception", async () => {
    const envShort = new LocalEnvironment({ timeout: 1 });
    const result = await envShort.execute({ command: "sleep 10" });
    expect(result.returncode).toBe(-1);
    expect(result.exception_info).toContain("timed out");
  });

  it("throws Submitted on COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT", async () => {
    await expect(env.execute({ command: "printf 'COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT\\nmy answer'" }))
      .rejects.toThrow(Submitted);
  });

  it("getTemplateVars returns config plus platform info", () => {
    const vars = env.getTemplateVars();
    expect(vars.timeout).toBe(5);
    expect(vars.system).toBeDefined();
  });
});
