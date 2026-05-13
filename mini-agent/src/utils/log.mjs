import pino from "pino";

export function createLogger(name, level = "info") {
  return pino({ name, level });
}

export const logger = createLogger("mini-agent");
