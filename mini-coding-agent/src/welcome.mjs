import { WELCOME_ART } from "./constants.mjs";
import { middle } from "./util.mjs";

export function buildWelcome(agent, model, baseUrl) {
  const width = Math.max(68, Math.min((process.stdout.columns || 80), 84));
  const inner = width - 4;
  const gap = 3;
  const leftWidth = Math.floor((inner - gap) / 2);
  const rightWidth = inner - gap - leftWidth;

  function row(text) {
    const body = middle(text, width - 4);
    return `| ${body.padEnd(width - 4)} |`;
  }

  function divider(char = "-") {
    return "+" + char.repeat(width - 2) + "+";
  }

  function center(text) {
    const body = middle(text, inner);
    return `| ${body.padStart(Math.floor((inner + body.length) / 2)).padEnd(inner)} |`;
  }

  function cell(label, value, size) {
    const body = middle(`${label.padEnd(9)} ${value}`, size);
    return body.padEnd(size);
  }

  function pair(leftLabel, leftValue, rightLabel, rightValue) {
    const left = cell(leftLabel, leftValue, leftWidth);
    const right = cell(rightLabel, rightValue, rightWidth);
    return `| ${left}${" ".repeat(gap)}${right} |`;
  }

  const line = divider("=");
  const rows = WELCOME_ART.map(center);
  rows.push(center("MINI CODING AGENT"));
  rows.push(divider("-"));
  rows.push(row(""));
  rows.push(row("工作区    " + middle(agent.workspace.cwd, inner - 9)));
  rows.push(pair("模型", model, "分支", agent.workspace.branch));
  rows.push(pair("审批", agent.approvalPolicy, "会话", agent.session.id));
  rows.push(row(""));
  return [line, ...rows, line].join("\n");
}
