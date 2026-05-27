import OpenAI from 'openai';
import { readFileSync } from 'node:fs';
import config from '../config.mjs';

export class BaseAgent {
  constructor(promptFile, { temperature = 0.4, maxTokens = 500, topP = 0.8 } = {}) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.modelBaseUrl,
    });
    this.modelName = config.modelName;
    this.systemPrompt = readFileSync(promptFile, 'utf-8');
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.topP = topP;
  }

  /**
   * Build the messages array for LLM call.
   * Override in subclasses to customize.
   */
  _buildMessages({ productDesc, history, emotion, stage, userMessage }) {
    const systemParts = [];
    if (productDesc) systemParts.push(`【产品信息】\n${productDesc}`);
    if (history) systemParts.push(`【对话历史】\n${history}`);
    if (emotion) systemParts.push(`【用户情绪】${emotion}`);
    if (stage) systemParts.push(`【当前阶段】${stage}`);
    systemParts.push(this.systemPrompt);

    return [
      { role: 'system', content: systemParts.join('\n\n') },
      { role: 'user', content: userMessage },
    ];
  }

  /**
   * Call the LLM and return the response text.
   */
  async generate({ productDesc, history, emotion, stage, userMessage, temperature, maxTokens }) {
    const messages = this._buildMessages({ productDesc, history, emotion, stage, userMessage });
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages,
      temperature: temperature ?? this.temperature,
      max_tokens: maxTokens ?? this.maxTokens,
      top_p: this.topP,
    });
    return response.choices[0].message.content.trim();
  }
}
