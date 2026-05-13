#!/usr/bin/env node
import "./load-env.mjs";
import { Command } from "commander";
import { runMini } from "./run/mini.mjs";
import path from "node:path";
import os from "node:os";

const program = new Command();

program
  .name("mini")
  .description("Run mini-agent in your local environment")
  .version("0.1.0")
  .option("-m, --model <name>", "Model to use")
  .option("--model-class <cls>", "Model class (openai)")
  .option("--agent-class <cls>", "Agent class (default, interactive)")
  .option("--environment-class <cls>", "Environment class (local, docker)")
  .option("-t, --task <task>", "Task/problem statement")
  .option("-y, --yolo", "Run without confirmation", false)
  .option("-l, --cost-limit <amount>", "Cost limit", parseFloat)
  .option("-c, --config <specs...>", "Config files or key=value specs", ["default"])
  .option("-o, --output <path>", "Output trajectory file", path.join(os.homedir(), ".mini-agent", "last_mini_run.traj.json"))
  .option("--base-url <url>", "OpenAI-compatible API base URL")
  .option("--api-key <key>", "API key")
  .option("--exit-immediately", "Exit immediately when agent wants to finish", false)
  .option("--debug", "Enable debug logging", false)
  .action(async (options) => {
    try {
      await runMini(options);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  });

program.parse();
