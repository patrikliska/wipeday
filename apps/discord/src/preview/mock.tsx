/**
 * `pnpm preview` only: a Discord message drawn from the exact payload the bot sends (the
 * Components V2 tree, or a plain text message), in Discord's dark theme, at phone and
 * desktop widths. The agent cannot open Discord; it can look at these PNGs (CLAUDE.md 6.4).
 *
 * An approximation: Discord's own font is gg sans (Roboto Condensed stands in), and of the
 * markdown only what the bot uses is drawn: `## heading`, `-# small print`, `**bold**`
 * and `<t:…:R|f>` timestamps, which Discord shows in the reader's language and zone.
 */
import {
  type APIContainerComponent,
  type APIMessageTopLevelComponent,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Child } from "../render/jsx-runtime";
import { FONT_FAMILY } from "../ui/theme";

/** Discord's dark theme, by eye. */
const D = {
  bg: "#313338",
  container: "#2b2d31",
  border: "#3f4147",
  text: "#dbdee1",
  muted: "#949ba4",
  heading: "#f2f3f5",
  blurple: "#5865f2",
  grey: "#4e5058",
  danger: "#da373c",
  success: "#248046",
  mention: "#c9cdfb",
  timestamp: "#3c3e45",
} as const;

export interface MockInput {
  /** The message as sent: a Components V2 tree, or plain text. */
  components?: APIMessageTopLevelComponent[];
  content?: string;
  /** Attachments by name, as data URIs with their pixel size. */
  images?: Record<string, { uri: string; width: number; height: number }>;
  /** The preview's "now", for timestamps. */
  now: number;
  /** "phone" draws Discord's mobile layout. */
  width: number;
  phone: boolean;
}

/** `in 3 hours`, `2 days ago`: as Discord words a relative timestamp. */
function relativeWords(at: number, now: number): string {
  const delta = at - now;
  const seconds = Math.abs(delta);
  const units: [number, string][] = [
    [86_400 * 30, "month"],
    [86_400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  let text = "a few seconds";
  for (const [size, name] of units) {
    if (seconds >= size) {
      const count = Math.round(seconds / size);
      text = count === 1 ? `${name === "hour" ? "an" : "a"} ${name}` : `${count} ${name}s`;
      break;
    }
  }
  return delta >= 0 ? `in ${text}` : `${text} ago`;
}

function dateWords(at: number): string {
  return new Date(at * 1000).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

interface Token {
  text: string;
  bold: boolean;
  stamp: boolean;
  /** Drawn right against the token before it. */
  glued?: boolean;
}

/** One line of markdown as words, bold and timestamp runs kept apart. */
function tokens(line: string, now: number): Token[] {
  const out: Token[] = [];
  const pattern = /\*\*(.+?)\*\*|<t:(\d+):([Rf])>/g;
  let index = 0;
  const words = (text: string, bold: boolean) => {
    // Escaped markdown (`\_`) shows as the character itself.
    text
      .replace(/\\(.)/g, "$1")
      .split(/\s+/)
      .forEach((word, index) => {
        if (!word) return;
        // Text right after bold or a timestamp, with no space between, sticks to it.
        const previous = out.at(-1);
        const glued = index === 0 && previous !== undefined && (previous.stamp || previous.bold);
        out.push({ text: word, bold, stamp: false, ...(glued && !bold ? { glued } : {}) });
      });
  };
  for (const match of line.matchAll(pattern)) {
    words(line.slice(index, match.index), false);
    if (match[1] !== undefined) words(match[1], true);
    else {
      const at = Number(match[2]);
      out.push({
        text: match[3] === "R" ? relativeWords(at, now) : dateWords(at),
        bold: false,
        stamp: true,
      });
    }
    index = (match.index ?? 0) + match[0].length;
  }
  words(line.slice(index), false);
  return out;
}

function Line(props: { line: string; now: number; size: number; color: string; bold?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        fontSize: props.size,
        lineHeight: `${Math.round(props.size * 1.38)}px`,
        color: props.color,
      }}
    >
      {tokens(props.line, props.now).map((token, index, all) => (
        <span
          style={{
            marginRight: all[index + 1]?.glued ? 0 : props.size * 0.28,
            fontWeight: token.bold || props.bold ? 700 : 400,
            ...(token.stamp
              ? { backgroundColor: D.timestamp, borderRadius: 3, padding: "0 2px" }
              : {}),
          }}
        >
          {token.text}
        </span>
      ))}
    </div>
  );
}

/** A markdown text block: headings, small print and plain lines. */
function Markdown({ text, now }: { text: string; now: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {text.split("\n").map((line) => {
        if (line.trim() === "") return <div style={{ display: "flex", height: 8 }} />;
        if (line.startsWith("## "))
          return <Line line={line.slice(3)} now={now} size={20} color={D.heading} bold />;
        if (line.startsWith("-# "))
          return <Line line={line.slice(3)} now={now} size={12.5} color={D.muted} />;
        return <Line line={line} now={now} size={15} color={D.text} />;
      })}
    </div>
  );
}

const LINK_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#dbdee1" stroke-width="2.4"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  );

function MockButton(props: { label: string; style: number; disabled: boolean; link: boolean }) {
  const background =
    props.style === ButtonStyle.Primary
      ? D.blurple
      : props.style === ButtonStyle.Danger
        ? D.danger
        : props.style === ButtonStyle.Success
          ? D.success
          : D.grey;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 32,
        padding: "0 14px",
        marginRight: 8,
        marginBottom: 8,
        borderRadius: 6,
        backgroundColor: background,
        color: "#ffffff",
        fontSize: 14,
        fontWeight: 700,
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      {props.label}
      {props.link ? (
        <img alt="" src={LINK_ICON} width={14} height={14} style={{ marginLeft: 6 }} />
      ) : null}
    </div>
  );
}

