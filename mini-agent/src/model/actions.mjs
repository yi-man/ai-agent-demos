import { FormatError } from "../agent/exceptions.mjs";
import { render } from "../utils/template.mjs";

export const BASH_TOOL = {
  type: "function",
  function: {
    name: "bash",
    description: "Execute a bash command",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The bash command to execute" },
      },
      required: ["command"],
    },
  },
};

export function parseToolcallActions(toolCalls, formatErrorTemplate) {
  if (!toolCalls || toolCalls.length === 0) {
    throw new FormatError({
      role: "user",
      content: render(formatErrorTemplate, { error: "No tool calls found in the response. Every response MUST include at least one tool call.", actions: [] }),
      extra: { interrupt_type: "FormatError" },
    });
  }
  const actions = [];
  for (const toolCall of toolCalls) {
    let errorMsg = "";
    let args = {};
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      errorMsg = `Error parsing tool call arguments: ${e}.`;
    }
    if (toolCall.function.name !== "bash") {
      errorMsg += ` Unknown tool '${toolCall.function.name}'.`;
    }
    if (typeof args !== "object" || args === null || !("command" in args)) {
      errorMsg += " Missing 'command' argument in bash tool call.";
    }
    if (errorMsg) {
      throw new FormatError({
        role: "user",
        content: render(formatErrorTemplate, { actions: [], error: errorMsg.trim() }),
        extra: { interrupt_type: "FormatError" },
      });
    }
    actions.push({ command: args.command, tool_call_id: toolCall.id });
  }
  return actions;
}

export function formatToolcallObservationMessages({ actions, outputs, observationTemplate, templateVars = {} }) {
  const notExecuted = { output: "", returncode: -1, exception_info: "action was not executed" };
  const paddedOutputs = [...outputs, ...Array(Math.max(0, actions.length - outputs.length)).fill(notExecuted)];
  const results = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const output = paddedOutputs[i];
    const content = render(observationTemplate, { output, ...templateVars });
    const msg = {
      content,
      extra: {
        raw_output: output.output || "",
        returncode: output.returncode,
        timestamp: Date.now() / 1000,
        exception_info: output.exception_info,
        ...(output.extra || {}),
      },
    };
    if ("tool_call_id" in action) {
      msg.tool_call_id = action.tool_call_id;
      msg.role = "tool";
    } else {
      msg.role = "user";
    }
    results.push(msg);
  }
  return results;
}
