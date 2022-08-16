const activeTimers = new Map<string, number>();

function flushTimers() {
  const now = Date.now();

  for (const [id, startTime] of activeTimers) {
    const duration = now - startTime;

    const long = Array.from({ length: Math.floor(duration / 1000) })
      .map(() => "!")
      .join("");
    console.info(`Timer ${id} took ${long} ${duration}ms`);
  }

  activeTimers.clear();
}

let i = 0;

export const timer = new Proxy(
  {},
  {
    get(target, propKey) {
      if (propKey === "stop") {
        return flushTimers();
      }

      const id = `${propKey as string}-${i++}`;

      activeTimers.set(id, Date.now());
    },
  }
) as Record<string, void> & { stop: void };
