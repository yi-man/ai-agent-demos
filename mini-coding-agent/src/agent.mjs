import { resolve } from "path";
import { existsSync, statSync } from "fs";
import { now, clip } from "./util.mjs";
import { MAX_HISTORY } from "./constants.mjs";
import { buildTools, toolExample, validateTool } from "./tools.mjs";

export class MiniAgent {
  constructor({
    modelClient,
    workspace,
    sessionStore,
    session = null,
    approvalPolicy = "ask",
    maxSteps = 6,
    maxNewTokens = 512,
    depth = 0,
    maxDepth = 1,
    readOnly = false,
    approveFn = null,
  }) {
    this.modelClient = modelClient;
    this.workspace = workspace;
    this.root = workspace.repoRoot;
    this.sessionStore = sessionStore;
    this.approvalPolicy = approvalPolicy;
    this.maxSteps = maxSteps;
    this.maxNewTokens = maxNewTokens;
    this.depth = depth;
    this.maxDepth = maxDepth;
    this.readOnly = readOnly;
    this.approveFn = approveFn;
    this.session = session || {
      id: formatDateId(),
      created_at: now(),
      workspace_root: workspace.repoRoot,
      history: [],
      memory: { task: "", files: [], notes: [] },
    };
    this.tools = buildTools(this);
    this.prefix = this.buildPrefix();
    this.sessionPath = this.sessionStore.save(this.session);
  }

  static fromSession({ modelClient, workspace, sessionStore, sessionId, approveFn, ...rest }) {
    const agent = new MiniAgent({
      modelClient,
      workspace,
      sessionStore,
      session: sessionStore.load(sessionId),
      approveFn,
      ...rest,
    });
    return agent;
  }

  static remember(bucket, item, limit) {
    if (!item) return;
    const idx = bucket.indexOf(item);
    if (idx !== -1) bucket.splice(idx, 1);
    bucket.push(item);
    while (bucket.length > limit) bucket.shift();
  }

  resolvePath(rawPath) {
    const p = rawPath ? resolve(this.root, rawPath) : this.root;
    const resolved = resolve(p);
    if (!this.pathIsWithinRoot(resolved)) {
      throw new Error(`路径逃逸出工作区: ${rawPath}`);
    }
    return resolved;
  }

  pathIsWithinRoot(resolved) {
    let probe = resolved;
    while (!existsSync(probe) && probe !== resolve(probe, "..")) {
      probe = resolve(probe, "..");
    }
    let candidate = probe;
    while (true) {
      try {
        if (existsSync(candidate) && statSync(candidate).isDirectory()) {
          // sameFile check: compare resolved paths
          if (resolve(candidate) === resolve(this.root)) return true;
        }
      } catch {}
      const parent = resolve(candidate, "..");
      if (parent === candidate) break;
      candidate = parent;
    }
    // fallback: check if resolved starts with root
    return resolved === this.root || resolved.startsWith(this.root + "/");
  }

  buildPrefix() {
    const toolLines = Object.entries(this.tools).map(([name, tool]) => {
      const fields = Object.entries(tool.schema).map(([k, v]) => `${k}: ${v}`).join(", ");
      const risk = tool.risky ? "需要审批" : "安全";
      return `- ${name}(${fields}) [${risk}] ${tool.description}`;
    });

    const examples = [
      '<tool>{"name":"list_files","args":{"path":"."}}</tool>',
      '<tool>{"name":"read_file","args":{"path":"README.md","start":1,"end":80}}</tool>',
      '<tool name="write_file" path="binary_search.py"><content>def binary_search(nums, target):\n    return -1\n</content></tool>',
      '<tool name="patch_file" path="binary_search.py"><old_text>return -1</old_text><new_text>return mid</new_text></tool>',
      '<tool>{"name":"run_shell","args":{"command":"bun test","timeout":20}}</tool>',
      "<final>完成。</final>",
    ];

    const rules = [
      "- 使用工具来了解工作区，不要猜测。",
      "- 每次只返回一个 <tool>...</tool> 或一个 <final>...</final>。",
      "- 工具调用格式:",
      '  <tool>{"name":"tool_name","args":{...}}</tool>',
      "- 对于 write_file 和 patch_file 的多行文本，优先使用 XML 格式:",
      '  <tool name="write_file" path="file.py"><content>...</content></tool>',
      "- 最终答案格式:",
      "  <final>你的回答</final>",
      "- 不要编造工具结果。",
      "- 回答要简洁具体。",
      "- 如果用户要求创建或更新某个文件且路径明确，直接使用 write_file 或 patch_file，不要反复列出文件。",
      "- 写测试前先读实现代码。",
      "- 写测试时匹配当前实现，除非用户明确要求修改代码。",
      "- 新文件必须完整可运行，包含必要的 import。",
      "- 如果相同的工具调用没有帮助，不要重复。换一个工具或直接给出最终答案。",
      "- 工具参数不能为空。不要用 args={} 调用 read_file、write_file、patch_file、run_shell 或 delegate。",
    ];

    return [
      "你是 Mini-Coding-Agent，一个通过 OpenAI 兼容 API 运行的小型本地编程助手。",
      "规则:\n" + rules.join("\n"),
      "工具:\n" + toolLines.join("\n"),
      "响应示例:\n" + examples.join("\n"),
      this.workspace.text(),
    ].join("\n\n");
  }

