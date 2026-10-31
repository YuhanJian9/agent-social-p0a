import { authed } from "./http.js";

export type AgentEvent = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt?: number;
};

/**
 * Long-poll client for one BYO stub.
 * It records events and does not approve consent or create transfers.
 */
export class StubAgent {
  readonly events: AgentEvent[] = [];
  unauthorized = false;
  private cursor = 0;
  private stopped = false;
  private seen = new Set<number>();
  private loopPromise: Promise<void> | null = null;

  constructor(
    readonly name: string,
    private readonly base: string,
    private token: string,
  ) {}

  start() {
    this.loopPromise = this.loop();
    return this.loopPromise;
  }

  async stop() {
    this.stopped = true;
    await this.loopPromise;
  }

  replaceToken(token: string) {
    this.token = token;
    this.unauthorized = false;
  }

  private async loop() {
    while (!this.stopped) {
      let result;
      try {
        result = await authed(
          this.base,
          this.token,
          `/api/agent/events?cursor=${this.cursor}&timeout=8000`,
        );
      } catch (error) {
        if (this.stopped) return;
        console.log(`[${this.name}] poll failed`, error instanceof Error ? error.message : error);
        await delay(400);
        continue;
      }
      if (result.status === 401) {
        this.unauthorized = true;
        console.log(`[${this.name}] long-poll unauthorized (${String(result.json?.message_key ?? "error.unauthorized")})`);
        return;
      }
      if (result.status !== 200 || !result.json) {
        console.log(`[${this.name}] poll status ${result.status}`);
        await delay(400);
        continue;
      }
      const events = Array.isArray(result.json.events) ? (result.json.events as AgentEvent[]) : [];
      for (const event of events) {
        this.events.push(event);
        console.log(`[${this.name}] ${event.type} ${JSON.stringify(event.payload)}`);
      }
      if (typeof result.json.cursor === "number") this.cursor = result.json.cursor;
    }
  }

  async waitFor(
    type: string,
    predicate?: (payload: Record<string, unknown>) => boolean,
    timeoutMs = 10000,
  ) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = this.events.find(
        (event) =>
          event.type === type &&
          !this.seen.has(event.id) &&
          (!predicate || predicate(event.payload)),
      );
      if (found) {
        this.seen.add(found.id);
        return found;
      }
      if (this.unauthorized) {
        throw new Error(`${this.name} unauthorized while waiting for ${type}`);
      }
      await delay(40);
    }
    throw new Error(`${this.name} timed out waiting for ${type}`);
  }
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function registerManifest(base: string, token: string) {
  return authed(base, token, "/api/agent/manifest", {
    method: "POST",
    body: JSON.stringify({
      protocol_version: "p0a.1",
      transport: "longpoll",
      scopes: ["plaza.post", "plaza.read", "inquiry.create", "inquiry.read", "transfer.read"],
    }),
  });
}
