export const DOC_NAMES = ["AGENTS.md", "README.md", "pyproject.toml", "package.json"];
export const HELP_TEXT = "/help, /memory, /session, /reset, /exit";
export const MAX_TOOL_OUTPUT = 4000;
export const MAX_HISTORY = 12000;
export const IGNORED_PATH_NAMES = new Set([
  ".git", ".mini-coding-agent", "__pycache__", ".pytest_cache",
  ".ruff_cache", ".venv", "venv", "node_modules",
]);

export const WELCOME_ART = [
  "/\\     /\\\\",
  "{  `---'  }",
  "{  O   O  }",
  "~~>  V  <~~",
  "\\\\  \\|/  /",
  "`-----'__",
];

export const HELP_DETAILS = [
  "命令:",
  "/help    显示帮助信息",
  "/memory  显示 agent 的工作记忆",
  "/session 显示当前会话文件路径",
  "/reset   清空当前会话历史和记忆",
  "/exit    退出",
].join("\n");
