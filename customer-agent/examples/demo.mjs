/**
 * Demo script — runs through a sample customer conversation automatically.
 * Usage: bun examples/demo.mjs
 * Requires valid API_KEY, MODEL_BASE_URL, MODEL_NAME in .env
 */

import { join } from 'node:path';
import chalk from 'chalk';
import config from '../src/config.mjs';
import { loadProducts, formatDescription } from '../src/context/product.mjs';
import { ChatStore } from '../src/context/store.mjs';
import { IntentRouter } from '../src/agent/router.mjs';
import { PriceAgent, createAgent } from '../src/agent/agents.mjs';
import { filterReply } from '../src/agent/guard.mjs';
import { HandoffManager } from '../src/handoff.mjs';

// ---------------------------------------------------------------------------
// Initialization (mirrors index.mjs)
// ---------------------------------------------------------------------------
const SESSION_ID = 'demo-session';
const PRODUCTS_DIR = join(import.meta.dirname, '../data/products');
const DB_PATH = join(import.meta.dirname, '../data/chat.db');

const store = new ChatStore(DB_PATH);
const products = loadProducts(PRODUCTS_DIR);
const router = new IntentRouter();
const handoff = new HandoffManager({
  maxBargainRounds: config.maxBargainRounds,
  maxDiscountPercent: config.maxDiscountPercent,
  manualModeTimeout: config.manualModeTimeout,
});

const recentEmotions = [];
function pushEmotion(emotion) {
  recentEmotions.push(emotion);
  if (recentEmotions.length > 5) recentEmotions.shift();
}

function findProduct(text) {
  for (const product of products.values()) {
    if (text.includes(product.name) || product.keywords.some(k => text.includes(k))) {
      return product;
    }
  }
  return null;
}

function formatHistory(messages) {
  return messages
    .map(m => `${m.role === 'user' ? '客户' : '客服'}：${m.content}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Pre-defined demo conversation
// ---------------------------------------------------------------------------
const messages = [
  '你好，我想了解一下小米15',
  '小米15和华为Mate70比怎么样？拍照谁更好？',
  '小米15多少钱？能便宜点吗',
  '3500卖不卖？不卖我去买华为了',
  '你们手机质量太差了，我朋友买了一个月就坏了',
  '行吧，那我买一个小米15，怎么下单',
];

// ---------------------------------------------------------------------------
// Run demo
// ---------------------------------------------------------------------------
async function main() {
  console.log(chalk.bold.cyan('\n=== 小米智能客服系统 · Demo ==='));
  console.log(chalk.gray(`Session: ${SESSION_ID}`));
  console.log(chalk.gray(`Messages: ${messages.length}\n`));

  const SEPARATOR = '━'.repeat(40);

  for (const userMessage of messages) {
    // Display user message
    console.log(SEPARATOR);
    console.log(chalk.cyan(`[客户] ${userMessage}`));
    console.log(SEPARATOR);

    // Store user message
    store.addMessage(SESSION_ID, 'user', userMessage);

    // Resolve product context
    const product = findProduct(userMessage);
    const productDesc = product ? formatDescription(product) : '未指定具体产品';

    // Chat history for context
    const historyMessages = store.getContext(SESSION_ID, 50);
    const history = formatHistory(historyMessages);

    // Route intent
    let intentResult;
    try {
      intentResult = await router.route(userMessage, { productDesc, history });
    } catch (err) {
      console.log(chalk.yellow(`[系统] 意图识别失败，使用通用回复。(${err.message})`));
      intentResult = {
        intent: 'chitchat',
        emotion: 'neutral',
        stage: 'inquiry',
        sensitive: false,
        sensitive_reason: '',
      };
    }

    const { intent, emotion, stage, sensitive, sensitive_reason } = intentResult;
    pushEmotion(emotion);

    // Handle no_reply (skip reply generation)
    if (intent === 'no_reply') {
      console.log(chalk.yellow('[系统] 无需回复\n'));
      continue;
    }

    // Update stage
    store.updateStage(SESSION_ID, stage);

    // Generate reply
    let draftReply;
    try {
      if (intent === 'price') {
        const agent = new PriceAgent();
        const bargainCount = store.getBargainCount(SESSION_ID);
        draftReply = await agent.generateWithBargain({
          bargainCount,
          productDesc,
          history,
          emotion,
          stage,
          userMessage,
        });
        store.incrementBargainCount(SESSION_ID);
      } else {
        const agent = createAgent(intent);
        draftReply = await agent.generate({
          productDesc,
          history,
          emotion,
          stage,
          userMessage,
        });
      }
    } catch (err) {
      console.log(chalk.red(`[系统] 生成回复失败：${err.message}\n`));
      continue;
    }

    // Safety guard
    const { filtered } = filterReply(draftReply);

    // Handoff check (auto-approve in demo)
    const { needsApproval } = handoff.checkSensitivity({
      sensitive,
      sensitive_reason,
      guardFiltered: filtered !== draftReply,
      recentEmotions,
    });

    if (needsApproval) {
      console.log(chalk.yellow('[系统] 已自动批准（Demo 模式不阻塞）'));
    }

    // Store and display final reply
    const finalReply = filtered;
    store.addMessage(SESSION_ID, 'assistant', finalReply, { intent, emotion, stage });

    console.log(chalk.gray(`\u{1F916} [意图:${intent} | 情绪:${emotion} | 阶段:${stage}]`));
    console.log(chalk.green(`[客服] ${finalReply}\n`));

    // Delay for readability
    await new Promise(r => setTimeout(r, 500));
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log(chalk.bold('\n=== 对话摘要 ==='));
  const allMessages = store.getContext(SESSION_ID, 100);
  const userMsgs = allMessages.filter(m => m.role === 'user');
  console.log(`总消息数: ${userMsgs.length}`);

  const intentCounts = {};
  const emotionOrder = [];
  let finalStage = 'inquiry';
  for (const m of allMessages) {
    if (m.role !== 'assistant') continue;
    if (m.intent) intentCounts[m.intent] = (intentCounts[m.intent] || 0) + 1;
    if (m.emotion) emotionOrder.push(m.emotion);
    if (m.stage) finalStage = m.stage;
  }
  const intentDist = Object.entries(intentCounts).map(([k, v]) => `${k}:${v}`).join(', ');
  console.log(`意图分布: ${intentDist}`);
  console.log(`情绪趋势: ${emotionOrder.join(' → ')}`);
  console.log(`最终阶段: ${finalStage}`);

  store.close();
}

main().catch(err => {
  console.error(chalk.red(`致命错误：${err.message}`));
  process.exit(1);
});
