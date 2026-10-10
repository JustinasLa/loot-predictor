import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";

afterEach(() => vi.useRealTimers());
const options = { startSeed: 42, cardId: "adventure_Zeus", eventType: "Zeus", maxLevel: 4, openings: 2 };

describe("XP search event-loop yielding", () => {
  it("resolves concurrent waiters in order and releases idle Node ports", async () => {
    vi.resetModules();
    let channel;
    class TestChannel {
      constructor() {
        channel = this;
        this.port1 = { start: vi.fn(), ref: vi.fn(), unref: vi.fn() };
        this.port2 = { postMessage: vi.fn(), ref: vi.fn(), unref: vi.fn() };
      }
    }
    vi.stubGlobal("MessageChannel", TestChannel);
    const { yieldToHost } = await import("../src/solver/yield-to-host.js");
    const resolved = [];
    const first = yieldToHost().then(() => resolved.push("first"));
    const second = yieldToHost().then(() => resolved.push("second"));
    const handler = channel.port1.onmessage;

    handler();
    await first;
    expect(resolved).toEqual(["first"]);
    expect(channel.port1.unref).not.toHaveBeenCalled();
    expect(channel.port1.onmessage).toBe(handler);

    handler();
    await second;
    expect(resolved).toEqual(["first", "second"]);
    for (const port of [channel.port1, channel.port2]) {
      expect(port.ref).toHaveBeenCalledTimes(2);
      expect(port.unref).toHaveBeenCalledOnce();
    }
  });

  it("lets Node exit naturally after native MessageChannel yields", () => {
    const helperUrl = new URL("../src/solver/yield-to-host.js", import.meta.url).href;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { yieldToHost } from ${JSON.stringify(helperUrl)};
      await Promise.all([yieldToHost(), yieldToHost()]);
      await yieldToHost();
      console.log("finished");
    `], { encoding: "utf8", timeout: 5000 });
    expect(output.trim()).toBe("finished");
  });

  it("falls back to timers when MessageChannel is unavailable", async () => {
    vi.resetModules();
    vi.stubGlobal("MessageChannel", undefined);
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 50));
    const { findOptimalXpPath } = await import("../src/solver/xp-path.js");
    const search = findOptimalXpPath(options);
    await vi.runAllTimersAsync();
    expect(await search).toMatchObject({ xp: expect.any(Number), nodesVisited: 2 });
  });

  it.each([true, false])("uses and reuses a MessageChannel with optional start=%s", async (hasStart) => {
    vi.resetModules();
    const start = vi.fn();
    const post = vi.fn();
    const construct = vi.fn();
    class TestChannel {
      constructor() {
        construct();
        this.port1 = hasStart ? { start } : {};
        this.port2 = { postMessage: (value) => {
          post(value);
          queueMicrotask(() => this.port1.onmessage());
        } };
      }
    }
    vi.stubGlobal("MessageChannel", TestChannel);
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 50));
    const { findOptimalXpPath } = await import("../src/solver/xp-path.js");
    const first = await findOptimalXpPath(options);
    const second = await findOptimalXpPath(options);
    expect(first.xp).toBe(second.xp);
    expect(construct).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledTimes(4);
    expect(start).toHaveBeenCalledTimes(hasStart ? 1 : 0);
  });
});
