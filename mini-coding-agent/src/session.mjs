import { join } from "path";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";

export class SessionStore {
  constructor(root) {
    this.root = root;
    mkdirSync(root, { recursive: true });
  }

  path(sessionId) {
    return join(this.root, `${sessionId}.json`);
  }

  save(session) {
    const p = this.path(session.id);
    writeFileSync(p, JSON.stringify(session, null, 2), "utf-8");
    return p;
  }

  load(sessionId) {
    return JSON.parse(readFileSync(this.path(sessionId), "utf-8"));
  }

  latest() {
    const files = readdirSync(this.root)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ name: f, mtime: statSync(join(this.root, f)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime);
    return files.length ? files[files.length - 1].name.replace(/\.json$/, "") : null;
  }
}
