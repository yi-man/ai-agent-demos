import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { WorkspaceContext } from "../src/workspace.mjs";
import { SessionStore } from "../src/session.mjs";
import { FakeModelClient } from "../src/model.mjs";
import { MiniAgent } from "../src/agent.mjs";

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "mini-agent-test-"));
}

function buildWorkspace(tmpDir) {
  writeFileSync(join(tmpDir, "README.md"), "demo\n", "utf-8");
  return WorkspaceContext.build(tmpDir);
}

function buildAgent(tmpDir, outputs, opts = {}) {
  const workspace = buildWorkspace(tmpDir);
  const store = new SessionStore(join(tmpDir, ".mini-coding-agent", "sessions"));
  return new MiniAgent({
    modelClient: new FakeModelClient(outputs),
    workspace,
    sessionStore: store,
    approvalPolicy: opts.approvalPolicy || "auto",
    ...opts,
  });
}

describe("MiniAgent", () => {
  test("runs tool then final", async () => {
    const tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, "hello.txt"), "alpha\nbeta\n", "utf-8");
    const agent = buildAgent(tmpDir, [
      '<tool>{"name":"read_file","args":{"path":"hello.txt","start":1,"end":2}}</tool>',
      "<final>Read the file successfully.</final>",
    ]);

    const answer = await agent.ask("Inspect hello.txt");
    expect(answer).toBe("Read the file successfully.");
    expect(agent.session.history.some((i) => i.role === "tool" && i.name === "read_file")).toBe(true);
    expect(agent.session.memory.files).toContain("hello.txt");
  });

  test("retries after empty model output", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, ["", "<final>Recovered after retry.</final>"]);

    const answer = await agent.ask("Do the task");
    expect(answer).toBe("Recovered after retry.");
    const notices = agent.session.history.filter((i) => i.role === "assistant").map((i) => i.content);
    expect(notices.some((n) => n.includes("空的响应"))).toBe(true);
  });

  test("retries after malformed tool payload", async () => {
    const tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, "hello.txt"), "alpha\n", "utf-8");
    const agent = buildAgent(tmpDir, [
      '<tool>{"name":"read_file","args":"bad"}</tool>',
      '<tool>{"name":"read_file","args":{"path":"hello.txt","start":1,"end":1}}</tool>',
      "<final>Recovered after malformed tool output.</final>",
    ]);

    const answer = await agent.ask("Inspect hello.txt");
    expect(answer).toBe("Recovered after malformed tool output.");
    expect(agent.session.history.some((i) => i.role === "tool" && i.name === "read_file")).toBe(true);
    const notices = agent.session.history.filter((i) => i.role === "assistant").map((i) => i.content);
    expect(notices.some((n) => n.includes("有效的 <tool> 调用"))).toBe(true);
  });

  test("accepts XML write_file tool", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, [
      '<tool name="write_file" path="hello.py"><content>print("hi")\n</content></tool>',
      "<final>Done.</final>",
    ]);

    const answer = await agent.ask("Create hello.py");
    expect(answer).toBe("Done.");
    expect(readFileSync(join(tmpDir, "hello.py"), "utf-8")).toBe('print("hi")\n');
  });

  test("retries do not consume the whole budget", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, ["", "", "<final>Recovered after several retries.</final>"], {
      maxSteps: 1,
    });

    const answer = await agent.ask("Do the task");
    expect(answer).toBe("Recovered after several retries.");
  });

  test("saves and resumes session", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, ["<final>First pass.</final>"]);
    expect(await agent.ask("Start a session")).toBe("First pass.");

    const resumed = MiniAgent.fromSession({
      modelClient: new FakeModelClient(["<final>Resumed.</final>"]),
      workspace: agent.workspace,
      sessionStore: agent.sessionStore,
      sessionId: agent.session.id,
      approvalPolicy: "auto",
    });

    expect(resumed.session.history[0].content).toBe("Start a session");
    expect(await resumed.ask("Continue")).toBe("Resumed.");
  });

  test("delegate uses child agent", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, [
      '<tool>{"name":"delegate","args":{"task":"inspect README","max_steps":2}}</tool>',
      "<final>Child result.</final>",
      "<final>Parent incorporated the child result.</final>",
    ]);

    const answer = await agent.ask("Use delegation");
    expect(answer).toBe("Parent incorporated the child result.");
    const toolEvents = agent.session.history.filter((i) => i.role === "tool");
    expect(toolEvents[0].name).toBe("delegate");
    expect(toolEvents[0].content).toContain("delegate_result");
  });

  test("patch_file replaces exact match", async () => {
    const tmpDir = makeTmpDir();
    const filePath = join(tmpDir, "sample.txt");
    writeFileSync(filePath, "hello world\n", "utf-8");
    const agent = buildAgent(tmpDir, []);

    const result = await agent.runTool("patch_file", {
      path: "sample.txt",
      old_text: "world",
      new_text: "agent",
    });

    expect(result).toBe("已修补 sample.txt");
    expect(readFileSync(filePath, "utf-8")).toBe("hello agent\n");
  });

  test("invalid risky tool does not prompt for approval", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, [], { approvalPolicy: "ask" });

    const result = await agent.runTool("write_file", {});
    expect(result.startsWith("错误: write_file 参数无效:")).toBe(true);
    expect(result).toContain('示例: <tool name="write_file"');
  });

  test("list_files hides internal agent state", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, []);
    mkdirSync(join(tmpDir, ".mini-coding-agent"), { recursive: true });
    mkdirSync(join(tmpDir, ".git"), { recursive: true });
    writeFileSync(join(tmpDir, "hello.txt"), "hi\n", "utf-8");

    const result = await agent.runTool("list_files", {});
    expect(result).not.toContain(".mini-coding-agent");
    expect(result).not.toContain(".git");
    expect(result).toContain("[F] hello.txt");
  });

  test("path rejects parent escape", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, []);

    expect(() => agent.resolvePath("../outside.txt")).toThrow("路径逃逸出工作区");
  });

  test("repeated identical tool call is rejected", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, []);
    agent.record({ role: "tool", name: "list_files", args: {}, content: "(empty)", created_at: "1" });
    agent.record({ role: "tool", name: "list_files", args: {}, content: "(empty)", created_at: "2" });

    const result = await agent.runTool("list_files", {});
    expect(result).toBe("错误: list_files 重复调用，请换一个工具或直接给出最终答案");
  });

  test("history_text deduplicates reads but not after write", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, []);

    agent.record({ role: "user", content: "update config", created_at: "0" });
    agent.record({ role: "assistant", content: '<tool>{"name":"read_file","args":{"path":"config.txt"}}</tool>', created_at: "1" });
    agent.record({ role: "tool", name: "read_file", args: { path: "config.txt" }, content: "# config.txt\n   1: setting=true\n", created_at: "2" });
    agent.record({ role: "assistant", content: '<tool>{"name":"write_file","args":{"path":"config.txt","content":"setting=false\\n"}}</tool>', created_at: "3" });
    agent.record({ role: "tool", name: "write_file", args: { path: "config.txt" }, content: "wrote config.txt", created_at: "4" });
    agent.record({ role: "assistant", content: '<tool>{"name":"read_file","args":{"path":"config.txt"}}</tool>', created_at: "5" });
    agent.record({ role: "tool", name: "read_file", args: { path: "config.txt" }, content: "# config.txt\n   1: setting=false\n", created_at: "6" });
    for (let i = 7; i < 13; i++) {
      agent.record({ role: "tool", name: "list_files", args: {}, content: "", created_at: String(i) });
    }

    const history = agent.historyText();
    expect(history).toContain("# config.txt\n   1: setting=true\n");
    expect(history).toContain("# config.txt\n   1: setting=false\n");
    expect(history.split("setting=true").length - 1).toBe(1);
  });

  test("history_text deduplicates unchanged repeated reads", async () => {
    const tmpDir = makeTmpDir();
    const agent = buildAgent(tmpDir, []);

    agent.record({ role: "user", content: "check logs", created_at: "0" });
    agent.record({ role: "assistant", content: '<tool>{"name":"read_file","args":{"path":"log.txt"}}</tool>', created_at: "1" });
    agent.record({ role: "tool", name: "read_file", args: { path: "log.txt" }, content: "# log.txt\n   1: stable\n", created_at: "2" });
    agent.record({ role: "assistant", content: '<tool>{"name":"read_file","args":{"path":"log.txt"}}</tool>', created_at: "3" });
    for (let i = 4; i < 10; i++) {
      agent.record({ role: "tool", name: "list_files", args: {}, content: "", created_at: String(i) });
    }

    const history = agent.historyText();
    expect(history.split("stable").length - 1).toBe(1);
  });
});

