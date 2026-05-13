import { MAX_TOOL_OUTPUT } from "./constants.mjs";

export function now() {
  return new Date().toISOString();
}

export function clip(text, limit = MAX_TOOL_OUTPUT) {
  text = String(text);
  if (text.length <= limit) return text;
  return text.slice(0, limit) + `\n...[truncated ${text.length - limit} chars]`;
}

export function middle(text, limit) {
  text = String(text).replace(/\n/g, " ");
  if (text.length <= limit) return text;
  if (limit <= 3) return text.slice(0, limit);
  const left = Math.floor((limit - 3) / 2);
  const right = limit - 3 - left;
  return text.slice(0, left) + "..." + text.slice(-right);
}
