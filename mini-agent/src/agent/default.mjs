import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { render } from "../utils/template.mjs";
import { recursiveMerge } from "../utils/serialize.mjs";
import { createLogger } from "../utils/log.mjs";
import { InterruptAgentFlow, LimitsExceeded } from "./exceptions.mjs";

const logger = createLogger("agent");

export class DefaultAgent extends EventEmitter {
  constructor(model, env, config) {
    super();
    this.config = config;
    this.messages = [];
    this.model = model;
    this.env = env;
    this.cost = 0;
    this.nCalls = 0;
  }

  getTemplateVars(extra = {}) {
    return recursiveMerge(
      this.config,
      this.env.getTemplateVars(),
      this.model.getTemplateVars(),
      { n_model_calls: this.nCalls, model_cost: this.cost },
      extra
    );
  }

  addMessages(...messages) {
    logger.debug(messages);
    this.messages.push(...messages);
    return messages;
  }

  handleUncaughtException(e) {
    return this.addMessages(this.model.formatMessage({
      role: "exit",
      content: String(e),
      extra: {
        exit_status: e.constructor.name,
        submission: "",
        exception_str: String(e),
        traceback: e.stack || "",
      },
    }));
  }

  async run(task) {
    const vars = this.getTemplateVars({ task });
    this.messages = [];
    this.addMessages(
      this.model.formatMessage({ role: "system", content: render(this.config.systemTemplate, vars) }),
      this.model.formatMessage({ role: "user", content: render(this.config.instanceTemplate, vars) }),
    );
    while (true) {
      try {
        await this.step();
      } catch (e) {
        if (e instanceof InterruptAgentFlow) {
          this.addMessages(...e.messages);
        } else {
          this.handleUncaughtException(e);
          throw e;
        }
      } finally {
        await this.save(this.config.outputPath);
      }
      if (this.messages.at(-1)?.role === "exit") break;
    }
    return this.messages.at(-1)?.extra || {};
  }

  async step() {
    return this.executeActions(await this.query());
  }

  async query() {
    if ((this.config.stepLimit > 0 && this.nCalls >= this.config.stepLimit) ||
        (this.config.costLimit > 0 && this.cost >= this.config.costLimit)) {
      throw new LimitsExceeded({ role: "exit", content: "LimitsExceeded", extra: { exit_status: "LimitsExceeded", submission: "" } });
    }
    this.nCalls++;
    const message = await this.model.query(this.messages);
    this.cost += message.extra?.cost || 0;
    this.addMessages(message);
    this.emit("step", { nCalls: this.nCalls, cost: this.cost });
    return message;
  }

  async executeActions(message) {
    const actions = message.extra?.actions || [];
    const outputs = [];
    for (const action of actions) {
      outputs.push(await this.env.execute(action));
    }
    return this.addMessages(...this.model.formatObservationMessages(message, outputs, this.getTemplateVars()));
  }

  serialize(...extraDicts) {
    const lastMessage = this.messages.at(-1) || {};
    const lastExtra = lastMessage.extra || {};
    const agentData = {
      info: {
        model_stats: { instance_cost: this.cost, api_calls: this.nCalls },
        config: { agent: this.config, agent_type: "DefaultAgent" },
        exit_status: lastExtra.exit_status || "",
        submission: lastExtra.submission || "",
      },
      messages: this.messages,
      trajectory_format: "mini-agent-1.0",
    };
    return recursiveMerge(agentData, this.model.serialize(), this.env.serialize(), ...extraDicts);
  }

  async save(filePath, ...extraDicts) {
    const data = this.serialize(...extraDicts);
    if (filePath) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    return data;
  }
}
