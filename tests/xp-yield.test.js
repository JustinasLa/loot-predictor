import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.useRealTimers());
const options = { startSeed: 42, cardId: "adventure_Zeus", eventType: "Zeus", maxLevel: 4, openings: 2 };

describe("XP search event-loop yielding", () => {
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
