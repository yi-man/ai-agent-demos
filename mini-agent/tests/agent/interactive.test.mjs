import { describe, it, expect } from "bun:test";
import { InteractiveAgent } from "../../src/agent/interactive.mjs";

function makeMockModel() {
  let callCount = 0;
  return {
    formatMessage: ({ role, content }) => ({ role, content, extra: {} }),
    query: async () => {
      callCount++;
      if (callCount <= 1) return { role: "assistant", content: "thinking", extra: { actions: [{ command: "echo hi" }], cost: 0 } };
      return { role: "exit", content: "done", extra: { exit_status: "Submitted", submission: "done", cost: 0 } };
    },
    formatObservationMessages: (msg, outputs) => outputs.map(o => ({ role: "tool", content: "ok", extra: {} })),
    getTemplateVars: () => ({}),
    serialize: () => ({}),
  };
}

function makeMockEnv() {
  return {
    execute: async () => ({ output: "hi", returncode: 0, exception_info: "" }),
    getTemplateVars: () => ({}),
    serialize: () => ({}),
  };
}

describe("InteractiveAgent", () => {
  it("extends DefaultAgent", () => {
    const agent = new InteractiveAgent(makeMockModel(), makeMockEnv(), {
      systemTemplate: "sys", instanceTemplate: "task", mode: "yolo", stepLimit: 0, costLimit: 0,
    });
    expect(agent.mode).toBe("yolo");
  });

  it("yolo mode executes without confirmation", async () => {
    const agent = new InteractiveAgent(makeMockModel(), makeMockEnv(), {
      systemTemplate: "sys", instanceTemplate: "task", mode: "yolo", stepLimit: 0, costLimit: 0,
    });
    const result = await agent.run("test");
    expect(result.exit_status).toBe("Submitted");
  });

  it("handles yolo mode full run", async () => {
    const model = makeMockModel();
    model.query = async () => ({ role: "exit", content: "done", extra: { exit_status: "Submitted", submission: "done", cost: 0 } });
    const agent = new InteractiveAgent(model, makeMockEnv(), {
      systemTemplate: "sys", instanceTemplate: "task", mode: "yolo", stepLimit: 0, costLimit: 0,
    });
    const result = await agent.run("test");
    expect(result.exit_status).toBe("Submitted");
  });
});
