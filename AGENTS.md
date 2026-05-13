### Project: ai-agent-demos

多子目录的 AI 代理示例仓，以 **Bun + JavaScript（ESM）** 为主，收录 `mini-agent`（精简软件工程代理）与 `mini-coding-agent`（编码代理 CLI），各子项目独立依赖与配置。

---

### 规范

- 子项目在各自目录内开发与安装依赖（`bun install`），使用仓库既有 **ESM** 与 **Bun** 约定，不擅自改为 CommonJS 或其它包管理器，除非全仓一致迁移。
- 环境变量仅从 **`.env.example`** 复制为本地 **`.env`** 并自行填写；**禁止**将 `.env`、密钥或整包 **`node_modules/`** 提交到 Git（根目录 `.gitignore` 已排除）。
- 修改代码时贴合需求、保持与各子目录现有风格一致；避免无关重构与跨子项目耦合。

---

### 常用命令

- `cd mini-agent && bun install && bun test`：安装依赖并运行 **mini-agent** 全部测试（Bun 内置测试运行器）。
- `cd mini-agent && bun start`：启动 **mini-agent** CLI（等价 `bun src/cli.mjs`）；`bun run demo` 可运行 `examples/run-demo.mjs`。
- `cd mini-coding-agent && bun install && bun test`：安装依赖并运行 **mini-coding-agent** 测试。
- `cd mini-coding-agent && bun start`：启动编码代理 CLI（`bun run bin.mjs`）。

---

### 项目架构

```
ai-agent-demos/
├── README.md              # 人读说明与子项目索引
├── AGENTS.md              # 本文件：协作与规范（CLAUDE.md 指向此处）
├── CLAUDE.md              # → AGENTS.md 软链接
├── .gitignore             # 忽略子项目 node_modules、.env 等
├── mini-agent/            # 精简 SWE 风格代理
│   ├── package.json
│   ├── bun.lock
│   ├── bunfig.toml
│   ├── .env.example
│   ├── config/            # YAML 配置样例
│   ├── examples/
│   ├── src/
│   │   ├── cli.mjs
│   │   ├── index.mjs
│   │   ├── load-env.mjs
│   │   ├── agent/
│   │   ├── config/
│   │   ├── environment/   # local / docker
│   │   ├── inspector/
│   │   ├── model/
│   │   ├── run/
│   │   └── utils/
│   └── tests/
└── mini-coding-agent/     # 编码代理（包名 mini-coding-agent）
    ├── package.json
    ├── bin.mjs
    ├── .env.example
    ├── src/
    └── tests/
```

---

### 重要说明

- TDD驱动模式，完善的单测、集成测试
- 所有测试都需要使用真实环境，不要mock。例如，数据库使用真实数据库等
- 遇到问题优先使用 /systematic-debugging 彻底查明原因，再去解决。解决完之后，一定要验证、跑完所有测试才可以生成完成
- 端口号勿随意修改

**本仓库补充：** 涉及 **LLM API、Docker 或本地沙箱** 的测试与联调，须在具备真实凭据、配额与权限的环境中进行；若无对应环境，应在说明中写明限制，**不得伪造**通过结果。子项目若将来引入 HTTP 服务，监听端口以各子项目文档或代码为准，勿随意改动以免破坏脚本与协作约定。
