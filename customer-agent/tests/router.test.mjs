import { describe, it, expect } from 'bun:test';
import { IntentRouter } from '../src/agent/router.mjs';

const router = new IntentRouter();

describe('Tier 1 keyword matching', () => {
  it('should match consult keywords', () => {
    expect(router._matchKeywords('小米15的参数是什么')).toBe('consult');
    expect(router._matchKeywords('帮我推荐一款手机')).toBe('consult');
    expect(router._matchKeywords('这两款有什么区别')).toBe('consult');
  });

  it('should match price keywords', () => {
    expect(router._matchKeywords('这个多少钱')).toBe('price');
    expect(router._matchKeywords('能便宜点吗')).toBe('price');
    expect(router._matchKeywords('有没有折扣')).toBe('price');
  });

  it('should match objection keywords', () => {
    expect(router._matchKeywords('质量太差了')).toBe('objection');
    expect(router._matchKeywords('这个手机贵了')).toBe('objection');
    expect(router._matchKeywords('我要投诉')).toBe('objection');
  });

  it('should match closing keywords', () => {
    expect(router._matchKeywords('我要下单')).toBe('closing');
    expect(router._matchKeywords('怎么买这个手机')).toBe('closing');
    expect(router._matchKeywords('给我个链接')).toBe('closing');
  });

  it('should match aftersales keywords', () => {
    expect(router._matchKeywords('怎么保修')).toBe('aftersales');
    expect(router._matchKeywords('需要维修')).toBe('aftersales');
    expect(router._matchKeywords('能开发票吗')).toBe('aftersales');
  });

  it('should return null for no match', () => {
    expect(router._matchKeywords('今天天气不错')).toBeNull();
    expect(router._matchKeywords('你好')).toBeNull();
  });

  it('should match regex patterns for consult', () => {
    expect(router._matchKeywords('小米15和华为比怎么样')).toBe('consult');
    expect(router._matchKeywords('这两款手机有什么区别')).toBe('consult');
  });

  it('should match regex patterns for price', () => {
    expect(router._matchKeywords('3500元行不行')).toBe('price');
    expect(router._matchKeywords('能少200')).toBe('price');
  });

  it('should match regex patterns for objection', () => {
    expect(router._matchKeywords('不值这个价')).toBe('objection');
    expect(router._matchKeywords('太贵了')).toBe('objection');
  });

  it('should match regex patterns for closing', () => {
    expect(router._matchKeywords('怎么购买')).toBe('closing');
    expect(router._matchKeywords('我要买这个')).toBe('closing');
  });

  it('should match regex patterns for aftersales', () => {
    expect(router._matchKeywords('这个怎么修')).toBe('aftersales');
    expect(router._matchKeywords('能退吗')).toBe('aftersales');
  });
});

describe('_inferStage', () => {
  it('should map intents to stages correctly', () => {
    expect(router._inferStage('consult')).toBe('inquiry');
    expect(router._inferStage('price')).toBe('negotiation');
    expect(router._inferStage('objection')).toBe('objection');
    expect(router._inferStage('closing')).toBe('closing');
    expect(router._inferStage('aftersales')).toBe('aftersales');
  });

  it('should default to inquiry for unknown intent', () => {
    expect(router._inferStage('chitchat')).toBe('inquiry');
    expect(router._inferStage('unknown')).toBe('inquiry');
  });
});

describe('route() integration', () => {
  it('should use Tier 1 for keyword match and return neutral emotion', async () => {
    const result = await router.route('这个手机多少钱');
    expect(result.intent).toBe('price');
    expect(result.emotion).toBe('neutral');
    expect(result.stage).toBe('negotiation');
    expect(result.sensitive).toBe(false);
    expect(result.sensitive_reason).toBe('');
  });

  it('should use Tier 1 for consult keyword', async () => {
    const result = await router.route('这款手机的配置怎么样');
    expect(result.intent).toBe('consult');
    expect(result.emotion).toBe('neutral');
    expect(result.stage).toBe('inquiry');
  });

  it('should fall back to Tier 2 for unknown message', async () => {
    const result = await router.route('你们发货快不快');
    expect(result.intent).toBeDefined();
    expect(typeof result.intent).toBe('string');
    expect(result.emotion).toBeDefined();
    expect(result.stage).toBeDefined();
    expect(typeof result.sensitive).toBe('boolean');
  }, 30000);

  it('should fall back to Tier 2 LLM for ambiguous message', async () => {
    const result = await router.route('你好，我想了解一下这款手机');
    expect(result.intent).toBeDefined();
    expect(result.emotion).toBeDefined();
  }, 30000);
});
