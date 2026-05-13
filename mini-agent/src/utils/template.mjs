import nunjucks from "nunjucks";

const env = new nunjucks.Environment(null, { autoescape: false, throwOnUndefined: true });

export function render(template, context) {
  return env.renderString(template, context);
}
