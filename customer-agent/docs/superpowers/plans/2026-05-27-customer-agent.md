# Customer Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI-based intelligent customer service system for Xiaomi products, with intent routing, emotion analysis, conversation stage tracking, and human handoff.

**Architecture:** IntentRouter (keyword→LLM classification) → specialized Agents → guard filter → handoff check → CLI output. SQLite for chat history, JSON for product data, OpenAI-compatible API for LLM.

**Tech Stack:** Bun + JavaScript (ESM) + OpenAI SDK + bun:sqlite

**Spec:** `docs/superpowers/specs/2026-05-27-customer-agent-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `customer-agent/package.json`
- Create: `customer-agent/.env.example`
- Create: `customer-agent/.env`
- Create: `customer-agent/src/config.mjs`
- Create: `customer-agent/tests/config.test.mjs`

- [ ] Initialize package.json and install deps
- [ ] Create .env.example with LLM config
- [ ] Implement config.mjs (load dotenv, export typed config)
- [ ] Test config loads correctly
- [ ] Commit

---

### Task 2: Product Data + Loader

**Files:**
- Create: `customer-agent/data/products/smartphones.json`
- Create: `customer-agent/data/products/wearables.json`
- Create: `customer-agent/data/products/home.json`
- Create: `customer-agent/src/context/product.mjs`
- Create: `customer-agent/tests/product.test.mjs`

- [ ] Create 3 product JSON files (小米15, 手环9, 电视S85 等)
- [ ] Write failing tests for loadProducts/query/getById/formatDescription
- [ ] Implement product.mjs
- [ ] Run tests, verify pass
- [ ] Commit

---

### Task 3: Chat Store (SQLite)

**Files:**
- Create: `customer-agent/src/context/store.mjs`
- Create: `customer-agent/tests/store.test.mjs`

- [ ] Write failing tests for addMessage/getContext/incrementBargainCount/updateStage
- [ ] Implement store.mjs using bun:sqlite
- [ ] Run tests, verify pass
- [ ] Commit

---

### Task 4: Guard (Safety Filter)

**Files:**
- Create: `customer-agent/src/agent/guard.mjs`
- Create: `customer-agent/tests/guard.test.mjs`

- [ ] Write failing tests for sensitive word detection
- [ ] Implement guard.mjs (banned phrases list + replacement)
- [ ] Run tests, verify pass
- [ ] Commit

---

### Task 5: Prompts

**Files:**
- Create: `customer-agent/data/prompts/classify.txt`
- Create: `customer-agent/data/prompts/consult.txt`
- Create: `customer-agent/data/prompts/price.txt`
- Create: `customer-agent/data/prompts/objection.txt`
- Create: `customer-agent/data/prompts/closing.txt`
- Create: `customer-agent/data/prompts/aftersales.txt`
- Create: `customer-agent/data/prompts/chitchat.txt`

- [ ] Write all 7 prompt files with complete content
- [ ] Commit

---

### Task 6: Base Agent + ClassifyAgent

**Files:**
- Create: `customer-agent/src/agent/base-agent.mjs`
- Create: `customer-agent/src/agent/classifier.mjs`
- Create: `customer-agent/tests/classifier.test.mjs`

- [ ] Implement BaseAgent (load prompt, build messages, call LLM, return parsed result)
- [ ] Implement ClassifyAgent (return {intent, emotion, stage, sensitive?, sensitive_reason?})
- [ ] Integration test with real LLM API
- [ ] Commit

---

### Task 7: Specialized Agents

**Files:**
- Create: `customer-agent/src/agent/agents.mjs`
- Create: `customer-agent/tests/agents.test.mjs`

- [ ] Implement 6 agents: Consult, Price, Objection, Closing, Aftersales, Chitchat
- [ ] PriceAgent: dynamic temperature, bargain count injection
- [ ] Integration test: each agent with real LLM
- [ ] Commit

---

### Task 8: Intent Router

**Files:**
- Create: `customer-agent/src/agent/router.mjs`
- Create: `customer-agent/tests/router.test.mjs`

- [ ] Write failing tests for keyword/regex matching
- [ ] Implement Tier 1 (keyword rules)
- [ ] Implement Tier 2 (LLM classify fallback)
- [ ] Test full routing flow
- [ ] Commit

---

### Task 9: Handoff Detection

**Files:**
- Create: `customer-agent/src/handoff.mjs`
- Create: `customer-agent/tests/handoff.test.mjs`

- [ ] Implement rule-based sensitive detection (bargain limit, guard hit, angry streak)
- [ ] Implement draft approval flow (y/e/r prompt)
- [ ] Implement /human /ai /status commands
- [ ] Test
- [ ] Commit

---

### Task 10: CLI Main Loop

**Files:**
- Create: `customer-agent/src/index.mjs`

- [ ] Implement REPL loop: read input → route → agent → guard → handoff → output
- [ ] Wire up all modules
- [ ] Manual test end-to-end
- [ ] Commit

---

### Task 11: Demo Script

**Files:**
- Create: `customer-agent/examples/demo.mjs`

- [ ] Create demo script that runs through a sample conversation
- [ ] Test
- [ ] Commit
