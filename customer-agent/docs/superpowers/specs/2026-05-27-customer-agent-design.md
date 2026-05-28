# Customer Agent Design Spec

**日期**: 2026-05-27
**状态**: 待审批
**技术栈**: Bun + JavaScript (ESM) + OpenAI SDK + SQLite

---

## 1. 目标与范围

构建一个通用智能客服系统，以小米产品为示例，支持完整的客服对话链路：

售前咨询 → 需求确认 → 产品推荐 → 异议处理 → 成交引导 → 售后服务

**不做的事**：
- 不对接真实 IM 平台（v1 使用 CLI 输入）
- 不做多租户/权限管理
- 不做 A/B 测试/数据分析仪表盘

---

## 2. 整体架构

```
用户消息 (CLI)
    │
    ▼
┌──────────────┐
│  IntentRouter │  Tier 1: 关键词/正则 → 命中即返回
│  router.mjs   │  Tier 2: LLM ClassifyAgent → {intent, emotion, stage}
└──────┬───────┘
       │
       ├─ intent → 路由到对应 Agent
       ├─ emotion → 注入 Agent prompt
       └─ stage → 更新 session 状态 + 注入 prompt
              │
              ▼
       ┌──────────────┐
       │ 专职 Agent     │  ConsultAgent / PriceAgent / ObjectionAgent
       │ agents.mjs    │  ClosingAgent / AftersalesAgent / ChitchatAgent
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  Guard (安全)  │  敏感词过滤
       │  guard.mjs    │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  Handoff 检测  │  AI 检测敏感场景 → 暂停 + 草稿展示
       │  handoff.mjs  │  操作者: [y]确认 / [e]编辑 / [r]拒绝
       └──────┬───────┘
              │
              ▼
         输出回复 (CLI)
```

---

## 3. 模块详细设计

### 3.1 意图路由 (router.mjs)

#### Tier 1: 关键词/正则规则

| Intent | 关键词 | 正则 |
|--------|--------|------|
| `consult` | 参数, 规格, 型号, 配置, 对比, 区别, 推荐, 哪款 | `和.+比`, `有什么.*区别` |
| `price` | 多少钱, 价格, 便宜, 优惠, 折扣, 降价, 砍价 | `\d+元`, `能少\d+` |
| `objection` | 贵了, 不好, 问题, 投诉, 差评, 退货, 质量, 坏了 | `不.*值`, `太.*贵` |
| `closing` | 下单, 买了, 付款, 怎么买, 在哪里买, 链接 | `怎么.*买`, `我要.*买` |
| `aftersales` | 保修, 维修, 退换, 售后, 发票, 配件 | `怎么.*修`, `能.*退` |

#### Tier 2: LLM 分类

当 Tier 1 无命中时，调用 ClassifyAgent，返回 JSON：

```json
{
  "intent": "consult | price | objection | closing | aftersales | chitchat | no_reply",
  "emotion": "neutral | positive | negative | angry | anxious | confused",
  "stage": "inquiry | negotiation | objection | closing | aftersales"
}
```

- `intent`: 路由到对应 Agent
- `emotion`: 注入 Agent prompt 影响回复策略
- `stage`: 更新 session 阶段追踪

**no_reply** 意图返回特殊标记 `-`，不发送回复（用于 prompt 注入、无关问题等）。

### 3.2 专职 Agent (agents.mjs)

| Agent | 触发 intent | Temperature | 核心职责 |
|-------|------------|-------------|----------|
| ConsultAgent | `consult` | 0.4 | 产品参数解答、场景化推荐、产品对比 |
| PriceAgent | `price` | 动态 0.3→0.9 | 价格谈判、折扣策略、价值强调 |
| ObjectionAgent | `objection` | 0.5 | 异议处理、投诉安抚、问题解决 |
| ClosingAgent | `closing` | 0.6 | 成交引导、下单指引、促销信息 |
| AftersalesAgent | `aftersales` | 0.3 | 保修政策、退换流程、使用指导 |
| ChitchatAgent | `chitchat` | 0.7 | 寒暄闲聊、引导回到正题 |

#### 共同 System Prompt 构造

```
【产品信息】{product_desc}
【对话历史】{formatted_history}
【用户情绪】{emotion}
【当前阶段】{stage}
{agent-specific system prompt}
```

#### PriceAgent 特殊逻辑

- 动态温度：`min(0.3 + bargain_count * 0.15, 0.9)`
- Prompt 注入议价轮次：`▲当前议价轮次：{count}`
- 每次 price intent 命中时，计数器 +1（存储在 SQLite）

#### 安全过滤 (guard.mjs)

扫描 LLM 输出中的敏感词：微信、QQ、支付宝、银行卡、线下交易等。
命中时替换为：`[安全提醒]请通过平台沟通`

### 3.3 数据管理

#### 产品信息 (product.mjs)

JSON 文件存储在 `data/products/` 目录下：

