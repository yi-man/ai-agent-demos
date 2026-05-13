export class InterruptAgentFlow extends Error {
  constructor(...messages) {
    super("InterruptAgentFlow");
    this.name = "InterruptAgentFlow";
    this.messages = messages;
  }
}

export class Submitted extends InterruptAgentFlow {
  constructor(...messages) { super(...messages); this.name = "Submitted"; }
}

export class LimitsExceeded extends InterruptAgentFlow {
  constructor(...messages) { super(...messages); this.name = "LimitsExceeded"; }
}

export class FormatError extends InterruptAgentFlow {
  constructor(...messages) { super(...messages); this.name = "FormatError"; }
}

export class UserInterruption extends InterruptAgentFlow {
  constructor(...messages) { super(...messages); this.name = "UserInterruption"; }
}
