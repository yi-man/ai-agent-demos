import { BaseAgent } from './base-agent.mjs';
import { join } from 'node:path';

const VALID_INTENTS = ['consult', 'price', 'objection', 'closing', 'aftersales', 'chitchat', 'no_reply'];
const VALID_EMOTIONS = ['neutral', 'positive', 'negative', 'angry', 'anxious', 'confused'];
const VALID_STAGES = ['inquiry', 'negotiation', 'objection', 'closing', 'aftersales'];

const SAFE_DEFAULTS = {
  intent: 'chitchat',
  emotion: 'neutral',
  stage: 'inquiry',
  sensitive: false,
  sensitive_reason: '',
};

export class ClassifyAgent extends BaseAgent {
  constructor() {
    super(join(import.meta.dirname, '../../data/prompts/classify.txt'), {
      temperature: 0.2,
      maxTokens: 1000,
    });
  }

  /**
   * Try to extract a JSON object from raw LLM text.
   * Handles plain JSON, fenced code blocks, and partially truncated JSON.
   */
  _extractJson(text) {
    // Strip markdown code fences if present
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();

    try {
      return JSON.parse(raw);
    } catch {
      // Try to recover from truncated JSON by closing open braces/quotes
      let attempt = raw;
      // Close any unterminated string
      const quotes = (attempt.match(/"/g) || []).length;
      if (quotes % 2 !== 0) attempt += '"';
      // Remove trailing comma before closing (e.g. {"a":1,} → invalid; fix it)
      attempt = attempt.replace(/,(\s*)$/, '$1');
      // Close open braces
      const opens = (attempt.match(/{/g) || []).length;
      const closes = (attempt.match(/}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) attempt += '}';
      return JSON.parse(attempt);
    }
  }

  /**
   * Classify user message. Returns parsed JSON:
   * { intent, emotion, stage, sensitive, sensitive_reason }
   */
  async classify({ productDesc, history, userMessage }) {
    const maxRetries = 2;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const text = await this.generate({ productDesc, history, userMessage });
      try {
        const parsed = this._extractJson(text);
        return {
          intent: VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'chitchat',
          emotion: VALID_EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'neutral',
          stage: VALID_STAGES.includes(parsed.stage) ? parsed.stage : 'inquiry',
          sensitive: Boolean(parsed.sensitive),
          sensitive_reason: parsed.sensitive_reason || '',
        };
      } catch {
        // JSON parse failed (likely truncated response), retry
        continue;
      }
    }
    return { ...SAFE_DEFAULTS };
  }
}