function Container(props: {
  container: APIContainerComponent;
  images: NonNullable<MockInput["images"]>;
  now: number;
  inner: number;
}) {
  const { container, images, now, inner } = props;
  const accent = container.accent_color
    ? `#${container.accent_color.toString(16).padStart(6, "0")}`
    : D.border;
  const blocks: Child[] = container.components.map((component) => {
    switch (component.type) {
      case ComponentType.TextDisplay:
        return (
          <div style={{ display: "flex", marginBottom: 8 }}>
            <Markdown text={component.content} now={now} />
          </div>
        );
      case ComponentType.MediaGallery: {
        const name = component.items[0]?.media.url.replace("attachment://", "") ?? "";
        const image = images[name];
        if (!image) return null;
        const height = Math.round((inner * image.height) / image.width);
        return (
          <div style={{ display: "flex", marginBottom: 8 }}>
            <img alt="" src={image.uri} width={inner} height={height} style={{ borderRadius: 8 }} />
          </div>
        );
      }
      case ComponentType.Separator:
        return (
          <div
            style={{ display: "flex", height: 1, backgroundColor: D.border, margin: "4px 0 12px" }}
          />
        );
      case ComponentType.ActionRow:
        return (
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {component.components.map((button) =>
              button.type === ComponentType.Button ? (
                <MockButton
                  label={"label" in button ? (button.label ?? "") : ""}
                  style={button.style}
                  disabled={button.disabled === true}
                  link={button.style === ButtonStyle.Link}
                />
              ) : null,
            )}
          </div>
        );
      default:
        return null;
    }
  });
  return (
    <div
      style={{
        display: "flex",
        borderRadius: 8,
        backgroundColor: D.container,
        border: `1px solid ${D.border}`,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", width: 4, backgroundColor: accent }} />
      <div style={{ display: "flex", flexDirection: "column", padding: "14px 14px 8px", flex: 1 }}>
        {blocks}
      </div>
    </div>
  );
}

export function MessageMock(input: MockInput) {
  const avatar = input.phone ? 36 : 40;
  const gap = input.phone ? 10 : 16;
  const pad = input.phone ? 12 : 16;
  const body = input.width - pad * 2 - avatar - gap;
  // Container border (2), accent bar (4) and padding (28).
  const inner = body - 34;
  const container = input.components?.find(
    (component): component is APIContainerComponent => component.type === ComponentType.Container,
  );
  return (
    <div
      style={{
        display: "flex",
        width: input.width,
        padding: `${pad}px`,
        backgroundColor: D.bg,
        fontFamily: FONT_FAMILY,
        color: D.text,
      }}
    >
      <div
        style={{
          display: "flex",
          width: avatar,
          height: avatar,
          borderRadius: avatar / 2,
          backgroundColor: "#cd412b",
          flexShrink: 0,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", marginLeft: gap, width: body }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: D.heading, marginRight: 6 }}>
            Wipe Day
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#ffffff",
              backgroundColor: D.blurple,
              borderRadius: 3,
              padding: "1px 4px",
              marginRight: 8,
            }}
          >
            APP
          </span>
          <span style={{ fontSize: 12, color: D.muted }}>Today at 19:20</span>
        </div>
        {container ? (
          <Container
            container={container}
            images={input.images ?? {}}
            now={input.now}
            inner={inner}
          />
        ) : (
          <Markdown text={input.content ?? ""} now={input.now} />
        )}
      </div>
    </div>
  );
}