describe("MiniAgent.parse", () => {
  test("parses JSON tool call", () => {
    const [kind, payload] = MiniAgent.parse('<tool>{"name":"read_file","args":{"path":"a.txt"}}</tool>');
    expect(kind).toBe("tool");
    expect(payload.name).toBe("read_file");
    expect(payload.args.path).toBe("a.txt");
  });

  test("parses XML tool call", () => {
    const [kind, payload] = MiniAgent.parse('<tool name="write_file" path="a.txt"><content>hello</content></tool>');
    expect(kind).toBe("tool");
    expect(payload.name).toBe("write_file");
    expect(payload.args.path).toBe("a.txt");
    expect(payload.args.content).toBe("hello");
  });

  test("parses final answer", () => {
    const [kind, payload] = MiniAgent.parse("<final>Done.</final>");
    expect(kind).toBe("final");
    expect(payload).toBe("Done.");
  });

  test("returns raw text as final if no tags", () => {
    const [kind, payload] = MiniAgent.parse("Just some text.");
    expect(kind).toBe("final");
    expect(payload).toBe("Just some text.");
  });

  test("returns retry for empty response", () => {
    const [kind] = MiniAgent.parse("");
    expect(kind).toBe("retry");
  });

  test("returns retry for empty final", () => {
    const [kind] = MiniAgent.parse("<final></final>");
    expect(kind).toBe("retry");
  });
});
