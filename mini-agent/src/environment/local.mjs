import "../load-env.mjs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import { Submitted } from "../agent/exceptions.mjs";

const execAsync = promisify(exec);

export class LocalEnvironment {
  constructor(config = {}) {
    this.config = { cwd: "", env: {}, timeout: 30, ...config };
  }

  async execute(action, cwd) {
    const command = action.command || "";
    cwd = cwd || this.config.cwd || process.cwd();
    try {
      const { stdout } = await execAsync(command, {
        cwd,
        env: { ...process.env, ...this.config.env },
        timeout: (this.config.timeout || 30) * 1000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = { output: stdout, returncode: 0, exception_info: "" };
      this.checkFinished(output);
      return output;
    } catch (e) {
      // Re-throw non-exec errors (e.g., Submitted from checkFinished)
      if (e instanceof Submitted || !(e instanceof Error)) {
        throw e;
      }
      const isTimeout = e.killed === true;
      const output = {
        output: e.stdout || "",
        returncode: isTimeout ? -1 : (e.code ?? -1),
        exception_info: isTimeout ? "Command timed out" : "",
      };
      if (!isTimeout && e.code !== undefined) {
        output.exception_info = "";
      }
      this.checkFinished(output);
      return output;
    }
  }

  checkFinished(output) {
    const lines = output.output.trimStart().split("\n");
    if (lines[0]?.trim() === "COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT" && output.returncode === 0) {
      const submission = lines.slice(1).join("\n");
      throw new Submitted({ role: "exit", content: submission, extra: { exit_status: "Submitted", submission } });
    }
  }

  getTemplateVars(extra = {}) {
    const system = os.type();
    const release = os.release();
    const version = os.version ? os.version() : "";
    const machine = os.machine ? os.machine() : os.arch();
    return { ...this.config, system, release, version, machine, ...extra };
  }

  serialize() {
    return { info: { config: { environment: this.config, environment_type: "LocalEnvironment" } } };
  }
}
