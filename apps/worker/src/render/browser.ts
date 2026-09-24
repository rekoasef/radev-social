import { type Browser, chromium } from "playwright";

// One Chromium for the whole worker: launching it per job would add seconds to each render.

let browser: Promise<Browser> | undefined;

export function getBrowser(): Promise<Browser> {
  browser ??= chromium.launch();
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (!browser) return;
  const current = browser;
  browser = undefined;
  await (await current).close();
}
