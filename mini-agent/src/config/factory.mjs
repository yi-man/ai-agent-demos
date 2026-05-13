import { OpenAIModel } from "../model/openai.mjs";
import { LocalEnvironment } from "../environment/local.mjs";
import { DockerEnvironment } from "../environment/docker.mjs";
import { DefaultAgent } from "../agent/default.mjs";
import { InteractiveAgent } from "../agent/interactive.mjs";

const MODEL_MAP = { openai: OpenAIModel };
const ENV_MAP = { local: LocalEnvironment, docker: DockerEnvironment };
const AGENT_MAP = { default: DefaultAgent, interactive: InteractiveAgent };

function resolveClass(map, spec, defaultKey) {
  const key = spec || defaultKey;
  const Cls = map[key] || map[defaultKey];
  if (!Cls) throw new Error(`Unknown class: ${key} (available: ${Object.keys(map).join(", ")})`);
  return Cls;
}

export function getModel(config) {
  const Cls = resolveClass(MODEL_MAP, config.model_class, "openai");
  return new Cls(config);
}

export function getEnvironment(config) {
  const defaultType = config.image ? "docker" : "local";
  const Cls = resolveClass(ENV_MAP, config.environment_class, defaultType);
  return new Cls(config);
}

export function getAgent(model, env, config) {
  const defaultType = config.mode === "yolo" ? "default" : "interactive";
  const Cls = resolveClass(AGENT_MAP, config.agent_class, defaultType);
  return new Cls(model, env, config);
}
