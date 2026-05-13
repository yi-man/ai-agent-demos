import "../load-env.mjs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import crypto from "node:crypto";
import { Submitted } from "../agent/exceptions.mjs";
import { createLogger } from "../utils/log.mjs";

const execAsync = promisify(exec);
const logger = createLogger("docker_env");

export class DockerEnvironment {
  constructor(config = {}) {
    this.config = {
      image: config.image || "ubuntu:22.04",
      cwd: config.cwd || "/",
      env: config.env || {},
      forwardEnv: config.forwardEnv || [],
      timeout: config.timeout || 30,
      executable: config.executable || process.env.MSWEA_DOCKER_EXECUTABLE || "docker",
      runArgs: config.runArgs || ["--rm"],
      containerTimeout: config.containerTimeout || "2h",
      pullTimeout: config.pullTimeout || 120,
      interpreter: config.interpreter || ["bash", "-lc"],
      ...config,
    };
    this.containerId = null;
  }

  async start() {
    const containerName = `mini-agent-${crypto.randomBytes(4).toString("hex")}`;
    const cmd = [
      this.config.executable, "run", "-d",
      "--name", containerName,
      "-w", this.config.cwd,
      ...this.config.runArgs,
      this.config.image,
      "sleep", this.config.containerTimeout,
    ];
    logger.debug(`Starting container: ${cmd.join(" ")}`);
    const { stdout } = await execAsync(cmd.join(" "), {
      timeout: this.config.pullTimeout * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
    this.containerId = stdout.trim();
    logger.info(`Started container ${containerName} (${this.containerId})`);
  }

  async execute(action, cwd) {
    const command = action.command || "";
    cwd = cwd || this.config.cwd;
    if (!this.containerId) await this.start();
    const cmd = [this.config.executable, "exec", "-w", cwd];
    for (const key of this.config.forwardEnv) {
      const value = process.env[key];
      if (value !== undefined) cmd.push("-e", `${key}=${value}`);
    }
    for (const [key, value] of Object.entries(this.config.env)) {
      cmd.push("-e", `${key}=${value}`);
    }
    cmd.push(this.containerId, ...this.config.interpreter, command);
    try {
      const { stdout } = await execAsync(cmd.join(" "), {
        timeout: (this.config.timeout || 30) * 1000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = { output: stdout, returncode: 0, exception_info: "" };
      this.checkFinished(output);
      return output;
    } catch (e) {
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

  async cleanup() {
    if (this.containerId) {
      const cmd = `(timeout 60 ${this.config.executable} stop ${this.containerId} || ${this.config.executable} rm -f ${this.containerId}) >/dev/null 2>&1`;
      exec(cmd, () => {});
      this.containerId = null;
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
    return { info: { config: { environment: this.config, environment_type: "DockerEnvironment" } } };
  }
}