  memoryText() {
    const memory = this.session.memory;
    const notes = memory.notes.length ? memory.notes.map((n) => `- ${n}`).join("\n") : "- 无";
    return [
      "记忆:",
      `- 任务: ${memory.task || "-"}`,
      `- 文件: ${memory.files.join(", ") || "-"}`,
      "- 备注:",
      notes,
    ].join("\n");
  }

  historyText() {
    const history = this.session.history;
    if (!history.length) return "- 空";

    const lines = [];
    const seenReads = new Set();
    const recentStart = Math.max(0, history.length - 6);

    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      const recent = i >= recentStart;

      if (item.role === "tool" && (item.name === "write_file" || item.name === "patch_file")) {
        seenReads.delete(String(item.args?.path || ""));
      }
      if (item.role === "tool" && item.name === "read_file" && !recent) {
        const p = String(item.args?.path || "");
        if (seenReads.has(p)) continue;
        seenReads.add(p);
      }

      if (item.role === "tool") {
        const limit = recent ? 900 : 180;
        lines.push(`[tool:${item.name}] ${JSON.stringify(item.args || {}, null, 0)}`);
        lines.push(clip(item.content, limit));
      } else {
        const limit = recent ? 900 : 220;
        lines.push(`[${item.role}] ${clip(item.content, limit)}`);
      }
    }

