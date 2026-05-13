import { describe, it, expect } from "bun:test";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import { DefaultAgent } from "../../src/agent/default.mjs";
import { LimitsExceeded, Submitted, InterruptAgentFlow } from "../../src/agent/exceptions.mjs";

function makeMockModel(responses) {
  let i = 0;
  return {
    formatMessage: ({ role, content }) => ({ role, content, extra: {} }),
    query: async () => {
      const resp = responses[i++];
      if (!resp) throw new Error("No more responses");
      return resp;
    },
    formatObservationMessages: (message, outputs, vars) => {
      return outputs.map(o => ({ role: "tool", content: `rc=${o.returncode}`, extra: {} }));
    },
    getTemplateVars: () => ({ model_name: "mock" }),
    serialize: () => ({}),
  };
}

function makeMockEnv(outputs) {
  let i = 0;
  return {
    execute: async (action) => outputs[i++] || { output: "", returncode: 0, exception_info: "" },
    getTemplateVars: () => ({ cwd: "/tmp" }),
    serialize: () => ({}),
  };
}

describe("DefaultAgent", () => {
  it("extends EventEmitter", () => {
    const agent = new DefaultAgent(makeMockModel([]), makeMockEnv([]), {
      systemTemplate: "sys", instanceTemplate: "task", stepLimit: 0, costLimit: 0,
    });
    expect(agent).toBeInstanceOf(EventEmitter);
  });

  it("emits step event on each query", async () => {
    const model = makeMockModel([]);
    let callCount = 0;
    model.query = async () => {
      callCount++;
      if (callCount === 1) return { role: "assistant", content: "", extra: { actions: [{ command: "echo hi" }], cost: 0.01 } };
      return { role: "exit", content: "done", extra: { exit_status: "Submitted", submission: "done", cost: 0 } };
    };
    const env = makeMockEnv([{ output: "hi", returncode: 0, exception_info: "" }]);
    const agent = new DefaultAgent(model, env, {
      systemTemplate: "sys", instanceTemplate: "task", stepLimit: 0, costLimit: 0,
    });
    const steps = [];
    agent.on("step", (d) => steps.push(d));
    await agent.run("test task");
    expect(steps.length).toBeGreaterThanOrEqual(1);
  });

  it("stops on exit role", async () => {
    const model = makeMockModel([]);
    let callCount = 0;
    model.query = async () => {
      callCount++;
      return { role: "exit", content: "done", extra: { exit_status: "Submitted", submission: "done", cost: 0 } };
    };
    const env = makeMockEnv([]);
    const agent = new DefaultAgent(model, env, {
      systemTemplate: "sys", instanceTemplate: "task", stepLimit: 0, costLimit: 0,
    });
    const result = await agent.run("test");
    expect(result.exit_status).toBe("Submitted");
  });

  it("exits gracefully on LimitsExceeded (step limit)", async () => {
    const model = makeMockModel([]);
    let callCount = 0;
    model.query = async () => {
      callCount++;
      return { role: "assistant", content: "", extra: { actions: [{ command: "ls" }], cost: 0 } };
    };
    const env = makeMockEnv([{ output: "", returncode: 0, exception_info: "" }]);
    const agent = new DefaultAgent(model, env, {
      systemTemplate: "sys", instanceTemplate: "task", stepLimit: 1, costLimit: 0,
    });
    const result = await agent.run("test");
    expect(result.exit_status).toBe("LimitsExceeded");
  });

  it("saves trajectory to file", async () => {
    const model = makeMockModel([]);
    model.query = async () => ({ role: "exit", content: "done", extra: { exit_status: "Submitted", submission: "done", cost: 0 } });
    const env = makeMockEnv([]);
    const outputPath = "/tmp/test_mini_traj_default.json";
    const agent = new DefaultAgent(model, env, {
      systemTemplate: "sys", instanceTemplate: "task", stepLimit: 0, costLimit: 0, outputPath,
    });
    await agent.run("test");
    expect(fs.existsSync(outputPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    expect(data.trajectory_format).toBe("mini-agent-1.0");
    fs.unlinkSync(outputPath);
  });
});
