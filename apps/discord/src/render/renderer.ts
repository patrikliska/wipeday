/**
 * Rendered image cards: view model -> JSX tree -> SVG (satori) -> PNG (resvg).
 *
 * The cache is keyed by a hash of everything that can change the pixels: the
 * card id, its view model, the output width, which assets exist (and their
 * content hashes), and the locale. Identical state is never rendered twice.
 */
import { createHash } from "node:crypto";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { type AssetRegistry, FONT_FILES } from "../assets/registry";
import { log } from "../log";
import type { Locale } from "../ui/locale";
import { FONT_FAMILY, layout } from "../ui/theme";
import type { Node } from "./jsx-runtime";

/** Interactions are deferred before rendering; this is the budget after. */
export const RENDER_BUDGET_MS = 150;

/** Cached PNGs kept in memory. Cards are ~50-150 KB, so this is ~20 MB worst case. */
const CACHE_ENTRIES = 128;

/** What card components may reach for while a tree is being built. */
export interface RenderContext {
  assets: AssetRegistry;
  locale: Locale;
}

/** A card: a stable id plus a pure function from view model to element tree. */
export interface CardDef<Props> {
  /** Also the file stem in `preview/` and the attachment name. */
  id: string;
  render: (props: Props) => Node;
}

export interface Rendered {
  png: Buffer;
  width: number;
  height: number;
  /** True when the PNG came from the cache. */
  cached: boolean;
  /** Time spent producing it (or looking it up). */
  ms: number;
}

let current: RenderContext | null = null;

/** The active context. Only valid synchronously inside a card's `render`. */
export function useRender(): RenderContext {
  if (!current) throw new Error("useRender() called outside a card render");
  return current;
}

export class Renderer {
  private readonly cache = new Map<string, Rendered>();
  private readonly fonts: Array<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }>;
  private readonly localeFingerprint: string;

  constructor(private readonly context: RenderContext) {
    this.fonts = [
      {
        name: FONT_FAMILY,
        data: context.assets.font(FONT_FILES.regular),
        weight: 400,
        style: "normal",
      },
      {
        name: FONT_FAMILY,
        data: context.assets.font(FONT_FILES.bold),
        weight: 700,
        style: "normal",
      },
    ];
    this.localeFingerprint = createHash("sha256")
      .update(
        context.locale
          .keys()
          .map((key) => `${key}=${context.locale.t(key)}`)
          .join("\n"),
      )
      .digest("hex")
      .slice(0, 16);
  }

  /** The card's element tree. Synchronous and cheap; what snapshot tests compare. */
  tree<Props>(card: CardDef<Props>, props: Props): Node {
    current = this.context;
    try {
      return card.render(props);
    } finally {
      current = null;
    }
  }

  /** The card as SVG (text already converted to paths, so no fonts needed downstream). */
  async svg<Props>(card: CardDef<Props>, props: Props): Promise<string> {
    // satori's element type is React's; our runtime produces the same shape.
    const tree = this.tree(card, props) as unknown as Parameters<typeof satori>[0];
    return satori(tree, { width: layout.cardWidth, fonts: this.fonts });
  }

  /**
   * The card as a PNG, from the cache when state is unchanged. `width` is the
   * output pixel width: by default the design width times `renderScale` (crisp
   * on HiDPI screens); the preview passes 400 to show what a phone displays.
   */
  async render<Props>(
    card: CardDef<Props>,
    props: Props,
    width: number = layout.cardWidth * layout.renderScale,
  ): Promise<Rendered> {
    const started = performance.now();
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          card.id,
          props,
          width,
          this.context.assets.fingerprint,
          this.localeFingerprint,
        ]),
      )
      .digest("hex");

    const hit = this.cache.get(key);
    if (hit) return { ...hit, cached: true, ms: performance.now() - started };

    const svg = await this.svg(card, props);
    const image = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      // Text is already outlines; scanning system fonts would cost ~100 ms for nothing.
      font: { loadSystemFonts: false },
    }).render();
    const rendered: Rendered = {
      png: image.asPng(),
      width: image.width,
      height: image.height,
      cached: false,
      ms: performance.now() - started,
    };
    if (rendered.ms > RENDER_BUDGET_MS) {
      log.warn("card render exceeded the budget", {
        card: card.id,
        ms: Math.round(rendered.ms),
        budget: RENDER_BUDGET_MS,
      });
    }

    if (this.cache.size >= CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, rendered);
    return rendered;
  }
}
