import { join } from 'node:path';
import { BaseAgent } from './base-agent.mjs';
import config from '../config.mjs';

const PROMPTS_DIR = join(import.meta.dirname, '../../data/prompts');

// ---------------------------------------------------------------------------
// 1. ConsultAgent
// ---------------------------------------------------------------------------
export class ConsultAgent extends BaseAgent {
  constructor() {
    super(join(PROMPTS_DIR, 'consult.txt'), { temperature: 0.4, maxTokens: 500 });
  }
}

// ---------------------------------------------------------------------------
// 2. PriceAgent — dynamic temperature & placeholder replacement
// ---------------------------------------------------------------------------
export class PriceAgent extends BaseAgent {
  constructor() {
    super(join(PROMPTS_DIR, 'price.txt'), { temperature: 0.3, maxTokens: 500 });
  }

  /** Inject bargain round and discount limit into the system prompt. */
  _buildMessages({ productDesc, history, emotion, stage, userMessage, bargainCount }) {
    const messages = super._buildMessages({ productDesc, history, emotion, stage, userMessage });

    // Replace placeholders in the system message
    const systemMsg = messages[0];
    systemMsg.content = systemMsg.content
      .replace(/BARGAIN_ROUND/g, String(bargainCount ?? 0))
      .replace(/MAX_DISCOUNT_PERCENT/g, String(config.maxDiscountPercent));

    return messages;
  }

  /**
   * Generate a price-negotiation response with dynamic temperature.
   * Temperature rises with each bargain round to allow more creative negotiation.
   */
  async generateWithBargain({ bargainCount, ...rest }) {
    const dynamicTemp = Math.min(0.3 + bargainCount * 0.15, 0.9);
    return this.generate({
      ...rest,
      bargainCount,
      temperature: dynamicTemp,
    });
  }
}

// ---------------------------------------------------------------------------
// 3. ObjectionAgent
// ---------------------------------------------------------------------------
export class ObjectionAgent extends BaseAgent {
  constructor() {
    super(join(PROMPTS_DIR, 'objection.txt'), { temperature: 0.5, maxTokens: 500 });
  }
}

// ---------------------------------------------------------------------------
// 4. ClosingAgent
// ---------------------------------------------------------------------------
export class ClosingAgent extends BaseAgent {
  constructor() {
    super(join(PROMPTS_DIR, 'closing.txt'), { temperature: 0.6, maxTokens: 500 });
  }
}

// ---------------------------------------------------------------------------
// 5. AftersalesAgent
// ---------------------------------------------------------------------------
export class AftersalesAgent extends BaseAgent {
  constructor() {
    super(join(PROMPTS_DIR, 'aftersales.txt'), { temperature: 0.3, maxTokens: 500 });
  }
}

// ---------------------------------------------------------------------------
// 6. ChitchatAgent
// ---------------------------------------------------------------------------
export class ChitchatAgent extends BaseAgent {
  constructor() {
    super(join(PROMPTS_DIR, 'chitchat.txt'), { temperature: 0.7, maxTokens: 300 });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
const agentMap = {
  consult: ConsultAgent,
  price: PriceAgent,
  objection: ObjectionAgent,
  closing: ClosingAgent,
  aftersales: AftersalesAgent,
  chitchat: ChitchatAgent,
};

/**
 * Return the appropriate agent instance for the given intent.
 * Falls back to ChitchatAgent for unknown intents.
 */
export function createAgent(intent) {
  const AgentClass = agentMap[intent] ?? ChitchatAgent;
  return new AgentClass();
}
