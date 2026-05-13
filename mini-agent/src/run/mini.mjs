import chalk from "chalk";
import { loadConfig } from "../config/loader.mjs";
import { getModel, getEnvironment, getAgent } from "../config/factory.mjs";
import { createLogger } from "../utils/log.mjs";

export async function runMini(options) {
  const logger = createLogger("mini", options.debug ? "debug" : "info");

  console.log(chalk.green(`Building agent config from specs: ${chalk.bold(options.config.join(", "))}`));
  const config = loadConfig(options.config, {
    task: options.task,
    modelName: options.model,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    modelClass: options.modelClass,
    agentClass: options.agentClass,
    environmentClass: options.environmentClass,
    yolo: options.yolo,
    costLimit: options.costLimit,
    output: options.output,
    exitImmediately: options.exitImmediately,
  });

  let task = config.run?.task;
  if (!task) {
    const { createInterface } = await import("node:readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    task = await new Promise(resolve => rl.question(chalk.yellow("What do you want to do?\n> "), answer => { rl.close(); resolve(answer); }));
    console.log(chalk.green("Got that, thanks!"));
  }

  const model = getModel(config.model);
  const env = getEnvironment(config.environment);
  const agent = getAgent(model, env, config.agent);

  await agent.run(task);

  if (config.agent.output_path) {
    console.log(chalk.green(`Saved trajectory to '${config.agent.output_path}'`));
  }
  return agent;
}
