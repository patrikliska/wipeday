import { describe, expect, it } from "vitest";
import { ApiError, httpApi } from "./api";

const NIA = { id: "123456789012345678", name: "Nia 🌊", avatarUrl: null };

function recorder(status = 200, body: unknown = { ok: true }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { calls, fetcher };
}

describe("the API client", () => {
  it("acts for the Discord user with the service token", async () => {
    const { calls, fetcher } = recorder();
    const api = httpApi("http://api:8787", "t".repeat(40), fetcher);
    await api.command(NIA, "discord:1", { type: "collect" });
    const call = calls[0];
    expect(call?.url).toBe("http://api:8787/api/bot/commands");
    const headers = call?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${"t".repeat(40)}`);
    expect(headers["x-discord-id"]).toBe(NIA.id);
    expect(decodeURIComponent(headers["x-discord-name"] ?? "")).toBe(NIA.name);
    expect(JSON.parse(String(call?.init.body))).toEqual({
      key: "discord:1",
      command: { type: "collect" },
    });
  });

  it("sends no token to a development API, and no user for feed acks", async () => {
    const { calls, fetcher } = recorder();
    await httpApi("http://localhost:8787", null, fetcher).ackFeed(42);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
    expect(headers["x-discord-id"]).toBeUndefined();
  });

  it("turns error answers and unreachable servers into ApiError", async () => {
    const forbidden = httpApi("http://api", null, recorder(403).fetcher);
    await expect(forbidden.home(NIA)).rejects.toMatchObject({ status: 403 });
    const down = httpApi("http://api", null, (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch);
    await expect(down.home(NIA)).rejects.toBeInstanceOf(ApiError);
    await expect(down.home(NIA)).rejects.toMatchObject({ status: 0 });
  });
});
