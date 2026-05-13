import fs from "node:fs";
import chalk from "chalk";

export async function inspectTrajectory(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`File not found: ${filePath}`));
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const info = data.info || {};
  const messages = data.messages || [];

  console.log(chalk.bold("\n=== Trajectory Inspector ===\n"));
  console.log(`Exit status: ${chalk.yellow(info.exit_status || "unknown")}`);
  console.log(`Cost: $${info.model_stats?.instance_cost?.toFixed(4) || "N/A"}`);
  console.log(`API calls: ${info.model_stats?.api_calls || "N/A"}`);
  console.log(`Messages: ${messages.length}\n`);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const role = msg.role || "unknown";
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

    console.log(chalk.cyan(`--- Message ${i + 1} [${role}] ---`));
    if (role === "assistant" && msg.extra?.actions) {
      for (const action of msg.extra.actions) {
        console.log(chalk.magenta(`  $ ${action.command}`));
      }
    }
    if (role === "tool" || role === "user") {
      const preview = content.length > 500 ? content.slice(0, 500) + "..." : content;
      console.log(preview);
    }
    console.log();
  }

  if (info.submission) {
    console.log(chalk.green(`\nSubmission:\n${info.submission}`));
  }
}
