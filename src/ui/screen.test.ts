import { describe, expect, it } from "vitest";
import { type ActionRow, type Button, lintScreen, type Screen } from "./screen";

const button = (customId: string, label: string, extra: Partial<Button> = {}): Button => ({
  customId,
  label,
  style: "secondary",
  ...extra,
});

function screen(kind: Screen["kind"], rows: ActionRow[]): Screen {
  return { id: "test", kind, tone: "neutral", title: "Title", status: "Status", details: [], rows };
}

describe("lintScreen", () => {
  it("passes a well-formed sub-screen", () => {
    const rows: ActionRow[] = [
      {
        kind: "buttons",
        buttons: [
          button("a", "Collect", { style: "primary" }),
          button("b", "Back", { nav: "back" }),
          button("c", "Home", { nav: "home" }),
        ],
      },
    ];
    expect(lintScreen(screen("sub", rows))).toEqual([]);
  });

  it("catches two primaries and a dead end", () => {
    const rows: ActionRow[] = [
      {
        kind: "buttons",
        buttons: [
          button("a", "Collect", { style: "primary" }),
          button("b", "Upgrade", { style: "primary" }),
        ],
      },
    ];
    const problems = lintScreen(screen("sub", rows));
    expect(problems).toContain("needs exactly one primary button, has 2");
    expect(problems).toContain("sub-screen without a Back button");
    expect(problems).toContain("sub-screen without a Home button");
  });

  it("catches long labels, crowded rows and too many rows", () => {
    const crowded: Button[] = [
      button("p", "Go", { style: "primary" }),
      ...[0, 1, 2, 3, 4].map((i) => button(`b${i}`, "A label that is far too long")),
    ];
    const rows: ActionRow[] = [
      { kind: "buttons", buttons: crowded },
      { kind: "buttons", buttons: [button("x", "X")] },
      { kind: "buttons", buttons: [button("y", "Y")] },
      { kind: "buttons", buttons: [button("z", "Z")] },
    ];
    const problems = lintScreen(screen("root", rows));
    expect(problems).toContain("row 1 has 6 buttons, max 5");
    expect(problems).toContain("4 rows, max 3");
    expect(problems.some((p) => p.includes("is 28 chars, max 19"))).toBe(true);
  });

  it("lets a locked button carry its reason, but not be the primary", () => {
    const locked = button("b", "Upgrade · need 2.1k stone", { disabled: true });
    const ok = screen("root", [
      { kind: "buttons", buttons: [button("a", "Gather", { style: "primary" }), locked] },
    ]);
    expect(lintScreen(ok)).toEqual([]);

    const bad = screen("root", [{ kind: "buttons", buttons: [{ ...locked, style: "primary" }] }]);
    expect(lintScreen(bad).some((p) => p.includes("primary button is disabled"))).toBe(true);
  });
});