    return clip(lines.join("\n"), MAX_HISTORY);
  }

  prompt(userMessage) {
    return [
      this.prefix,
      this.memoryText(),
      "对话记录:\n" + this.historyText(),
      "当前用户请求:\n" + userMessage,
    ].join("\n\n");
  }

  buildMessages(userMessage) {
    return [
      { role: "system", content: this.prompt(userMessage) },
      { role: "user", content: userMessage },
    ];
  }

  record(item) {
    this.session.history.push(item);
    this.sessionPath = this.sessionStore.save(this.session);
  }

  noteTool(name, args, result) {
    const memory = this.session.memory;
    const path = args?.path;
    if (["read_file", "write_file", "patch_file"].includes(name) && path) {
      MiniAgent.remember(memory.files, String(path), 8);
    }
    const note = `${name}: ${clip(String(result).replace(/\n/g, " "), 220)}`;
    MiniAgent.remember(memory.notes, note, 5);
  }

  async ask(userMessage) {
    const memory = this.session.memory;
    if (!memory.task) {
      memory.task = clip(userMessage.trim(), 300);
    }
    this.record({ role: "user", content: userMessage, created_at: now() });

    let toolSteps = 0;
    let attempts = 0;
    const maxAttempts = Math.max(this.maxSteps * 3, this.maxSteps + 4);

    while (toolSteps < this.maxSteps && attempts < maxAttempts) {
      attempts++;
      const messages = this.buildMessages(userMessage);
      const raw = await this.modelClient.complete(messages, this.maxNewTokens);
      const [kind, payload] = MiniAgent.parse(raw);

      if (kind === "tool") {
        toolSteps++;
        const name = payload.name || "";
        const args = payload.args || {};
        const result = await this.runTool(name, args);
        this.record({ role: "tool", name, args, content: result, created_at: now() });
        this.noteTool(name, args, result);
        continue;
      }

      if (kind === "retry") {
        this.record({ role: "assistant", content: payload, created_at: now() });
        continue;
      }

      const final_ = (payload || raw).trim();
      this.record({ role: "assistant", content: final_, created_at: now() });
      MiniAgent.remember(memory.notes, clip(final_, 220), 5);
      return final_;
    }

    let final_;
    if (attempts >= maxAttempts && toolSteps < this.maxSteps) {
      final_ = "模型返回了过多格式错误的响应，无法得到有效工具调用或最终答案，已停止。";
    } else {
      final_ = "已达步数上限，未得到最终答案，已停止。";
    }
    this.record({ role: "assistant", content: final_, created_at: now() });
    return final_;
  }

  async runTool(name, args) {
    const tool = this.tools[name];
    if (!tool) return `错误: 未知工具 '${name}'`;

    try {
      validateTool(this, name, args);
    } catch (err) {
      const example = toolExample(name);
      let msg = `错误: ${name} 参数无效: ${err.message}`;
      if (example) msg += `\n示例: ${example}`;
      return msg;
    }

    if (this.repeatedToolCall(name, args)) {
      return `错误: ${name} 重复调用，请换一个工具或直接给出最终答案`;
    }

    if (tool.risky && !(await this.approve(name, args))) {
      return `错误: ${name} 审批被拒绝`;
    }

    try {
      return clip(await tool.run(args));
    } catch (err) {
      return `错误: 工具 ${name} 执行失败: ${err.message}`;
    }
  }

  repeatedToolCall(name, args) {
    const toolEvents = this.session.history.filter((item) => item.role === "tool");
    if (toolEvents.length < 2) return false;
    const recent = toolEvents.slice(-2);
    return recent.every((item) => item.name === name && JSON.stringify(item.args) === JSON.stringify(args));
  }

  async approve(name, args) {
    if (this.readOnly) return false;
    if (this.approvalPolicy === "auto") return true;
    if (this.approvalPolicy === "never") return false;
    if (this.approveFn) return this.approveFn(name, args);
    return false;
  }

  async toolDelegate(args) {
    if (this.depth >= this.maxDepth) throw new Error("委托深度已超限");
    const task = String(args.task || "").trim();
    if (!task) throw new Error("任务不能为空");

    const child = new MiniAgent({
      modelClient: this.modelClient,
      workspace: this.workspace,
      sessionStore: this.sessionStore,
      approvalPolicy: "never",
      maxSteps: Number(args.max_steps ?? 3),
      maxNewTokens: this.maxNewTokens,
      depth: this.depth + 1,
      maxDepth: this.maxDepth,
      readOnly: true,
    });
    child.session.memory.task = task;
    child.session.memory.notes = [clip(this.historyText(), 300)];
    return "delegate_result:\n" + (await child.ask(task));
  }

  reset() {
    this.session.history = [];
    this.session.memory = { task: "", files: [], notes: [] };
    this.sessionStore.save(this.session);
  }

  static parse(raw) {
    raw = String(raw);

    if (raw.includes("<tool>") && (!raw.includes("<final>") || raw.indexOf("<tool>") < raw.indexOf("<final>"))) {
      const body = MiniAgent.extract(raw, "tool");
      try {
        const payload = JSON.parse(body);
        if (typeof payload !== "object" || payload === null) {
          return ["retry", MiniAgent.retryNotice("工具载荷必须是 JSON 对象")];
        }
        if (!String(payload.name || "").trim()) {
          return ["retry", MiniAgent.retryNotice("工具载荷缺少工具名称")];
        }
        if (payload.args === null || payload.args === undefined) payload.args = {};
        if (typeof payload.args !== "object") return ["retry", MiniAgent.retryNotice()];
        return ["tool", payload];
      } catch {
        return ["retry", MiniAgent.retryNotice("模型返回了格式错误的工具 JSON")];
      }
    }

    if (raw.includes("<tool") && (!raw.includes("<final>") || raw.indexOf("<tool") < raw.indexOf("<final>"))) {
      const payload = MiniAgent.parseXmlTool(raw);
      if (payload) return ["tool", payload];
      return ["retry", MiniAgent.retryNotice()];
    }

    if (raw.includes("<final>")) {
      const final_ = MiniAgent.extract(raw, "final").trim();
      if (final_) return ["final", final_];
      return ["retry", MiniAgent.retryNotice("模型返回了空的 <final> 答案")];
    }

    const trimmed = raw.trim();
    if (trimmed) return ["final", trimmed];
    return ["retry", MiniAgent.retryNotice("模型返回了空的响应")];
  }

  static retryNotice(problem) {
    let prefix = "运行时提示";
    if (problem) prefix += `: ${problem}`;
    else prefix += ": 模型返回了格式错误的工具输出";
    return `${prefix}。请回复有效的 <tool> 调用或非空的 <final> 答案。对于多行文件，请使用 <tool name="write_file" path="file.py"><content>...</content></tool> 格式。`;
  }

  static parseXmlTool(raw) {
    const match = raw.match(/<tool(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/tool>/);
    if (!match) return null;
    const attrs = MiniAgent.parseAttrs(match.groups.attrs);
    const name = String(attrs.name || "").trim();
    if (!name) return null;
    delete attrs.name;

    const body = match.groups.body;
    const args = { ...attrs };
    for (const key of ["content", "old_text", "new_text", "command", "task", "pattern", "path"]) {
      if (body.includes(`<${key}>`)) {
        args[key] = MiniAgent.extractRaw(body, key);
      }
    }

    const bodyText = body.replace(/^\n+|\n+$/g, "");
    if (name === "write_file" && !("content" in args) && bodyText) args.content = bodyText;
    if (name === "delegate" && !("task" in args) && bodyText) args.task = bodyText.trim();
    return { name, args };
  }

  static parseAttrs(text) {
    const attrs = {};
    const re = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(text))) {
      attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
    }
    return attrs;
  }

  static extract(text, tag) {
    const startTag = `<${tag}>`;
    const endTag = `</${tag}>`;
    const start = text.indexOf(startTag);
    if (start === -1) return text;
    const bodyStart = start + startTag.length;
    const end = text.indexOf(endTag, bodyStart);
    if (end === -1) return text.slice(bodyStart).trim();
    return text.slice(bodyStart, end).trim();
  }

  static extractRaw(text, tag) {
    const startTag = `<${tag}>`;
    const endTag = `</${tag}>`;
    const start = text.indexOf(startTag);
    if (start === -1) return text;
    const bodyStart = start + startTag.length;
    const end = text.indexOf(endTag, bodyStart);
    if (end === -1) return text.slice(bodyStart);
    return text.slice(bodyStart, end);
  }
}

function formatDateId() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(16).slice(2, 8);
  return `${ts}-${rand}`;
}
