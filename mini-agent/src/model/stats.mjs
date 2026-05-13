export class GlobalModelStats {
  constructor({ costLimit = 0, callLimit = 0 } = {}) {
    this._cost = 0;
    this._nCalls = 0;
    this.costLimit = costLimit || Number(process.env.MSWEA_GLOBAL_COST_LIMIT || "0");
    this.callLimit = callLimit || Number(process.env.MSWEA_GLOBAL_CALL_LIMIT || "0");
  }

  add(cost) {
    this._cost += cost;
    this._nCalls += 1;
    if ((this.costLimit > 0 && this._cost > this.costLimit) ||
        (this.callLimit > 0 && this._nCalls > this.callLimit)) {
      throw new Error(`Global cost/call limit exceeded: $${this._cost.toFixed(4)} / ${this._nCalls}`);
    }
  }

  get cost() { return this._cost; }
  get nCalls() { return this._nCalls; }
}

export const globalModelStats = new GlobalModelStats();
