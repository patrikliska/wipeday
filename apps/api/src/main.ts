/**
 * The API process. W1 adds the HTTP server (commands with idempotency keys,
 * one transaction per command, `GET /state`, SSE). Until then it proves the
 * wiring every server process needs: one clock, content validated at boot.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { type Clock, systemClock } from "@wipe-day/domain/clock";

function boot(clock: Clock = systemClock): string {
  const content = loadContent(contentPaths.data, loadLocale());
  const at = new Date(clock.nowMs()).toISOString();
  return `api: content ok (${content.resources.length} resources, ${content.items.length} items) at ${at}; HTTP arrives in W1`;
}

// biome-ignore lint/suspicious/noConsole: the process's one status line until W1 brings a logger.
console.log(boot());
