import { resolve, relative } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from "fs";
import { execFileSync } from "child_process";
import { IGNORED_PATH_NAMES } from "./constants.mjs";

export function buildTools(agent) {
  return {
    list_files: {
      schema: { path: "str='.'" },
      risky: false,
      description: "列出工作区中的文件。",
      run: (args) => toolListFiles(agent, args),
    },
    read_file: {
      schema: { path: "str", start: "int=1", end: "int=200" },
      risky: false,
      description: "按行范围读取 UTF-8 文件。",
      run: (args) => toolReadFile(agent, args),
    },
    search: {
      schema: { pattern: "str", path: "str='.'" },
      risky: false,
      description: "使用 rg 或简单回退搜索工作区。",
      run: (args) => toolSearch(agent, args),
    },
    run_shell: {
      schema: { command: "str", timeout: "int=20" },
      risky: true,
      description: "在仓库根目录执行 shell 命令。",
      run: (args) => toolRunShell(agent, args),
    },
    write_file: {
      schema: { path: "str", content: "str" },
      risky: true,
      description: "写入文本文件。",
      run: (args) => toolWriteFile(agent, args),
    },
    patch_file: {
      schema: { path: "str", old_text: "str", new_text: "str" },
      risky: true,
      description: "精确替换文件中的一段文本。",
      run: (args) => toolPatchFile(agent, args),
    },
    ...(agent.depth < agent.maxDepth
      ? {
          delegate: {
            schema: { task: "str", max_steps: "int=3" },
            risky: false,
            description: "委托一个受限的只读子 agent 进行调查。",
            run: (args) => agent.toolDelegate(args),
          },
        }
      : {}),
  };
}

export function toolExample(name) {
  const examples = {
    list_files: '<tool>{"name":"list_files","args":{"path":"."}}</tool>',
    read_file: '<tool>{"name":"read_file","args":{"path":"README.md","start":1,"end":80}}</tool>',
    search: '<tool>{"name":"search","args":{"pattern":"binary_search","path":"."}}</tool>',
    run_shell: '<tool>{"name":"run_shell","args":{"command":"bun test","timeout":20}}</tool>',
    write_file: '<tool name="write_file" path="binary_search.py"><content>def binary_search(nums, target):\n    return -1\n</content></tool>',
    patch_file: '<tool name="patch_file" path="binary_search.py"><old_text>return -1</old_text><new_text>return mid</new_text></tool>',
    delegate: '<tool>{"name":"delegate","args":{"task":"inspect README.md","max_steps":3}}</tool>',
  };
  return examples[name] || "";
}

export function validateTool(agent, name, args) {
  args = args || {};

  if (name === "list_files") {
    const p = agent.resolvePath(args.path || ".");
    if (!statSync(p).isDirectory()) throw new Error("路径不是目录");
    return;
  }

  if (name === "read_file") {
    const p = agent.resolvePath(args.path);
    if (!existsSync(p) || !statSync(p).isFile()) throw new Error("路径不是文件");
    const start = Number(args.start ?? 1);
    const end = Number(args.end ?? 200);
    if (start < 1 || end < start) throw new Error("行范围无效");
    return;
  }

  if (name === "search") {
    const pattern = String(args.pattern || "").trim();
    if (!pattern) throw new Error("搜索模式不能为空");
    agent.resolvePath(args.path || ".");
    return;
  }

  if (name === "run_shell") {
    const command = String(args.command || "").trim();
    if (!command) throw new Error("命令不能为空");
    const timeout = Number(args.timeout ?? 20);
    if (timeout < 1 || timeout > 120) throw new Error("超时必须在 [1, 120] 范围内");
    return;
  }

  if (name === "write_file") {
    const p = agent.resolvePath(args.path);
    if (existsSync(p) && statSync(p).isDirectory()) throw new Error("路径是目录");
    if (!("content" in args)) throw new Error("缺少 content");
    return;
  }

  if (name === "patch_file") {
    const p = agent.resolvePath(args.path);
    if (!existsSync(p) || !statSync(p).isFile()) throw new Error("路径不是文件");
    const oldText = String(args.old_text || "");
    if (!oldText) throw new Error("old_text 不能为空");
    if (!("new_text" in args)) throw new Error("缺少 new_text");
    const text = readFileSync(p, "utf-8");
    const count = text.split(oldText).length - 1;
    if (count !== 1) throw new Error(`old_text 必须恰好出现一次，实际出现 ${count} 次`);
    return;
  }

  if (name === "delegate") {
    if (agent.depth >= agent.maxDepth) throw new Error("委托深度已超限");
    const task = String(args.task || "").trim();
    if (!task) throw new Error("任务不能为空");
    return;
  }
}

