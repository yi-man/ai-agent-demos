import { ClassifyAgent } from './classifier.mjs';

const RULES = {
  consult: {
    keywords: ['参数', '规格', '型号', '配置', '对比', '区别', '推荐', '哪款'],
    regex: [/和.+比/, /有什么.*区别/],
  },
  price: {
    keywords: ['多少钱', '价格', '便宜', '优惠', '折扣', '降价', '砍价'],
    regex: [/\d+元/, /能少\d+/],
  },
  objection: {
    keywords: ['贵了', '不好', '问题', '投诉', '差评', '退货', '质量', '坏了'],
    regex: [/不.*值/, /太.*贵/],
  },
  closing: {
    keywords: ['下单', '买了', '付款', '怎么买', '在哪里买', '链接'],
    regex: [/怎么.*买/, /我要.*买/],
  },
  aftersales: {
    keywords: ['保修', '维修', '退换', '售后', '发票', '配件'],
    regex: [/怎么.*修/, /能.*退/],
  },
};

const INTENT_STAGE_MAP = {
  consult: 'inquiry',
  price: 'negotiation',
  objection: 'objection',
  closing: 'closing',
  aftersales: 'aftersales',
};

export class IntentRouter {
  constructor() {
    this.classifier = new ClassifyAgent();
  }

  /**
   * Route user message to intent.
   * Tier 1: keyword/regex → instant result (emotion=neutral, stage=inferred, sensitive=false)
   * Tier 2: LLM classify → full {intent, emotion, stage, sensitive, sensitive_reason}
   *
   * @param {string} userMessage
   * @param {object} opts - { productDesc?, history? }
   * @returns {Promise<{intent: string, emotion: string, stage: string, sensitive: boolean, sensitive_reason: string}>}
   */
  async route(userMessage, opts = {}) {
    const tier1 = this._matchKeywords(userMessage);
    if (tier1) {
      return {
        intent: tier1,
        emotion: 'neutral',
        stage: this._inferStage(tier1),
        sensitive: false,
        sensitive_reason: '',
      };
    }
    return this.classifier.classify({
      productDesc: opts.productDesc,
      history: opts.history,
      userMessage,
    });
  }

  /**
   * Try keyword substring match, then regex match.
   * Returns the first matching intent string, or null.
   */
  _matchKeywords(text) {
    for (const [intent, rules] of Object.entries(RULES)) {
      if (rules.keywords.some((kw) => text.includes(kw))) {
        return intent;
      }
    }
    for (const [intent, rules] of Object.entries(RULES)) {
      if (rules.regex.some((re) => re.test(text))) {
        return intent;
      }
    }
    return null;
  }

  /**
   * Map intent to likely conversation stage.
   */
  _inferStage(intent) {
    return INTENT_STAGE_MAP[intent] || 'inquiry';
  }
}
