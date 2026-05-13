import { describe, it, expect } from "bun:test";
import { DockerEnvironment } from "../../src/environment/docker.mjs";

describe("DockerEnvironment", () => {
  it("constructor stores config", () => {
    const env = new DockerEnvironment({ image: "ubuntu:22.04", cwd: "/root" });
    expect(env.config.image).toBe("ubuntu:22.04");
    expect(env.config.cwd).toBe("/root");
  });

  it("getTemplateVars returns config plus platform info", () => {
    const env = new DockerEnvironment({ image: "ubuntu:22.04" });
    const vars = env.getTemplateVars();
    expect(vars.image).toBe("ubuntu:22.04");
    expect(vars.system).toBeDefined();
  });

  it("serialize returns correct structure", () => {
    const env = new DockerEnvironment({ image: "ubuntu:22.04" });
    const data = env.serialize();
    expect(data.info.config.environment_type).toBe("DockerEnvironment");
  });
});
