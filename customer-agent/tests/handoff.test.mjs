import { describe, it, expect } from 'bun:test';
import { HandoffManager } from '../src/handoff.mjs';

const manager = new HandoffManager({
  maxBargainRounds: 5,
  maxDiscountPercent: 15,
  manualModeTimeout: 1800,
});

describe('checkSensitivity', () => {
  it('should not flag normal conversation', () => {
    const result = manager.checkSensitivity({
      intent: 'consult', emotion: 'neutral', sensitive: false, guardFiltered: false, recentEmotions: ['neutral'],
    });
    expect(result.needsApproval).toBe(false);
  });

  it('should flag when sensitive=true from classifier', () => {
    const result = manager.checkSensitivity({
      sensitive: true, sensitive_reason: '用户要求50%折扣', guardFiltered: false, recentEmotions: ['neutral'],
    });
    expect(result.needsApproval).toBe(true);
    expect(result.reason).toContain('敏感');
  });

  it('should flag when guard filtered', () => {
    const result = manager.checkSensitivity({
      sensitive: false, guardFiltered: true, recentEmotions: ['neutral'],
    });
    expect(result.needsApproval).toBe(true);
    expect(result.reason).toContain('安全');
  });

  it('should flag when 2+ consecutive angry emotions', () => {
    const result = manager.checkSensitivity({
      sensitive: false, guardFiltered: false, recentEmotions: ['angry', 'angry'],
    });
    expect(result.needsApproval).toBe(true);
    expect(result.reason).toContain('愤怒');
  });

  it('should not flag single angry emotion', () => {
    const result = manager.checkSensitivity({
      sensitive: false, guardFiltered: false, recentEmotions: ['neutral', 'angry'],
    });
    expect(result.needsApproval).toBe(false);
  });

  it('should flag 3+ consecutive angry emotions', () => {
    const result = manager.checkSensitivity({
      sensitive: false, guardFiltered: false, recentEmotions: ['neutral', 'angry', 'angry', 'angry'],
    });
    expect(result.needsApproval).toBe(true);
    expect(result.reason).toContain('愤怒');
  });

  it('should not flag angry emotions that are not consecutive', () => {
    const result = manager.checkSensitivity({
      sensitive: false, guardFiltered: false, recentEmotions: ['angry', 'neutral', 'angry'],
    });
    expect(result.needsApproval).toBe(false);
  });

  it('should flag when both sensitive and guard filtered', () => {
    const result = manager.checkSensitivity({
      sensitive: true, sensitive_reason: '退款投诉', guardFiltered: true, recentEmotions: ['neutral'],
    });
    expect(result.needsApproval).toBe(true);
    // Guard filtered takes priority in reason
    expect(result.reason).toContain('安全');
  });
});

describe('formatApprovalPrompt', () => {
  it('should format a readable approval prompt', () => {
    const prompt = manager.formatApprovalPrompt('这是回复草稿', '敏感内容检测');
    expect(prompt).toContain('回复草稿');
    expect(prompt).toContain('敏感内容检测');
    expect(prompt).toContain('y');
    expect(prompt).toContain('e');
    expect(prompt).toContain('r');
  });
});

describe('processApproval', () => {
  it('should return draft on confirm (y)', () => {
    const result = manager.processApproval('y', '回复内容', '');
    expect(result.reply).toBe('回复内容');
    expect(result.action).toBe('confirm');
  });

  it('should return edited text on edit (e)', () => {
    const result = manager.processApproval('e', '原内容', '修改后的内容');
    expect(result.reply).toBe('修改后的内容');
    expect(result.action).toBe('edit');
  });

  it('should return null on reject (r)', () => {
    const result = manager.processApproval('r', '原内容', '');
    expect(result.reply).toBeNull();
    expect(result.action).toBe('reject');
  });

  it('should handle case-insensitive action input', () => {
    const result = manager.processApproval('Y', '内容', '');
    expect(result.reply).toBe('内容');
    expect(result.action).toBe('confirm');
  });
});

describe('manual mode', () => {
  it('should track manual mode per session', () => {
    expect(manager.isManualMode('session1')).toBe(false);
    manager.enterManualMode('session1');
    expect(manager.isManualMode('session1')).toBe(true);
    manager.exitManualMode('session1');
    expect(manager.isManualMode('session1')).toBe(false);
  });

  it('should isolate sessions from each other', () => {
    manager.enterManualMode('sessionA');
    expect(manager.isManualMode('sessionA')).toBe(true);
    expect(manager.isManualMode('sessionB')).toBe(false);
    manager.exitManualMode('sessionA');
  });

  it('should timeout manual mode', () => {
    const m = new HandoffManager({ manualModeTimeout: 0 }); // instant timeout
    m.enterManualMode('session1');
    expect(m.isManualMode('session1')).toBe(false); // already timed out
  });

  it('should return false when exiting non-existent session', () => {
    const result = manager.exitManualMode('nonexistent');
    expect(result).toBe(false);
  });

  it('should return true when exiting active session', () => {
    manager.enterManualMode('session2');
    const result = manager.exitManualMode('session2');
    expect(result).toBe(true);
  });
});