function toolListFiles(agent, args) {
  const p = agent.resolvePath(args.path || ".");
  if (!statSync(p).isDirectory()) throw new Error("路径不是目录");
  const entries = readdirSync(p, { withFileTypes: true })
    .filter((e) => !IGNORED_PATH_NAMES.has(e.name))
    .sort((a, b) => {
      const aFile = a.isFile() ? 1 : 0;
      const bFile = b.isFile() ? 1 : 0;
      if (aFile !== bFile) return aFile - bFile;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    })
    .slice(0, 200);

  const lines = entries.map((e) => {
    const kind = e.isDirectory() ? "[D]" : "[F]";
    const rel = relative(agent.root, resolve(p, e.name));
    return `${kind} ${rel}`;
  });
  return lines.join("\n") || "(空)";
}

function toolReadFile(agent, args) {
  const p = agent.resolvePath(args.path);
  if (!existsSync(p) || !statSync(p).isFile()) throw new Error("路径不是文件");
  const start = Number(args.start ?? 1);
  const end = Number(args.end ?? 200);
  if (start < 1 || end < start) throw new Error("行范围无效");

  const lines = readFileSync(p, "utf-8").split("\n");
  const slice = lines.slice(start - 1, end);
  const numbered = slice.map((line, i) => `${String(start + i).padStart(4)}: ${line}`);
  return `# ${relative(agent.root, p)}\n${numbered.join("\n")}`;
}

function toolSearch(agent, args) {
  const pattern = String(args.pattern || "").trim();
  if (!pattern) throw new Error("搜索模式不能为空");
  const p = agent.resolvePath(args.path || ".");

  // Try rg first
  const rgPath = Bun.which("rg");
  if (rgPath) {
    try {
      const out = execFileSync(rgPath, ["-n", "--smart-case", "--max-count", "200", pattern, p], {
        cwd: agent.root,
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return out.trim() || "(无匹配)";
    } catch (err) {
      const stderr = err.stderr?.trim?.() || "";
      const stdout = err.stdout?.trim?.() || "";
      return stdout || stderr || "(无匹配)";
    }
  }

  // Fallback: manual search
  const matches = [];
  const files = statSync(p).isFile()
    ? [p]
    : collectFiles(p, agent.root);

  for (const filePath of files) {
    const lines = readFileSync(filePath, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(pattern.toLowerCase())) {
        matches.push(`${relative(agent.root, filePath)}:${i + 1}:${lines[i]}`);
        if (matches.length >= 200) return matches.join("\n");
      }
    }
  }
  return matches.join("\n") || "(无匹配)";
}

function collectFiles(dir, root) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_PATH_NAMES.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(full, root));
    } else if (entry.isFile()) {
      result.push(full);
    }
  }
  return result;
}

function toolRunShell(agent, args) {
  const command = String(args.command || "").trim();
  if (!command) throw new Error("命令不能为空");
  const timeout = Number(args.timeout ?? 20);
  if (timeout < 1 || timeout > 120) throw new Error("超时必须在 [1, 120] 范围内");

  try {
    const out = execFileSync("sh", ["-c", command], {
      cwd: agent.root,
      encoding: "utf-8",
      timeout: timeout * 1000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return `exit_code: 0\nstdout:\n${out.trim() || "(空)"}\nstderr:\n(空)`;
  } catch (err) {
    const code = err.status ?? 1;
    const stdout = err.stdout?.trim?.() || "(空)";
    const stderr = err.stderr?.trim?.() || "(空)";
    return `exit_code: ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`;
  }
}

function toolWriteFile(agent, args) {
  const p = agent.resolvePath(args.path);
  const content = String(args.content);
  mkdirSync(resolve(p, ".."), { recursive: true });
  writeFileSync(p, content, "utf-8");
  return `已写入 ${relative(agent.root, p)} (${content.length} 字符)`;
}

function toolPatchFile(agent, args) {
  const p = agent.resolvePath(args.path);
  if (!existsSync(p) || !statSync(p).isFile()) throw new Error("路径不是文件");
  const oldText = String(args.old_text || "");
  if (!oldText) throw new Error("old_text 不能为空");
  if (!("new_text" in args)) throw new Error("缺少 new_text");
  const text = readFileSync(p, "utf-8");
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`old_text 必须恰好出现一次，实际出现 ${count} 次`);
  writeFileSync(p, text.replace(oldText, String(args.new_text)), "utf-8");
  return `已修补 ${relative(agent.root, p)}`;
}
