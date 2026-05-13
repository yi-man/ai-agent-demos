import OpenAI from "openai";
import { BASH_TOOL, parseToolcallActions, formatToolcallObservationMessages } from "./actions.mjs";
import { globalModelStats } from "./stats.mjs";
import { retryFn } from "./retry.mjs";
import { createLogger } from "../utils/log.mjs";

const logger = createLogger("openai_model");

const ABORT_EXCEPTIONS = [
  OpenAI.AuthenticationError,
  OpenAI.PermissionDeniedError,
  OpenAI.NotFoundError,
];

export class OpenAIModel {
  constructor(config) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.config = config;
  }

  async query(messages) {
    const prepared = this.prepareMessages(messages);
    const response = await retryFn(
      () => this.client.chat.completions.create({
        model: this.config.modelName,
        messages: prepared,
        tools: [BASH_TOOL],
        ...this.config.model_kwargs,
      }),
      { abortExceptions: ABORT_EXCEPTIONS, logger }
    );
    const cost = this.calculateCost(response);
    globalModelStats.add(cost);
    const choice = response.choices[0];
    const message = choice.message;
    const extra = {
      actions: parseToolcallActions(message.tool_calls || [], this.config.formatErrorTemplate),
      cost,
      timestamp: Date.now() / 1000,
    };
    return { role: message.role, content: message.content, tool_calls: message.tool_calls, extra };
  }

  prepareMessages(messages) {
    return messages.map(({ extra, ...rest }) => rest);
  }

  calculateCost(response) {
    const usage = response.usage;
    if (!usage) return 0;
    const prices = this.config.prices || {};
    const inputCost = (usage.prompt_tokens || 0) * (prices.input || 0) / 1_000_000;
    const outputCost = (usage.completion_tokens || 0) * (prices.output || 0) / 1_000_000;
    return inputCost + outputCost;
  }

  formatMessage({ role, content, ...extra }) {
    return { role, content, extra };
  }

  formatObservationMessages(message, outputs, templateVars) {
    const actions = message.extra?.actions || [];
    return formatToolcallObservationMessages({
      actions,
      outputs,
      observationTemplate: this.config.observationTemplate,
      templateVars,
    });
  }

  getTemplateVars() {
    return { model_name: this.config.modelName, ...this.config };
  }

  serialize() {
    return { info: { config: { model: this.config, model_type: "OpenAIModel" } } };
  }
}
