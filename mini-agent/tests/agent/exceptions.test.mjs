import { describe, it, expect } from "bun:test";
import { InterruptAgentFlow, Submitted, LimitsExceeded, FormatError, UserInterruption } from "../../src/agent/exceptions.mjs";

describe("InterruptAgentFlow", () => {
  it("stores messages", () => {
    const msg = { role: "exit", content: "done" };
    const e = new InterruptAgentFlow(msg);
    expect(e.messages).toEqual([msg]);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(InterruptAgentFlow);
  });

  it("Submitted extends InterruptAgentFlow", () => {
    expect(new Submitted()).toBeInstanceOf(InterruptAgentFlow);
  });

  it("LimitsExceeded extends InterruptAgentFlow", () => {
    expect(new LimitsExceeded()).toBeInstanceOf(InterruptAgentFlow);
  });

  it("FormatError extends InterruptAgentFlow", () => {
    expect(new FormatError()).toBeInstanceOf(InterruptAgentFlow);
  });

  it("UserInterruption extends InterruptAgentFlow", () => {
    expect(new UserInterruption()).toBeInstanceOf(InterruptAgentFlow);
  });
});
