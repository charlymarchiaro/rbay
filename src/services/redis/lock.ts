import {randomBytes} from "crypto";
import {client} from "$services/redis/client";

type Client = typeof client;

export const withLock = async (key: string, cb: (redisClient: Client, signal: any) => any) => {
  // Initialize a few variables to control retry behaviour
  const retryDelayMs = 100;
  let retries = 20;

  // Generate a random value to store at the lock key
  const token = randomBytes(6).toString('hex');

  // Create the lock key
  const lockKey = `lock:${key}`;

  // Set up a while loop to implement the retry behaviour
  while (retries >= 0) {
    retries--;
    // Try to do a SET NX operation
    const acquired = await client.set(lockKey, token, {
      NX: true,
      // Expiration time
      PX: 2000,
    })

    if (!acquired) {
      // Brief pause (retryDelayMs) and then retry
      await pause(retryDelayMs);
      continue;
    }

    try {
      // If the set is successful, then run the callback
      const signal = {expired: false};
      setTimeout(() => {
        signal.expired = true;
      }, 2000);

      const proxiedClient = buildClientProxy(2000);
      const result = await cb(proxiedClient, signal);
      return result;

    } finally {
      // Unset the locked set
      await client.unlock(lockKey, token);
    }
  }

  await client.del(lockKey);
};

const buildClientProxy = (timeoutMs: number) => {
  const startTime = Date.now();

  const handler = {
    get(target: Client, prop: keyof Client) {
      if (Date.now() >= startTime + timeoutMs) {
        throw new Error('Lock has expired')
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  };

  return new Proxy(client, handler);
};

const pause = (duration: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
};
