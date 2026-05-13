import { resolve, relative } from "path";
import { existsSync, readFileSync } from "fs";
import { execFileSync } from "child_process";
import { DOC_NAMES } from "./constants.mjs";
import { clip } from "./util.mjs";

function git(args, cwd, fallback = "") {
  try {
    const out = execFileSync("git", args, { cwd, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
    return out.trim() || fallback;
  } catch {
    return fallback;
  }
}

export class WorkspaceContext {
  constructor({ cwd, repoRoot, branch, defaultBranch, status, recentCommits, projectDocs }) {
    this.cwd = cwd;
    this.repoRoot = repoRoot;
    this.branch = branch;
    this.defaultBranch = defaultBranch;
    this.status = status;
    this.recentCommits = recentCommits;
    this.projectDocs = projectDocs;
  }

  static build(cwd) {
    cwd = resolve(cwd);
    const repoRoot = resolve(git(["rev-parse", "--show-toplevel"], cwd, cwd));

    const docs = {};
    for (const base of [repoRoot, cwd]) {
      for (const name of DOC_NAMES) {
        const p = resolve(base, name);
        if (!existsSync(p)) continue;
        const key = relative(repoRoot, p);
        if (key in docs) continue;
        docs[key] = clip(readFileSync(p, "utf-8"), 1200);
      }
    }

    const branchRaw = git(["branch", "--show-current"], cwd, "-") || "-";
    const defaultBranchRaw = (
      git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], cwd, "origin/main") || "origin/main"
    ).replace(/^origin\//, "");
    const statusRaw = clip(git(["status", "--short"], cwd, "clean") || "clean", 1500);
    const logRaw = git(["log", "--oneline", "-5"], cwd);
    const recentCommits = logRaw ? logRaw.split("\n").filter(Boolean) : [];

    return new WorkspaceContext({
      cwd,
      repoRoot,
      branch: branchRaw,
      defaultBranch: defaultBranchRaw,
      status: statusRaw,
      recentCommits,
      projectDocs: docs,
    });
  }

  text() {
    const commits = this.recentCommits.length
      ? this.recentCommits.map((l) => `- ${l}`).join("\n")
      : "- none";
    const docs = Object.entries(this.projectDocs).length
      ? Object.entries(this.projectDocs).map(([p, s]) => `- ${p}\n${s}`).join("\n")
      : "- none";
    return [
      "Workspace:",
      `- cwd: ${this.cwd}`,
      `- repo_root: ${this.repoRoot}`,
      `- branch: ${this.branch}`,
      `- default_branch: ${this.defaultBranch}`,
      "- status:",
      this.status,
      "- recent_commits:",
      commits,
      "- project_docs:",
      docs,
    ].join("\n");
  }
}
