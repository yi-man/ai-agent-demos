import { describe, it, expect } from "bun:test";
import { BASH_TOOL, parseToolcallActions, formatToolcallObservationMessages } from "../../src/model/actions.mjs";
import { FormatError } from "../../src/agent/exceptions.mjs";

describe("BASH_TOOL", () => {
  it("has correct structure", () => {
    expect(BASH_TOOL.type).toBe("function");
    expect(BASH_TOOL.function.name).toBe("bash");
    expect(BASH_TOOL.function.parameters.required).toEqual(["command"]);
  });
});

describe("parseToolcallActions", () => {
  const formatErrorTemplate = "Error: {{error}}";

  it("parses a valid bash tool call", () => {
    const toolCalls = [{ id: "call_1", function: { name: "bash", arguments: '{"command": "ls -la"}' } }];
    const actions = parseToolcallActions(toolCalls, formatErrorTemplate);
    expect(actions).toEqual([{ command: "ls -la", tool_call_id: "call_1" }]);
  });

  it("throws FormatError when no tool calls", () => {
    expect(() => parseToolcallActions([], formatErrorTemplate)).toThrow(FormatError);
  });

  it("throws FormatError for unknown tool", () => {
    const toolCalls = [{ id: "call_1", function: { name: "unknown", arguments: '{}' } }];
    expect(() => parseToolcallActions(toolCalls, formatErrorTemplate)).toThrow(FormatError);
  });

  it("throws FormatError for missing command", () => {
    const toolCalls = [{ id: "call_1", function: { name: "bash", arguments: '{}' } }];
    expect(() => parseToolcallActions(toolCalls, formatErrorTemplate)).toThrow(FormatError);
  });
});

describe("formatToolcallObservationMessages", () => {
  it("formats tool result messages with tool_call_id", () => {
    const actions = [{ command: "ls", tool_call_id: "call_1" }];
    const outputs = [{ output: "file1.txt\nfile2.txt", returncode: 0, exception_info: "" }];
    const messages = formatToolcallObservationMessages({
      actions,
      outputs,
      observationTemplate: "<returncode>{{output.returncode}}</returncode>\n<output>{{output.output}}</output>",
      templateVars: {},
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("tool");
    expect(messages[0].tool_call_id).toBe("call_1");
    expect(messages[0].content).toContain("<returncode>0</returncode>");
  });

  it("pads missing outputs with not_executed", () => {
    const actions = [{ command: "ls", tool_call_id: "call_1" }, { command: "pwd", tool_call_id: "call_2" }];
    const outputs = [{ output: "file.txt", returncode: 0, exception_info: "" }];
    const messages = formatToolcallObservationMessages({
      actions,
      outputs,
      observationTemplate: "{{output.returncode}}",
      templateVars: {},
    });
    expect(messages).toHaveLength(2);
    expect(messages[1].extra.exception_info).toBe("action was not executed");
  });
});
