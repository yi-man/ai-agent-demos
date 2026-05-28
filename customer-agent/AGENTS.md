### Project: customer-agent

多智能体电商客服与销售助手示例，基于 **Bun + JavaScript（ESM）**：意图分类、场景化子代理（咨询/议价/异议/成交等）、SQLite 会话存储、商品知识库与人工接管（handoff）。

---

### 规范

- 在本目录内使用 `bun install` 安装依赖，遵循 **ESM** 与 **Bun** 约定。
- 环境变量仅从 **`.env.example`** 复制为本地 **`.env`** 并自行填写；**禁止**提交 `.env`、API 密钥、`node_modules/` 及运行时数据库（`data/*.db`）。
- 修改代码时保持与现有模块划分一致（`agent/`、`context/`、`handoff`），避免无关重构。

---

### 常用命令

- `cd customer-agent && bun install && bun test`：安装依赖并运行全部测试（含需真实 LLM 的集成测试）。
- `cd customer-agent && bun start`：启动交互式 CLI（`bun src/index.mjs`）。
- `cd customer-agent && bun run examples/demo.mjs`：运行示例对话脚本（若需非交互演示）。

---

### 项目架构

```
customer-agent/
├── package.json
├── bun.lock
├── .env.example
├── .gitignore
├── AGENTS.md              # 本文件：协作与规范（CLAUDE.md 指向此处）
├── CLAUDE.md              # → AGENTS.md 软链接
├── data/
│   ├── products/          # 商品 JSON（按品类）
│   ├── prompts/           # 各子代理与分类 prompt
│   └── chat.db            # 运行时 SQLite（git 忽略）
├── examples/
│   └── demo.mjs
├── src/
│   ├── index.mjs          # CLI 入口
│   ├── config.mjs
│   ├── handoff.mjs        # 议价轮次 / 人工模式
│   ├── agent/
│   │   ├── router.mjs
│   │   ├── classifier.mjs
│   │   ├── agents.mjs
│   │   ├── base-agent.mjs
│   │   └── guard.mjs
│   └── context/
│       ├── store.mjs      # 会话持久化
│       └── product.mjs    # 商品检索
├── tests/
└── docs/                  # 设计与实现计划（可选阅读）
```

---

### 重要说明

- TDD驱动模式，完善的单测、集成测试
- 所有测试都需要使用真实环境，不要mock。例如，数据库使用真实数据库等
- 遇到问题优先使用 /systematic-debugging 彻底查明原因，再去解决。解决完之后，一定要验证、跑完所有测试才可以生成完成
- 端口号勿随意修改

**本仓库补充：** 涉及 **LLM API** 的测试与联调须在具备真实凭据与配额的环境中进行；若无对应环境，应在说明中写明限制，**不得伪造**通过结果。集成测试可能写入 `data/test-integration.db`，该文件已列入 `.gitignore`。
