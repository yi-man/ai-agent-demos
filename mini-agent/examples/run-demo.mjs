#!/usr/bin/env bun
/**
 * One-shot demo: isolated temp dir + minimal file-creation task.
 * Run from anywhere:  cd mini-agent && bun run demo
 * Requires: bun, .env with OPENAI_API_KEY (and OPENAI_BASE_URL if not OpenAI).
 * Optional: MINI_MODEL to override; otherwise uses MSWEA_MODEL_NAME / OPENAI_MODEL_NAME from .env (see schemas).
 */
import path from "node:path";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const demoDir = mkdtempSync(path.join(tmpdir(), "mini-agent-demo-"));
const cli = path.join(root, "src", "cli.mjs");

const task =
  "In this directory only: create a file DEMO_RESULT.txt containing exactly one line: ok. " +
  "Use a shell command. When finished, submit with ONLY this command (no other text in that step): echo COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT";

const cmd = ["bun", cli, "-y", "--exit-immediately"];
if (process.env.MINI_MODEL) cmd.push("-m", process.env.MINI_MODEL);
cmd.push("-l", "1", "-c", "default", `environment.cwd=${demoDir}`, "-t", task);

const proc = Bun.spawn({
  cmd,
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

const code = await proc.exited;
console.log("\n--- demo workspace ---\n", demoDir);
const outFile = path.join(demoDir, "DEMO_RESULT.txt");
if (existsSync(outFile)) {
  console.log("DEMO_RESULT.txt:\n", readFileSync(outFile, "utf8"));
} else if (code === 0) {
  console.log("(DEMO_RESULT.txt not found; inspect trajectory in ~/.mini-agent/ if needed.)");
}
process.exit(code);
