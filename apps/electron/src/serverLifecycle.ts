import { serverUrl } from "../../../packages/shared/src/ports";

export async function requestServerShutdown(port: number, token: string, timeoutMs = 1_000): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(`${serverUrl(port)}/_internal/shutdown`, {
      method: "POST",
      headers: { "x-app-token": token },
      signal: controller.signal,
    });
  } catch {
    // The caller waits for process exit and force-stops it if graceful shutdown fails.
  } finally {
    clearTimeout(timeout);
  }
}

export function waitForExit(exit: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (didExit: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(didExit);
    };

    const timeout = setTimeout(() => finish(false), timeoutMs);
    void exit.then(() => finish(true), () => finish(true));
  });
}
