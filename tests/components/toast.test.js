// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { showToast, TOAST_MS } from "../../src/ui/components/toast.js";

afterEach(() => vi.useRealTimers());

describe("toast component", () => {
  it("replaces the current toast and hides after 2.5 seconds", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="toast-region" role="status"></div>';
    const region = document.getElementById("toast-region");
    showToast("First");
    const second = showToast("Got it! 1 opened.");
    expect(region.children).toHaveLength(1);
    expect(second.textContent).toBe("Got it! 1 opened.");
    expect(second.querySelector(".toast-check").getAttribute("aria-hidden")).toBe("true");
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(region.textContent).toBe("Got it! 1 opened.");
    vi.advanceTimersByTime(1);
    expect(region.textContent).toBe("");
  });

  it("does nothing without a toast region", () => {
    document.body.innerHTML = "";
    expect(showToast("Hi", document)).toBeNull();
  });
});
