import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SPEC_LABELS = {
  screen: '屏幕',
  cpu: '处理器',
  ram: '运行内存',
  storage: '存储',
  camera: '摄像头',
  battery: '电池',
  resolution: '分辨率',
  refresh_rate: '刷新率',
  hdr: 'HDR',
  audio: '音频',
  soc: '芯片',
  driver: '扬声器',
  power: '功率',
  connectivity: '连接',
  microphone: '麦克风',
  size: '尺寸',
  waterproof: '防水',
  weight: '重量',
  os: '系统',
};

/**
 * Load all .json product files from a directory into a Map<id, product>.
 * @param {string} dir - Path to the products data directory.
 * @returns {Map<string, object>}
 */
export function loadProducts(dir) {
  const products = new Map();
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf-8');
    const data = JSON.parse(raw);
    for (const product of data.products) {
      products.set(product.id, product);
    }
  }

  return products;
}

/**
 * Search products by keyword (matches name, features, keywords, specs values).
 * @param {Map<string, object>} products
 * @param {string} keyword
 * @returns {object[]}
 */
export function query(products, keyword) {
  const results = [];
  for (const product of products.values()) {
    const searchable = [
      product.name,
      ...product.features,
      ...Object.values(product.specs),
      ...product.keywords,
    ].join(' ');
    if (searchable.includes(keyword)) {
      results.push(product);
    }
  }
  return results;
}

/**
 * Get product by id, or null if not found.
 * @param {Map<string, object>} products
 * @param {string} id
 * @returns {object|null}
 */
export function getById(products, id) {
  return products.get(id) ?? null;
}

/**
 * Format product into a human-readable string for prompt injection.
 * @param {object} product
 * @returns {string}
 */
export function formatDescription(product) {
  const lines = [];
  lines.push(`产品名称：${product.name}`);
  lines.push(`价格：¥${product.price}`);
  lines.push('规格：');
  for (const [key, value] of Object.entries(product.specs)) {
    const label = SPEC_LABELS[key] ?? key;
    lines.push(`  - ${label}：${value}`);
  }
  lines.push(`特色：${product.features.join('、')}`);
  lines.push(`保修：${product.warranty}`);
  return lines.join('\n');
}
