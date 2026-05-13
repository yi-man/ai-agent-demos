# ai-agent-demos

本仓库收录多个独立的 **AI 代理 / 编码代理** 小项目，技术栈以 **Bun + JavaScript（ESM）** 为主。各子目录自带 `package.json`、依赖与配置，互不耦合。

| 目录 | npm 包名 | 说明 |
|------|-----------|------|
| [`mini-agent/`](mini-agent/) | `mini-agent` | 精简版软件工程代理（Node 侧重写），含 CLI、配置与测试。 |
| [`mini-coding-agent/`](mini-coding-agent/) | `mini-coding-agent` | 轻量编码代理 CLI，入口为根目录 `bin.mjs`。 |

---

## mini-agent

**路径：** `mini-agent/`  
**定位：** 最小可跑的「软件工程」风格代理，带 YAML 配置、模型调用与本地/容器环境等模块。

**首次运行：**

```bash
cd mini-agent
cp .env.example .env   # 填写 API Key 等
bun install
bun test
```

**常用脚本：**

| 命令 | 作用 |
|------|------|
| `bun start` | 启动 CLI（`src/cli.mjs`） |
| `bun run demo` | 跑示例 `examples/run-demo.mjs` |
| `bun test` | 单元测试 |

全局安装本包后，可通过 `bin` 字段中的 **`mini`** 调用 CLI（见该目录 `package.json`）。

---

## mini-coding-agent

**路径：** `mini-coding-agent/`（原 `nodejs` 目录已更名为与包名一致，便于识别。）  
**定位：** 编码场景下的代理入口，单文件 CLI `bin.mjs` 与 `src/` 源码。

**首次运行：**

```bash
cd mini-coding-agent
cp .env.example .env
bun install
bun test
```

**常用脚本：**

| 命令 | 作用 |
|------|------|
| `bun start` | `bun run bin.mjs` |
| `bun test` | 单元测试 |

安装为依赖后，可使用 **`mini-coding-agent`** 作为可执行命令（见 `package.json` 的 `bin`）。

---

## 环境与版本控制

- 两个子项目均使用 **Bun**；若本机未装 Bun，见 [Bun 安装文档](https://bun.sh/docs/installation)。
- 根目录 **`.gitignore`** 忽略各子项目下的 `node_modules/` 与 `.env`，请勿将密钥或整包依赖提交到 Git。
- 提交前确认只跟踪源码、`package.json`、`bun.lock`（若有）、`.env.example`、配置样例等。

---

## 仓库结构（概要）

```
ai-agent-demos/
├── README.md
├── .gitignore
├── mini-agent/           # 精简 SWE 风格代理
└── mini-coding-agent/    # 编码代理 CLI
```
