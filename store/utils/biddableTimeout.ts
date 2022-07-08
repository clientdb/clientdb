export function createBiddableTimeout(time: number, endCallback: () => void) {
  let currentBidTimeout: ReturnType<typeof setTimeout> | undefined;

  function stopCurrentBid() {
    if (currentBidTimeout) {
      clearTimeout(currentBidTimeout);
      currentBidTimeout = undefined;
    }
  }

  function bid() {
    stopCurrentBid();
    currentBidTimeout = setTimeout(endCallback, time);
  }

  return [bid, stopCurrentBid] as const;
}
