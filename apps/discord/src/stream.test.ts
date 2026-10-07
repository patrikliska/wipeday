import { describe, expect, it } from "vitest";
import { parseSse } from "./stream";

describe("parseSse", () => {
  it("splits complete events and keeps the rest for later", () => {
    const { events, rest } = parseSse(
      'event: ready\ndata: 1700\n\nevent: feed\ndata: [{"id":1}]\n\nevent: ping\ndata: 17',
    );
    expect(events).toEqual([
      { event: "ready", data: "1700" },
      { event: "feed", data: '[{"id":1}]' },
    ]);
    expect(rest).toBe("event: ping\ndata: 17");
  });

  it("joins multi-line data, skips comments, and reads CRLF", () => {
    const { events } = parseSse(": hello\r\nevent: news\r\ndata: a\r\ndata: b\r\n\r\ndata: x\n\n");
    expect(events).toEqual([
      { event: "news", data: "a\nb" },
      { event: "message", data: "x" },
    ]);
  });
});
