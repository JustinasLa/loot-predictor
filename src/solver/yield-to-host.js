// MessageChannel keeps searches responsive without background-tab timer
// throttling. Every posted message belongs to its own waiting search.
let channel = null;
const waiting = [];

export function yieldToHost() {
  if (typeof MessageChannel === "undefined") {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (!channel) {
    channel = new MessageChannel();
    channel.port1.onmessage = () => {
      waiting.shift()();
      if (waiting.length === 0) {
        // Node ports must not keep the process alive after a search finishes.
        channel.port1.unref?.();
        channel.port2.unref?.();
      }
    };
    channel.port1.start?.();
  }

  return new Promise((resolve) => {
    waiting.push(resolve);
    channel.port1.ref?.();
    channel.port2.ref?.();
    channel.port2.postMessage(0);
  });
}
