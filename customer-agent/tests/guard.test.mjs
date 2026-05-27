import { describe, it, expect } from 'bun:test';
import { checkSafety, filterReply } from '../src/agent/guard.mjs';

describe('checkSafety', () => {
  it('returns safe: true for normal text', () => {
    const result = checkSafety('这款手机性价比很高，推荐购买');
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('detects "微信" as unsafe', () => {
    const result = checkSafety('加我微信聊吧');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('微信');
  });

  it('detects "QQ" as unsafe', () => {
    const result = checkSafety('加QQ详聊');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('QQ');
  });

  it('detects "线下交易" as unsafe', () => {
    const result = checkSafety('我们可以线下交易');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('线下交易');
  });

  it('detects phone number pattern (11 digits starting with 1)', () => {
    const result = checkSafety('我的联系方式是13812345678');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('手机号');
  });

  it('detects "转账" as unsafe', () => {
    const result = checkSafety('直接转账给我就行');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('转账');
  });

  it('detects "身份证" as unsafe', () => {
    const result = checkSafety('需要登记身份证信息');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('身份证');
  });
});

describe('filterReply', () => {
  it('returns original text when safe', () => {
    const text = '这款产品非常好，建议下单';
    const result = filterReply(text);
    expect(result.filtered).toBe(text);
    expect(result.wasFiltered).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('replaces unsafe text with safe message', () => {
    const text = '加我微信 wx123';
    const result = filterReply(text);
    expect(result.filtered).toBe('[安全提醒]请通过平台沟通');
    expect(result.wasFiltered).toBe(true);
    expect(result.reason).toBeDefined();
  });

  it('detects multiple banned phrases in one text', () => {
    const text = '加微信13812345678私下交易';
    const result = checkSafety(text);
    expect(result.safe).toBe(false);
    // reason should mention at least one of the detected phrases
    expect(result.reason).toBeDefined();
    expect(result.reason.length).toBeGreaterThan(0);
  });
});
