export class HandoffManager {
  #maxBargainRounds;
  #maxDiscountPercent;
  #manualModeTimeout;
  /** @type {Map<string, number>} sessionId -> enter timestamp (ms) */
  #manualSessions = new Map();

  constructor({ maxBargainRounds = 5, maxDiscountPercent = 15, manualModeTimeout = 1800 } = {}) {
    this.#maxBargainRounds = maxBargainRounds;
    this.#maxDiscountPercent = maxDiscountPercent;
    this.#manualModeTimeout = manualModeTimeout;
  }

  /**
   * Check if a reply needs human approval.
   * @param {object} ctx
   * @param {boolean} ctx.sensitive
   * @param {string} [ctx.sensitive_reason]
   * @param {boolean} ctx.guardFiltered
   * @param {string[]} ctx.recentEmotions
   * @returns {{ needsApproval: boolean, reason: string }}
   */
  checkSensitivity(ctx) {
    const { sensitive = false, sensitive_reason = '', guardFiltered = false, recentEmotions = [] } = ctx;

    // 1. Guard filtered — safety filter triggered
    if (guardFiltered) {
      return { needsApproval: true, reason: '安全过滤器触发：LLM输出被安全守卫拦截，需要人工审核' };
    }

    // 2. Explicit sensitive flag from classifier (covers price, policy, legal, angry refund, etc.)
    if (sensitive && sensitive_reason) {
      return { needsApproval: true, reason: `敏感内容检测：${sensitive_reason}` };
    }

    // 3. Angry streak — 2+ consecutive angry emotions
    if (recentEmotions.length >= 2) {
      let consecutive = 1;
      for (let i = recentEmotions.length - 1; i > 0; i--) {
        if (recentEmotions[i] === 'angry' && recentEmotions[i - 1] === 'angry') {
          consecutive++;
        } else {
          break;
        }
      }
      if (consecutive >= 2) {
        return { needsApproval: true, reason: `客户连续${consecutive}轮表达愤怒情绪，需要人工介入` };
      }
    }

    return { needsApproval: false, reason: '' };
  }

  /**
   * Format the approval prompt for CLI display.
   * @param {string} draftReply
   * @param {string} reason
   * @returns {string}
   */
  formatApprovalPrompt(draftReply, reason) {
    const separator = '─'.repeat(50);
    return [
      '',
      separator,
      '⚠ 需要人工审核',
      `原因：${reason}`,
      separator,
      '草稿回复：',
      draftReply,
      separator,
      '操作：[y] 发送  [e] 编辑后发送  [r] 拒绝并重新生成',
      separator,
      '',
    ].join('\n');
  }

  /**
   * Process operator's approval response.
   * @param {string} action - 'y' | 'e' | 'r' (case-insensitive)
   * @param {string} draftReply
   * @param {string} editedText
   * @returns {{ reply: string | null, action: string }}
   */
  processApproval(action, draftReply, editedText) {
    const normalized = action.toLowerCase().trim();

    if (normalized === 'y' || normalized === 'yes') {
      return { reply: draftReply, action: 'confirm' };
    }

    if (normalized === 'e' || normalized === 'edit') {
      return { reply: editedText, action: 'edit' };
    }

    // 'r' or anything else
    return { reply: null, action: 'reject' };
  }

  /**
   * Check if a session is in manual mode (and not timed out).
   * @param {string} sessionId
   * @returns {boolean}
   */
  isManualMode(sessionId) {
    if (!this.#manualSessions.has(sessionId)) return false;
    return this.checkManualTimeout(sessionId);
  }

  /**
   * Enter manual mode for a session.
   * @param {string} sessionId
   */
  enterManualMode(sessionId) {
    this.#manualSessions.set(sessionId, Date.now());
  }

  /**
   * Exit manual mode for a session.
   * @param {string} sessionId
   * @returns {boolean} true if the session was in manual mode
   */
  exitManualMode(sessionId) {
    return this.#manualSessions.delete(sessionId);
  }

  /**
   * Check if manual mode has timed out; auto-exit if so.
   * @param {string} sessionId
   * @returns {boolean} true if still active (not timed out)
   */
  checkManualTimeout(sessionId) {
    const enteredAt = this.#manualSessions.get(sessionId);
    if (enteredAt === undefined) return false;

    const elapsedMs = Date.now() - enteredAt;
    const timeoutMs = this.#manualModeTimeout * 1000;

    if (elapsedMs >= timeoutMs) {
      this.#manualSessions.delete(sessionId);
      return false;
    }
    return true;
  }
}
