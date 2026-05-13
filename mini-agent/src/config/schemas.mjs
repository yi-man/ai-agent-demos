import { z } from "zod";

export const AgentConfigSchema = z.object({
  system_template: z.string(),
  instance_template: z.string(),
  step_limit: z.number().default(0),
  cost_limit: z.number().default(3),
  output_path: z.string().nullable().default(null),
  mode: z.enum(["confirm", "yolo", "human"]).default("confirm"),
  agent_class: z.string().optional(),
  whitelist_actions: z.array(z.string()).default([]),
  confirm_exit: z.boolean().default(true),
});

function defaultModelName() {
  return (
    process.env.MSWEA_MODEL_NAME ||
    process.env.OPENAI_MODEL_NAME ||
    process.env.OPENAI_MODEL ||
    "gpt-4o"
  );
}

function defaultBaseUrl() {
  return process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
}

export const ModelConfigSchema = z.object({
  model_name: z.string().default(defaultModelName),
  base_url: z.string().default(defaultBaseUrl),
  api_key: z.string().default(() => process.env.OPENAI_API_KEY || ""),
  model_kwargs: z.record(z.any()).default({}),
  observation_template: z.string(),
  format_error_template: z.string(),
  prices: z.object({ input: z.number(), output: z.number() }).optional(),
  model_class: z.string().optional(),
  set_cache_control: z.enum(["default_end"]).optional(),
  multimodal_regex: z.string().default(""),
});

export const EnvironmentConfigSchema = z.object({
  cwd: z.string().default(""),
  env: z.record(z.string()).default({}),
  timeout: z.number().default(30),
  environment_class: z.string().optional(),
  image: z.string().optional(),
  container: z.string().optional(),
  forward_env: z.array(z.string()).default([]),
  run_args: z.array(z.string()).default(["--rm"]),
  container_timeout: z.string().default("2h"),
  interpreter: z.array(z.string()).default(["bash", "-lc"]),
});

export const ConfigSchema = z.object({
  agent: AgentConfigSchema,
  model: ModelConfigSchema,
  environment: EnvironmentConfigSchema,
  run: z.object({ task: z.string().optional() }).default({}),
});
