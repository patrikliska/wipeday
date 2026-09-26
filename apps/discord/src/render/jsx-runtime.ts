/**
 * A minimal automatic JSX runtime producing the plain `{ type, props }` element
 * tree satori consumes. Wired up through `jsxImportSource: "#jsx"` (tsconfig)
 * and the `imports` map (package.json), so card files need no JSX import and
 * the project carries no React dependency.
 *
 * Function components are called eagerly: a finished tree holds only
 * intrinsic elements, which also makes it directly snapshot-able.
 */

export type Style = Record<string, string | number | undefined>;

export interface Node {
  type: string;
  props: Record<string, unknown> & { children?: Child };
}

export type Child = Node | string | number | boolean | null | undefined | Child[];

type Component<P> = (props: P) => Node;

function normalise(children: Child): Array<Node | string> {
  if (children === null || children === undefined || typeof children === "boolean") return [];
  if (Array.isArray(children)) return children.flatMap(normalise);
  return [typeof children === "number" ? String(children) : children];
}

export function jsx<P extends { children?: Child }>(type: string | Component<P>, props: P): Node {
  if (typeof type === "function") return type(props);
  const { children, ...rest } = props;
  const flat = normalise(children);
  return {
    type,
    props: flat.length === 0 ? rest : { ...rest, children: flat.length === 1 ? flat[0] : flat },
  };
}

export const jsxs = jsx;
export const jsxDEV = jsx;

interface HtmlProps {
  style?: Style;
  children?: Child;
}

interface ImgProps {
  src: string;
  width: number;
  height: number;
  style?: Style;
}

export namespace JSX {
  export type Element = Node;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicElements {
    div: HtmlProps;
    span: HtmlProps;
    img: ImgProps;
  }
}
