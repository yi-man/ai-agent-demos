import { describe, it, expect } from 'bun:test';
import { join } from 'node:path';
import { loadProducts, query, getById, formatDescription } from '../src/context/product.mjs';

const DATA_DIR = join(import.meta.dir, '..', 'data', 'products');

describe('loadProducts', () => {
  it('loads all 3 JSON files and returns correct count', () => {
    const products = loadProducts(DATA_DIR);
    expect(products).toBeInstanceOf(Map);
    // 3 smartphones + 2 wearables + 2 home = 7
    expect(products.size).toBe(7);
  });
});

describe('query', () => {
  const products = loadProducts(DATA_DIR);

  it('finds products by name keyword', () => {
    const results = query(products, '小米15');
    const names = results.map(p => p.name);
    expect(names).toContain('小米15');
    expect(names).toContain('小米15 Pro');
  });

  it('finds products by feature keyword', () => {
    const results = query(products, '防水');
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      const searchable = [
        p.name,
        ...p.features,
        ...Object.values(p.specs),
        ...p.keywords,
      ].join(' ');
      expect(searchable).toContain('防水');
    }
  });

  it('returns empty array for no match', () => {
    const results = query(products, '不存在的产品xyz');
    expect(results).toEqual([]);
  });
});

describe('getById', () => {
  const products = loadProducts(DATA_DIR);

  it('returns correct product by id', () => {
    const product = getById(products, 'xiaomi15');
    expect(product).not.toBeNull();
    expect(product.name).toBe('小米15');
    expect(product.price).toBe(3999);
  });

  it('returns null for unknown id', () => {
    const product = getById(products, 'nonexistent');
    expect(product).toBeNull();
  });
});

describe('formatDescription', () => {
  it('produces readable output with all key info', () => {
    const products = loadProducts(DATA_DIR);
    const product = getById(products, 'xiaomi15');
    const output = formatDescription(product);

    expect(output).toContain('产品名称：小米15');
    expect(output).toContain('价格：¥3999');
    expect(output).toContain('屏幕');
    expect(output).toContain('处理器');
    expect(output).toContain('特色');
    expect(output).toContain('保修：1年质保');
    // features appear
    expect(output).toContain('徕卡');
  });
});
