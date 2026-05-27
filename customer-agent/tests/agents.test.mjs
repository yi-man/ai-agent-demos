import { describe, it, expect } from 'bun:test';
import { createAgent, PriceAgent } from '../src/agent/agents.mjs';
import { loadProducts, formatDescription } from '../src/context/product.mjs';
import { join } from 'node:path';

const products = loadProducts(join(import.meta.dirname, '../data/products'));
const xiaomi15 = products.get('xiaomi15');
const productDesc = formatDescription(xiaomi15);

describe('ConsultAgent', () => {
  it('should answer product questions', async () => {
    const agent = createAgent('consult');
    const reply = await agent.generate({ productDesc, userMessage: '小米15拍照怎么样？' });
    expect(reply.length).toBeGreaterThan(10);
    expect(reply).toContain('徕卡');
  }, 30000);
});

describe('PriceAgent', () => {
  it('should negotiate price with bargain count', async () => {
    const agent = new PriceAgent();
    const reply = await agent.generateWithBargain({
      bargainCount: 1,
      productDesc,
      userMessage: '能便宜点吗？',
    });
    expect(reply.length).toBeGreaterThan(5);
  }, 30000);
});

describe('createAgent', () => {
  it('should return correct agent for each intent', () => {
    expect(createAgent('consult').constructor.name).toBe('ConsultAgent');
    expect(createAgent('price').constructor.name).toBe('PriceAgent');
    expect(createAgent('objection').constructor.name).toBe('ObjectionAgent');
    expect(createAgent('closing').constructor.name).toBe('ClosingAgent');
    expect(createAgent('aftersales').constructor.name).toBe('AftersalesAgent');
    expect(createAgent('chitchat').constructor.name).toBe('ChitchatAgent');
    // unknown intent falls back to ChitchatAgent
    expect(createAgent('unknown').constructor.name).toBe('ChitchatAgent');
  });
});
