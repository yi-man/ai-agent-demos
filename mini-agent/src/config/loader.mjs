import "../load-env.mjs";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { fileURLToPath } from "node:url";
import { recursiveMerge, UNSET } from "../utils/serialize.mjs";
import { ConfigSchema } from "./schemas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const builtinConfigDir = path.resolve(__dirname, "../../config");

export function keyValueSpecToNestedDict(spec) {
  const eqIndex = spec.indexOf("=");
  if (eqIndex === -1) return {};
  const key = spec.slice(0, eqIndex);
  const rest = spec.slice(eqIndex + 1);
  let parsedValue = rest;
  try { parsedValue = JSON.parse(rest); } catch {}
  const keys = key.split(".");
  const result = {};
  let current = result;
  for (const k of keys.slice(0, -1)) {
    current[k] = {};
    current = current[k];
  }
  current[keys.at(-1)] = parsedValue;
  return result;
}

export function interpolateEnvVars(str) {
  return str.replace(/\$\{([^}]+)\}/g, (_, varName) => process.env[varName] || `\${${varName}}`);
}

function interpolateDeep(obj) {
  if (typeof obj === "string") return interpolateEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(interpolateDeep);
  if (obj && typeof obj === "object") {
    const result = {};
    for (const [k, v] of Object.entries(obj)) result[k] = interpolateDeep(v);
    return result;
  }
  return obj;
}

function getConfigPath(spec) {
  const withYaml = spec.endsWith(".yaml") ? spec : `${spec}.yaml`;
  const candidates = [
    path.resolve(withYaml),
    path.resolve(builtinConfigDir, withYaml),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Config file not found: ${spec} (tried: ${candidates.join(", ")})`);
}

function getConfigFromSpec(spec) {
  if (typeof spec === "string" && spec.includes("=")) {
    return keyValueSpecToNestedDict(spec);
  }
  const configPath = getConfigPath(spec);
  return yaml.load(fs.readFileSync(configPath, "utf-8"));
}

function toCamelCase(obj) {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj && typeof obj === "object" && !(obj instanceof RegExp)) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      result[camelKey] = toCamelCase(v);
    }
    return result;
  }
  return obj;
}

export function loadConfig(configSpecs = ["mini"], cliOverrides = {}) {
  const configs = configSpecs.map(getConfigFromSpec);
  configs.push({
    run: { task: cliOverrides.task || UNSET },
    agent: {
      agent_class: cliOverrides.agentClass || UNSET,
      mode: cliOverrides.yolo ? "yolo" : UNSET,
      cost_limit: cliOverrides.costLimit || UNSET,
      confirm_exit: cliOverrides.exitImmediately ? false : UNSET,
      output_path: cliOverrides.output || UNSET,
    },
    model: {
      model_class: cliOverrides.modelClass || UNSET,
      model_name: cliOverrides.modelName || UNSET,
      base_url: cliOverrides.baseUrl || UNSET,
      api_key: cliOverrides.apiKey || UNSET,
    },
    environment: {
      environment_class: cliOverrides.environmentClass || UNSET,
    },
  });
  const merged = recursiveMerge(...configs);
  const interpolated = interpolateDeep(merged);
  const parsed = ConfigSchema.parse(interpolated);
  return toCamelCase(parsed);
}
