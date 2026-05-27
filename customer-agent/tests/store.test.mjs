import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ChatStore } from '../src/context/store.mjs';

/** Create a ChatStore backed by a temp directory for full isolation. */
function createStore() {
  const dir = mkdtempSync(join(tmpdir(), 'chat-store-test-'));
  const dbPath = join(dir, 'test.db');
  return { store: new ChatStore(dbPath), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

let store;
let cleanup;

beforeEach(() => {
  ({ store, cleanup } = createStore());
});

afterEach(() => {
  store.close();
  cleanup();
});

// --- Test Case 1: addMessage stores message and getContext retrieves it ---
describe('addMessage + getContext', () => {
  it('stores a message and retrieves it', () => {
    store.addMessage('session-1', 'user', '你好', { intent: 'greeting', emotion: 'neutral', stage: 'init' });

    const messages = store.getContext('session-1');
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('你好');
    expect(messages[0].intent).toBe('greeting');
    expect(messages[0].emotion).toBe('neutral');
    expect(messages[0].stage).toBe('init');
    expect(messages[0].created_at).toBeDefined();
  });
});

// --- Test Case 2: getContext respects limit parameter ---
describe('getContext limit', () => {
  it('returns at most `limit` messages', () => {
    for (let i = 0; i < 10; i++) {
      store.addMessage('session-limit', 'user', `msg-${i}`);
    }

    const messages = store.getContext('session-limit', 3);
    expect(messages).toHaveLength(3);
  });
});

// --- Test Case 3: getContext returns messages in chronological order ---
describe('getContext chronological order', () => {
  it('returns messages ordered by created_at ascending', () => {
    store.addMessage('session-order', 'user', 'first');
    store.addMessage('session-order', 'assistant', 'second');
    store.addMessage('session-order', 'user', 'third');

    const messages = store.getContext('session-order');
    expect(messages.map(m => m.content)).toEqual(['first', 'second', 'third']);
  });
});

// --- Test Case 4: incrementBargainCount starts at 0 and increments ---
describe('incrementBargainCount', () => {
  it('starts at 0 and increments correctly', () => {
    expect(store.getBargainCount('session-bargain')).toBe(0);

    store.incrementBargainCount('session-bargain');
    expect(store.getBargainCount('session-bargain')).toBe(1);

    store.incrementBargainCount('session-bargain');
    store.incrementBargainCount('session-bargain');
    expect(store.getBargainCount('session-bargain')).toBe(3);
  });
});

// --- Test Case 5: updateStage sets stage and getStage retrieves it ---
describe('updateStage + getStage', () => {
  it('sets and retrieves stage', () => {
    store.updateStage('session-stage', 'bargaining');
    expect(store.getStage('session-stage')).toBe('bargaining');
  });
});

// --- Test Case 6: updateStage overwrites previous stage ---
describe('updateStage overwrite', () => {
  it('overwrites previous stage value', () => {
    store.updateStage('session-overwrite', 'init');
    store.updateStage('session-overwrite', 'closing');
    expect(store.getStage('session-overwrite')).toBe('closing');
  });
});

// --- Test Case 7: Multiple sessions are independent ---
describe('session isolation', () => {
  it('messages do not leak between sessions', () => {
    store.addMessage('session-A', 'user', 'hello A');
    store.addMessage('session-B', 'user', 'hello B');
    store.addMessage('session-B', 'assistant', 'reply B');

    const aMessages = store.getContext('session-A');
    const bMessages = store.getContext('session-B');

    expect(aMessages).toHaveLength(1);
    expect(aMessages[0].content).toBe('hello A');

    expect(bMessages).toHaveLength(2);
    expect(bMessages[0].content).toBe('hello B');
    expect(bMessages[1].content).toBe('reply B');
  });

  it('bargain counts are independent per session', () => {
    store.incrementBargainCount('session-A');
    store.incrementBargainCount('session-B');
    store.incrementBargainCount('session-B');

    expect(store.getBargainCount('session-A')).toBe(1);
    expect(store.getBargainCount('session-B')).toBe(2);
  });

  it('stages are independent per session', () => {
    store.updateStage('session-A', 'init');
    store.updateStage('session-B', 'closing');

    expect(store.getStage('session-A')).toBe('init');
    expect(store.getStage('session-B')).toBe('closing');
  });
});
