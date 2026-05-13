export class OpenAIModelClient {
  constructor({ model, baseUrl, apiKey, temperature, topP, timeout }) {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.temperature = temperature;
    this.topP = topP;
    this.timeout = timeout;
  }

  async complete(messages, maxTokens) {
    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const body = {
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature: this.temperature,
      top_p: this.topP,
      stream: false,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout * 1000);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Model API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(`Model error: ${data.error.message || data.error}`);
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(`Model request timed out after ${this.timeout}s`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class FakeModelClient {
  constructor(outputs) {
    this.outputs = [...outputs];
    this.messages = [];
  }

  async complete(messages, _maxTokens) {
    this.messages.push(messages);
    if (!this.outputs.length) throw new Error("fake model ran out of outputs");
    return this.outputs.shift();
  }
}
