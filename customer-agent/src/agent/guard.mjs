/**
 * Safety guard — scans LLM output for banned phrases and replaces them.
 */

/** Exact banned phrases (case-sensitive). */
const BANNED_PHRASES = [
  '微信', 'QQ', '支付宝', '银行卡', '银行账号', '转账',
  '线下交易', '线下见面', '当面交易', '私下交易',
  '身份证',
];

/** Regex-based banned patterns. */
const BANNED_PATTERNS = [
  { label: '手机号', regex: /1[3-9]\d{9}/ },
];

/**
 * Check if text contains banned phrases.
 * @param {string} text
 * @returns {{ safe: boolean, reason?: string }}
 */
export function checkSafety(text) {
  // Check exact phrases
  for (const phrase of BANNED_PHRASES) {
    if (text.includes(phrase)) {
      return { safe: false, reason: `包含敏感信息: ${phrase}` };
    }
  }

  // Check regex patterns
  for (const { label, regex } of BANNED_PATTERNS) {
    if (regex.test(text)) {
      return { safe: false, reason: `包含敏感信息: ${label}` };
    }
  }

  return { safe: true };
}

/**
 * Filter text: if unsafe, replace entire reply with safe message.
 * @param {string} text
 * @returns {{ filtered: string, wasFiltered: boolean, reason?: string }}
 */
export function filterReply(text) {
  const { safe, reason } = checkSafety(text);

  if (safe) {
    return { filtered: text, wasFiltered: false };
  }

  return { filtered: '[安全提醒]请通过平台沟通', wasFiltered: true, reason };
}
