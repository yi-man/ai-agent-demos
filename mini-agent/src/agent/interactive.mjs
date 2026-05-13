import chalk from "chalk";
import { DefaultAgent } from "./default.mjs";
import { UserInterruption, LimitsExceeded, Submitted } from "./exceptions.mjs";

const MODE_COMMANDS = { "/u": "human", "/c": "confirm", "/y": "yolo" };

export class InteractiveAgent extends DefaultAgent {
  constructor(model, env, config) {
    super(model, env, config);
    this.mode = config.mode || "confirm";
    this.whitelistActions = config.whitelistActions || [];
    this.confirmExit = config.confirmExit !== false;
    this.costLastConfirmed = 0;
  }

  addMessages(...messages) {
    for (const msg of messages) {
      const role = msg.role || "unknown";
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      if (role === "assistant") {
        console.log(chalk.red(`\nmini-agent (step ${chalk.bold(this.nCalls)}, ${chalk.bold(`$${this.cost.toFixed(2)}`)}):\n`));
      } else {
        console.log(chalk.green(`\n${role.charAt(0).toUpperCase() + role.slice(1)}:\n`));
      }
      if (content) console.log(content);
    }
    return super.addMessages(...messages);
  }

  async query() {
    if (this.mode === "human") {
      const { command } = await this.promptCommand();
      if (command) {
        const msg = { role: "user", content: `User command: \n\`\`\`bash\n${command}\n\`\`\``, extra: { actions: [{ command }] } };
        this.addMessages(msg);
        return msg;
      }
    }
    try {
      return await super.query();
    } catch (e) {
      if (e instanceof LimitsExceeded) {
        console.log(chalk.yellow(`Limits exceeded. Current: ${this.nCalls} steps, $${this.cost.toFixed(2)}`));
        const newStepLimit = parseInt(await this.promptInput("New step limit: "), 10) || this.config.stepLimit;
        const newCostLimit = parseFloat(await this.promptInput("New cost limit: ")) || this.config.costLimit;
        this.config.stepLimit = newStepLimit;
        this.config.costLimit = newCostLimit;
        return super.query();
      }
      throw e;
    }
  }

  async step() {
    try {
      console.log("─".repeat(60));
      return await super.step();
    } catch (e) {
      if (e instanceof UserInterruption) throw e;
      throw e;
    }
  }

  async executeActions(message) {
    const actions = message.extra?.actions || [];
    const commands = actions.map(a => a.command);
    const outputs = [];
    try {
      await this.askConfirmationOrInterrupt(commands);
      for (const action of actions) {
        outputs.push(await this.env.execute(action));
      }
    } catch (e) {
      if (e instanceof Submitted) {
        if (this.confirmExit) {
          const userInput = await this.promptInput(
            chalk.yellow("Agent wants to finish. ") + chalk.green("Type new task or Enter to quit") + "\n> "
          );
          if (userInput.trim()) {
            throw new UserInterruption({ role: "user", content: `The user added a new task: ${userInput}`, extra: { interrupt_type: "UserNewTask" } });
          }
        }
      }
      throw e;
    } finally {
      this.addMessages(...this.model.formatObservationMessages(message, outputs, this.getTemplateVars()));
    }
    return outputs;
  }

  shouldAskConfirmation(action) {
    if (this.mode !== "confirm") return false;
    return !this.whitelistActions.some(r => new RegExp(r).test(action));
  }

  async askConfirmationOrInterrupt(commands) {
    if (!commands.some(c => this.shouldAskConfirmation(c))) return;
    const userInput = await this.promptInput(
      chalk.yellow(`Execute ${commands.length} action(s)? `) +
      chalk.green("Enter to confirm") + ", " +
      chalk.red("type comment to reject") + ", " +
      chalk.blue("/h for commands") + "\n> "
    );
    const input = userInput.trim();
    if (input === "" || input === "/y") return;
    if (input === "/u") {
      throw new UserInterruption({ role: "user", content: "Commands not executed. Switching to human mode", extra: { interrupt_type: "UserRejection" } });
    }
    if (input in MODE_COMMANDS) {
      this.mode = MODE_COMMANDS[input];
      console.log(chalk.green(`Switched to ${this.mode} mode.`));
      return;
    }
    throw new UserInterruption({ role: "user", content: `Commands not executed. Rejected: ${input}`, extra: { interrupt_type: "UserRejection" } });
  }

  async promptInput(prompt) {
    const { createInterface } = await import("node:readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(prompt, answer => { rl.close(); resolve(answer); }));
  }

  async promptCommand() {
    const input = await this.promptInput(chalk.yellow("> "));
    const cmd = input.trim();
    if (cmd === "/h") {
      console.log(
        `Current mode: ${chalk.green(this.mode)}\n` +
        `${chalk.green("/y")} yolo mode\n` +
        `${chalk.green("/c")} confirm mode\n` +
        `${chalk.green("/u")} human mode\n` +
        `${chalk.green("/m")} multiline input`
      );
      return this.promptCommand();
    }
    if (cmd in MODE_COMMANDS) {
      if (this.mode === MODE_COMMANDS[cmd]) {
        console.log(chalk.red(`Already in ${this.mode} mode.`));
        return this.promptCommand();
      }
      this.mode = MODE_COMMANDS[cmd];
      console.log(chalk.green(`Switched to ${this.mode} mode.`));
      return { command: null };
    }
    return { command: cmd };
  }
}