```json
{
  "category": "smartphones",
  "products": [
    {
      "id": "xiaomi15",
      "name": "小米15",
      "price": 3999,
      "specs": {
        "screen": "6.36英寸 2K AMOLED",
        "cpu": "骁龙8至尊版",
        "ram": "12GB/16GB",
        "storage": "256GB/512GB/1TB",
        "camera": "5000万像素徕卡三摄",
        "battery": "5400mAh"
      },
      "features": ["徕卡光学", "IP68防水", "无线充电"],
      "warranty": "1年质保",
      "keywords": ["旗舰", "拍照", "性能"]
    }
  ]
}
```

启动时全量加载到内存。提供：
- `loadProducts(dir)` — 加载所有 JSON 文件
- `query(keyword)` — 按关键词搜索产品
- `getById(id)` — 按 ID 获取产品详情
- `formatDescription(product)` — 格式化产品描述用于 prompt 注入

产品分类文件：
- `smartphones.json` — 小米手机系列
- `wearables.json` — 手环、手表
- `home.json` — 电视、音箱、智能家居

#### 聊天记录 (store.mjs)

SQLite 数据库，路径：`data/chat.db`

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,        -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  intent TEXT,
  emotion TEXT,
  stage TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bargain_counts (
  session_id TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE session_stages (
  session_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

提供：
- `addMessage(sessionId, role, content, {intent, emotion, stage})`
- `getContext(sessionId, limit=50)` — 返回格式化历史
- `incrementBargainCount(sessionId)` — 议价计数
- `getBargainCount(sessionId)`
- `updateStage(sessionId, stage)` / `getStage(sessionId)`

#### 阶段追踪 (stage.mjs)

- 不是有限状态机，是 LLM 推断的上下文标签
- 每次分类后用返回的 stage 更新 `session_stages` 表
- 注入 prompt 时附加阶段描述：

| Stage | 描述 |
|-------|------|
| `inquiry` | 用户正在了解产品，关注功能和适用场景 |
| `negotiation` | 用户在讨论价格，关注优惠和性价比 |
| `objection` | 用户有顾虑或不满，需要解答疑虑 |
| `closing` | 用户有购买意向，需要促成下单 |
| `aftersales` | 用户已购买或关心售后，关注保修和服务 |

### 3.4 人工介入 (handoff.mjs)

#### 核心理念

人工介入的触发方是 **AI**，不是用户。AI 在处理过程中遇到敏感或无法自主决定的场景时，主动暂停自动回复，请求人工审核确认后才继续。

#### AI 主动触发条件

| 场景 | 示例 | 处理方式 |
|------|------|----------|
| **价格超出授权范围** | 用户要求超过 15% 的折扣，或涉及特殊定价 | AI 暂停，提示操作者确认是否同意该价格 |
| **敏感承诺** | 用户问保修能否延长、能否开发票、能否特殊退换 | AI 暂停，提示操作者确认政策边界 |
| **竞品对比涉及敏感内容** | 用户要求对比涉及法律纠纷的竞品 | AI 暂停，请求人工审核回复内容 |
| **高风险投诉** | 用户情绪极度愤怒 + 涉及退款/赔偿要求 | AI 暂停，请求人工介入处理 |
| **安全过滤命中** | Agent 输出被 guard 过滤（可能遇到注入攻击） | AI 暂停，请求人工确认是否为恶意输入 |

#### 处理流程

敏感检测分两层：
1. **规则检测**（handoff.mjs 内置）：检查议价轮次 > 3 且折扣幅度 > 15%、guard 安全过滤命中、情绪连续 `angry`
2. **LLM 检测**（ClassifyAgent 返回额外字段 `sensitive: true, sensitive_reason: "..."`）：识别超出常规的政策承诺请求、竞品敏感对比等

任一层命中即触发人工确认流程：

```
用户消息 → AI 分类（含敏感标记）→ Agent 生成回复草稿
                                      │
                                ┌─────┴─────┐
                                │ 敏感检测    │  规则层 OR LLM 层
                                │ 命中？      │
                                └─────┬─────┘
                    Yes   │   No
              ┌───────────┤───────────┐
              ▼                       ▼
  ⚠️ 显示草稿 + 风险提示      直接发送回复
  请求操作者 [y]确认 / [e]编辑 / [r]拒绝
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
  确认发送  编辑后发送  拒绝（AI 重新生成）
```

CLI 交互示例：
```
⚠️ [敏感提醒] 用户要求超过授权折扣，AI 回复草稿：
   "可以给您最大15%的优惠，原价3999，优惠后3399元"
   [y]确认发送  [e]编辑  [r]拒绝重新生成 >
```

#### 操作者命令

| 命令 | 功能 |
|------|------|
| `/human` | 手动切换到纯人工模式（操作者直接回复，不经过 AI） |
| `/ai` | 切回 AI 自动模式 |
| `/sensitivity` | 调整敏感检测的严格程度（low/medium/high） |
| `/status` | 查看当前模式、阶段、情绪趋势、议价轮次 |
| `/history [n]` | 查看最近 n 条聊天记录 |
| `/quit` | 退出系统 |

#### 纯人工模式

通过 `/human` 进入，用于操作者需要完全接管对话的场景：
- 消息继续记录到 SQLite
- 不生成 AI 回复
- 操作者直接在终端输入回复内容
- 超时 30 分钟未操作自动切回 AI（可配置）

### 3.5 LLM 配置

```env
API_KEY=tp-sjzvn430ealv96p18us5tvj26g7b9b7mndu6g2ouax6sjvz8
MODEL_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MODEL_NAME=mimo-v2.5-pro
```

使用 OpenAI SDK 兼容模式调用：

```js
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: process.env.MODEL_BASE_URL,
});
```

---

## 4. CLI 交互示例

### 正常对话流程

```
=== 小米智能客服系统 ===
输入消息开始对话，输入 /help 查看命令

> 用户: 小米15和华为Mate70比怎么样？
🤖 [意图:consult | 情绪:neutral | 阶段:inquiry]
客服: 小米15搭载骁龙8至尊版，配合徕卡光学三摄，性能和拍照都是顶级水准。相比Mate70，小米15在性价比上更有优势，目前3999起售。您更看重哪方面呢？

> 用户: 太贵了，能便宜点吗
🤖 [意图:price | 情绪:negative | 阶段:negotiation]
客服: 理解您的顾虑。小米15的定价已经非常有诚意了，而且目前有以旧换新活动，最高可抵800元。您有旧设备可以置换吗？
```

### AI 主动请求人工确认

```
> 用户: 我要20%折扣，不然就去华为买
🤖 [意图:price | 情绪:angry | 阶段:negotiation]
⚠️ [敏感提醒] 用户要求20%折扣（超出授权15%上限），AI 回复草稿：
   "非常理解您的想法。这样吧，我给您申请最大15%的优惠，
    原价3999，优惠后3399元，同时送您一个原装保护壳。"
   [y]确认发送  [e]编辑  [r]拒绝重新生成 > y
✅ 已发送

> 用户: 保修能延长到两年吗？
🤖 [意图:aftersales | 情绪:neutral | 阶段:inquiry]
⚠️ [敏感提醒] 用户要求延长保修（超出标准1年政策），AI 回复草稿：
   "小米15标准保修期为1年。不过您可以购买小米Care+服务，
    享受延长保修和意外保障。需要我为您介绍吗？"
   [y]确认发送  [e]编辑  [r]拒绝重新生成 > y
✅ 已发送
```

### 手动切换人工模式

```
> /human
✅ 已切换到人工模式，AI 不再自动回复
[人工模式] > 操作者: 您好，我是客服主管，有什么可以帮您？

> /ai
✅ 已切回 AI 模式

> /status
📊 会话状态: AI模式 | 阶段: negotiation | 情绪: negative | 议价轮次: 2

> /quit
👋 再见
```

---

## 5. 依赖

```json
{
  "dependencies": {
    "openai": "^4.96.0",
    "chalk": "^5.4.0",
    "dotenv": "^16.4.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bun": "^1.2.0"
  }
}
```

> SQLite 使用 Bun 内置的 `bun:sqlite` 模块，无需额外依赖。

---

## 6. 测试策略

- **单元测试**：router.mjs 的关键词匹配逻辑、guard.mjs 的安全过滤、product.mjs 的查询接口
- **集成测试**：完整的消息→分类→Agent→回复 流程（需要真实 LLM API 调用）
- **手动测试**：CLI 交互流程、人工介入切换、各种对话场景

---

## 7. 文件结构

```
customer-agent/
├── package.json
├── bunfig.toml
├── .env.example
├── src/
│   ├── index.mjs              # CLI 主循环入口
│   ├── config.mjs             # 配置加载
│   ├── agent/
│   │   ├── router.mjs         # 意图路由（Tier 1 关键词 + Tier 2 LLM）
│   │   ├── classifier.mjs     # 分类 Agent（intent + emotion + stage）
│   │   ├── agents.mjs         # 各专职 Agent
│   │   ├── base-agent.mjs     # Agent 基类（prompt 构造、LLM 调用）
│   │   └── guard.mjs          # 安全过滤
│   ├── context/
│   │   ├── store.mjs          # SQLite 聊天记录存储
│   │   ├── product.mjs        # 产品信息加载与查询
│   │   └── stage.mjs          # 对话阶段追踪
│   └── handoff.mjs            # 人工介入检测与切换
├── data/
│   ├── products/
│   │   ├── smartphones.json
│   │   ├── wearables.json
│   │   └── home.json
│   └── prompts/
│       ├── classify.txt
│       ├── consult.txt
│       ├── price.txt
│       ├── objection.txt
│       ├── closing.txt
│       ├── aftersales.txt
│       └── chitchat.txt
├── tests/
│   ├── router.test.mjs
│   ├── guard.test.mjs
│   ├── product.test.mjs
│   ├── store.test.mjs
│   └── integration.test.mjs
└── examples/
    └── demo.mjs
```
