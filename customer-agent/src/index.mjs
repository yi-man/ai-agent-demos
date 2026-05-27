import { join } from 'node:path';
import readline from 'node:readline/promises';
import chalk from 'chalk';
import config from './config.mjs';
import { loadProducts, query as queryProducts, formatDescription } from './context/product.mjs';
import { ChatStore } from './context/store.mjs';
import { IntentRouter } from './agent/router.mjs';
import { PriceAgent, createAgent } from './agent/agents.mjs';
import { filterReply } from './agent/guard.mjs';
import { HandoffManager } from './handoff.mjs';

const SESSION_ID = 'cli-default';
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

/** Rolling window of last 5 emotions for this session. */
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

function printHelp() {
  const lines = [
    '',
    chalk.bold('可用命令：'),
    '  /human       进入人工模式',
    '  /ai          退出人工模式，恢复 AI 接管',
    '  /status      查看当前会话状态',
    '  /history [n] 查看最近 n 条对话（默认 10）',
    '  /help        显示本帮助',
    '  /quit        退出系统',
    '',
  ];
  console.log(lines.join('\n'));
}

function printStatus() {
  const stage = store.getStage(SESSION_ID) || '未设置';
  const bargainCount = store.getBargainCount(SESSION_ID);
  const isManual = handoff.isManualMode(SESSION_ID);
  const emotion = recentEmotions.length > 0 ? recentEmotions[recentEmotions.length - 1] : '无';

  const lines = [
    '',
    chalk.bold('会话状态：'),
    `  模式：${isManual ? chalk.red('人工') : chalk.green('AI')}`,
    `  阶段：${stage}`,
    `  情绪：${emotion}`,
    `  议价轮次：${bargainCount}`,
    '',
  ];
  console.log(lines.join('\n'));
}

function printHistory(count) {
  const messages = store.getContext(SESSION_ID, count);
  if (messages.length === 0) {
    console.log(chalk.yellow('\n[系统] 暂无对话记录\n'));
    return;
  }

  console.log(chalk.bold(`\n最近 ${messages.length} 条消息：`));
  for (const msg of messages) {
    const role = msg.role === 'user' ? chalk.cyan('客户') : chalk.green('客服');
    const meta = [];
    if (msg.intent) meta.push(msg.intent);
    if (msg.emotion) meta.push(msg.emotion);
    const suffix = meta.length > 0 ? chalk.gray(` [${meta.join(' | ')}]`) : '';
    console.log(`  ${role}：${msg.content}${suffix}`);
  }
  console.log();
}

async function processMessage(rl, userMessage) {
  // Check if in manual mode
  if (handoff.isManualMode(SESSION_ID)) {
    store.addMessage(SESSION_ID, 'user', userMessage);
    console.log(chalk.yellow('[人工模式] 请输入客服回复：'));
    const operatorReply = await rl.question(chalk.cyan('[人工模式] > '));
    store.addMessage(SESSION_ID, 'assistant', operatorReply);
    console.log(chalk.green(`\n客服：${operatorReply}\n`));
    return;
  }

  // Store user message
  store.addMessage(SESSION_ID, 'user', userMessage);

  // Resolve product context
  const product = findProduct(userMessage);
  const productDesc = product ? formatDescription(product) : '未指定具体产品';

  // Get chat history
  const historyMessages = store.getContext(SESSION_ID, 50);
  const history = formatHistory(historyMessages);

  // Route intent
  let intentResult;
  try {
    intentResult = await router.route(userMessage, { productDesc, history });
  } catch (err) {
    console.log(chalk.yellow(`[系统] 意图识别失败，使用通用回复。(${err.message})`));
    intentResult = { intent: 'chitchat', emotion: 'neutral', stage: 'inquiry', sensitive: false, sensitive_reason: '' };
  }

  const { intent, emotion, stage, sensitive, sensitive_reason } = intentResult;

  // Track emotion
  pushEmotion(emotion);

  // Handle no_reply intent
  if (intent === 'no_reply') {
    console.log(chalk.yellow('[系统] 无需回复'));
    return;
  }

  // Update stage in store
  store.updateStage(SESSION_ID, stage);

  // Generate reply via appropriate agent
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
    console.log(chalk.red(`[系统] 生成回复失败：${err.message}`));
    return;
  }

  // Apply safety guard
  const { filtered, wasFiltered, reason: filterReason } = filterReply(draftReply);

  // Check handoff sensitivity
  const { needsApproval, reason: approvalReason } = handoff.checkSensitivity({
    sensitive,
    sensitive_reason,
    guardFiltered: wasFiltered,
    recentEmotions,
  });

  let finalReply = filtered;

  if (needsApproval) {
    console.log(chalk.red(handoff.formatApprovalPrompt(filtered, approvalReason)));

    while (true) {
      const action = (await rl.question(chalk.yellow('请输入操作 (y/e/r)：'))).trim().toLowerCase();

      if (action === 'y') {
        finalReply = filtered;
        break;
      } else if (action === 'e') {
        const edited = await rl.question(chalk.yellow('请输入编辑后的回复：'));
        finalReply = edited;
        break;
      } else if (action === 'r') {
        console.log(chalk.yellow('[系统] 回复已拒绝'));
        return;
      } else {
        console.log(chalk.yellow('无效操作，请输入 y（发送）、e（编辑后发送）或 r（拒绝）'));
      }
    }
  }

  // Store and display final reply
  store.addMessage(SESSION_ID, 'assistant', finalReply, { intent, emotion, stage });

  const metaTag = chalk.gray(`[意图:${intent} | 情绪:${emotion} | 阶段:${stage}]`);
  console.log(`\n🤖 ${metaTag}`);
  console.log(chalk.green(`客服：${finalReply}\n`));
}

async function main() {
  console.log(chalk.bold.cyan('\n=== 小米智能客服系统 ==='));
  console.log(chalk.gray('输入消息开始对话，输入 /help 查看命令'));
  console.log(chalk.gray(`Session: ${SESSION_ID}\n`));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      let input;
      try {
        input = (await rl.question(chalk.bold('> '))).trim();
      } catch (err) {
        // Handle stdin closed (e.g. piped input exhausted)
        if (err.message?.includes('readline was closed') || err.code === 'ERR_USE_AFTER_CLOSE') {
          break;
        }
        throw err;
      }

      if (!input) continue;

      // Handle commands
      if (input.startsWith('/')) {
        const [cmd, ...args] = input.split(/\s+/);

        switch (cmd) {
          case '/human':
            handoff.enterManualMode(SESSION_ID);
            console.log(chalk.yellow('[系统] 已进入人工模式'));
            store.addMessage(SESSION_ID, 'system', '进入人工模式');
            break;

          case '/ai':
            handoff.exitManualMode(SESSION_ID);
            console.log(chalk.green('[系统] 已恢复 AI 模式'));
            store.addMessage(SESSION_ID, 'system', '退出人工模式，恢复 AI 接管');
            break;

          case '/status':
            printStatus();
            break;

          case '/history': {
            const n = parseInt(args[0], 10);
            printHistory(Number.isFinite(n) && n > 0 ? n : 10);
            break;
          }

          case '/help':
            printHelp();
            break;

          case '/quit':
            console.log(chalk.gray('再见！'));
            return;

          default:
            console.log(chalk.yellow(`[系统] 未知命令：${cmd}，输入 /help 查看可用命令`));
        }
        continue;
      }

      // Process regular message
      await processMessage(rl, input);
    }
  } finally {
    store.close();
    rl.close();
  }
}

main().catch(err => {
  console.error(chalk.red(`致命错误：${err.message}`));
  process.exit(1);
});
