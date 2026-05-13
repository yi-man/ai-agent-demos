#!/usr/bin/env bun
import { parseArgs } from "util";
import { createInterface } from "readline";
import { WorkspaceContext } from "./src/workspace.mjs";
import { SessionStore } from "./src/session.mjs";
import { OpenAIModelClient } from "./src/model.mjs";
import { MiniAgent } from "./src/agent.mjs";
import { buildWelcome } from "./src/welcome.mjs";
import { HELP_DETAILS } from "./src/constants.mjs";

const env = Bun.env;

const { values: args, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    cwd: { type: "string", default: env.MINI_AGENT_CWD || "." },
    model: { type: "string", default: env.MINI_AGENT_MODEL || "qwen3.5:4b" },
    "base-url": { type: "string", default: env.MINI_AGENT_BASE_URL || env.OPENAI_BASE_URL || "http://localhost:11434/v1" },
    "api-key": { type: "string", default: env.MINI_AGENT_API_KEY || env.OPENAI_API_KEY || "" },
    timeout: { type: "string", default: env.MINI_AGENT_TIMEOUT || "300" },
    resume: { type: "string", default: "" },
    approval: { type: "string", default: env.MINI_AGENT_APPROVAL || "ask" },
    "max-steps": { type: "string", default: env.MINI_AGENT_MAX_STEPS || "6" },
    "max-new-tokens": { type: "string", default: env.MINI_AGENT_MAX_NEW_TOKENS || "512" },
    temperature: { type: "string", default: env.MINI_AGENT_TEMPERATURE || "0.2" },
    "top-p": { type: "string", default: env.MINI_AGENT_TOP_P || "0.9" },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: false,
  allowPositionals: true,
});

if (args.help) {
  console.log(`用法: mini-coding-agent [选项] [提示...]

基于 OpenAI 兼容 API 的本地编程助手。

选项:
  --cwd <dir>          工作区目录 (默认: .)
  --model <name>       模型名称 (默认: qwen3.5:4b)
  --base-url <url>     API 基础 URL (默认: http://localhost:11434/v1)
  --api-key <key>      API 密钥
  --timeout <sec>      请求超时秒数 (默认: 300)
  --resume <id>        恢复会话 ID 或 'latest'
  --approval <mode>    ask, auto, 或 never (默认: ask)
  --max-steps <n>      每次请求最大工具/模型轮次 (默认: 6)
  --max-new-tokens <n> 每步最大输出 token 数 (默认: 512)
  --temperature <t>    采样温度 (默认: 0.2)
  --top-p <p>          Top-p 采样值 (默认: 0.9)
  -h, --help           显示帮助`);
  process.exit(0);
}

const approval = args.approval;
if (!["ask", "auto", "never"].includes(approval)) {
  console.error(`error: --approval must be ask, auto, or never, got: ${approval}`);
  process.exit(1);
}

const workspace = WorkspaceContext.build(args.cwd);
const store = new SessionStore(`${workspace.repoRoot}/.mini-coding-agent/sessions`);
const modelClient = new OpenAIModelClient({
  model: args.model,
  baseUrl: args["base-url"],
  apiKey: args["api-key"],
  temperature: parseFloat(args.temperature),
  topP: parseFloat(args["top-p"]),
  timeout: parseInt(args.timeout, 10),
});

// Single readline on stdin: two interfaces cause doubled echo in REPL (each key handled twice).
const stdinRl = createInterface({ input: process.stdin, output: process.stdout });
function askApproval(name, toolArgs) {
  return new Promise((resolve) => {
    stdinRl.question(`审批 ${name} ${JSON.stringify(toolArgs)}? [y/N] `, (answer) => {
      const ok = answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
      resolve(ok);
    });
  });
}

function makeAgent(sessionId) {
  const opts = {
    modelClient,
    workspace,
    sessionStore: store,
    approvalPolicy: approval,
    maxSteps: parseInt(args["max-steps"], 10),
    maxNewTokens: parseInt(args["max-new-tokens"], 10),
    approveFn: askApproval,
  };
  if (sessionId) return MiniAgent.fromSession({ ...opts, sessionId });
  return new MiniAgent(opts);
}

let sessionId = args.resume;
if (sessionId === "latest") sessionId = store.latest();
const agent = makeAgent(sessionId || undefined);

console.log(buildWelcome(agent, args.model, args["base-url"]));

async function runPrompt(prompt) {
  try {
    console.log(await agent.ask(prompt));
  } catch (err) {
    console.error(err.message);
  }
}

if (positionals.length) {
  await runPrompt(positionals.join(" "));
  stdinRl.close();
  process.exit(0);
}

// REPL (reuse stdinRl — do not create a second createInterface on stdin)
function prompt() {
  return new Promise((resolve) => stdinRl.question("\nmini-coding-agent> ", resolve));
}

while (true) {
  let input;
  try {
    input = (await prompt()).trim();
  } catch {
    console.log("");
    break;
  }
  if (!input) continue;
  if (input === "/exit" || input === "/quit") break;
  if (input === "/help") { console.log(HELP_DETAILS); continue; }
  if (input === "/memory") { console.log(agent.memoryText()); continue; }
  if (input === "/session") { console.log(agent.sessionPath); continue; }
  if (input === "/reset") { agent.reset(); console.log("会话已重置"); continue; }

  console.log("");
  await runPrompt(input);
}

stdinRl.close();
process.exit(0);
