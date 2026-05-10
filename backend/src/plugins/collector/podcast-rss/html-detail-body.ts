import { parse } from "parse5";

import type { ExtractedDetailBody } from "../../types.js";

type Parse5Attribute = {
  name: string;
  value: string;
};

type Parse5Node = {
  attrs?: Parse5Attribute[];
  childNodes?: Parse5Node[];
  nodeName: string;
  tagName?: string;
  value?: string;
};

const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "dd",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const CONTAINER_TAGS = new Set([
  "article",
  "body",
  "div",
  "header",
  "main",
  "section",
  "span",
]);

const DROPPED_TAGS = new Set([
  "button",
  "dialog",
  "embed",
  "fieldset",
  "footer",
  "form",
  "iframe",
  "input",
  "link",
  "meta",
  "nav",
  "noscript",
  "object",
  "option",
  "script",
  "select",
  "style",
  "svg",
  "template",
  "textarea",
]);

const POSITIVE_CONTENT_HINT =
  /(article|body|content|detail|entry|main|page|post|read|story|text)/i;
const NEGATIVE_CONTENT_HINT =
  /(ad|aside|author|banner|breadcrumb|comment|footer|gnav|header|hero|menu|nav|pager|pagination|promo|related|share|side|sns|toc)/i;

export function extractHtmlDetailBody(
  html: string,
  sourceUrl: string | null,
): ExtractedDetailBody | null {
  const document = parse(html) as Parse5Node;
  const body = findFirstElementByTagName(document, "body");
  const root = pickContentRoot(body ?? document);

  if (root === null) {
    return null;
  }

  const bodyHtml = serializeContentRoot(root, sourceUrl).trim();

  if (bodyHtml === "") {
    return null;
  }

  return {
    body: `<article>${bodyHtml}</article>`,
    format: "html",
  };
}

function pickContentRoot(root: Parse5Node): Parse5Node | null {
  const candidates = collectElementNodes(root)
    .map((node) => ({
      node,
      score: scoreContentNode(node),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  if (candidates[0] !== undefined) {
    return candidates[0].node;
  }

  const body = findFirstElementByTagName(root, "body");

  return body ?? root;
}

function collectElementNodes(root: Parse5Node): Parse5Node[] {
  const nodes: Parse5Node[] = [];

  visitNode(root, (node) => {
    if (node.tagName !== undefined) {
      nodes.push(node);
    }
  });

  return nodes;
}

function visitNode(root: Parse5Node, visitor: (node: Parse5Node) => void): void {
  visitor(root);

  for (const childNode of root.childNodes ?? []) {
    visitNode(childNode, visitor);
  }
}

function scoreContentNode(node: Parse5Node): number {
  const tagName = node.tagName;

  if (tagName === undefined) {
    return 0;
  }

  if (DROPPED_TAGS.has(tagName)) {
    return -1000;
  }

  let score = 0;

  if (tagName === "article") {
    score += 200;
  } else if (tagName === "main") {
    score += 160;
  } else if (tagName === "section") {
    score += 80;
  } else if (tagName === "body") {
    score += 40;
  } else if (tagName === "div") {
    score += 20;
  }

  const attrs = readNodeAttributes(node);
  const hintSource = `${attrs.class ?? ""} ${attrs.id ?? ""}`.trim();

  if (hintSource !== "") {
    if (POSITIVE_CONTENT_HINT.test(hintSource)) {
      score += 120;
    }

    if (NEGATIVE_CONTENT_HINT.test(hintSource)) {
      score -= 160;
    }
  }

  score += Math.min(extractTextContent(node).length, 2000) / 10;
  score += countDescendantTags(node, "p") * 12;
  score += countDescendantTags(node, "li") * 4;
  score += countDescendantTags(node, "h1") * 20;
  score += countDescendantTags(node, "h2") * 12;
  score -= countDescendantTags(node, "nav") * 80;
  score -= countDescendantTags(node, "aside") * 60;
  score -= countDescendantTags(node, "footer") * 60;

  return score;
}

function readNodeAttributes(node: Parse5Node): Record<string, string> {
  const entries = node.attrs ?? [];

  return Object.fromEntries(
    entries.map((attribute) => [attribute.name, attribute.value]),
  );
}

function countDescendantTags(root: Parse5Node, tagName: string): number {
  let count = 0;

  visitNode(root, (node) => {
    if (node.tagName === tagName) {
      count += 1;
    }
  });

  return count;
}

function extractTextContent(root: Parse5Node): string {
  const segments: string[] = [];

  visitNode(root, (node) => {
    if (node.nodeName === "#text" && node.value !== undefined) {
      const text = normalizeInlineWhitespace(node.value);

      if (text.trim() !== "") {
        segments.push(text.trim());
      }
    }
  });

  return segments.join(" ").trim();
}

function serializeContentRoot(root: Parse5Node, sourceUrl: string | null): string {
  return serializeChildren(root, {
    insidePreformattedText: false,
    sourceUrl,
  });
}

function serializeChildren(
  root: Parse5Node,
  state: {
    insidePreformattedText: boolean;
    sourceUrl: string | null;
  },
): string {
  return (root.childNodes ?? [])
    .map((childNode) => serializeNode(childNode, state))
    .join("");
}

function serializeNode(
  node: Parse5Node,
  state: {
    insidePreformattedText: boolean;
    sourceUrl: string | null;
  },
): string {
  if (node.nodeName === "#text") {
    const text = node.value ?? "";
    const normalized = state.insidePreformattedText
      ? text
      : normalizeInlineWhitespace(text);

    return normalized.trim() === "" ? "" : escapeHtml(normalized);
  }

  const tagName = node.tagName;

  if (tagName === undefined || DROPPED_TAGS.has(tagName)) {
    return "";
  }

  const nextState = {
    insidePreformattedText:
      state.insidePreformattedText || tagName === "pre" || tagName === "code",
    sourceUrl: state.sourceUrl,
  };
  const serializedChildren = serializeChildren(node, nextState).trim();

  if (ALLOWED_TAGS.has(tagName)) {
    if (tagName === "br" || tagName === "hr") {
      return `<${tagName}>`;
    }

    if (
      serializedChildren === "" &&
      tagName !== "td" &&
      tagName !== "th" &&
      tagName !== "figure"
    ) {
      return "";
    }

    const attributes = serializeAllowedAttributes(
      tagName,
      node.attrs ?? [],
      state.sourceUrl,
    );

    return `<${tagName}${attributes}>${serializedChildren}</${tagName}>`;
  }

  if (CONTAINER_TAGS.has(tagName)) {
    return serializedChildren;
  }

  return serializedChildren;
}

function serializeAllowedAttributes(
  tagName: string,
  attrs: Parse5Attribute[],
  sourceUrl: string | null,
): string {
  if (tagName !== "a") {
    return "";
  }

  const href = attrs.find((attribute) => attribute.name === "href")?.value;
  const resolvedHref = resolveSafeHref(href, sourceUrl);

  if (resolvedHref === null) {
    return "";
  }

  return ` href="${escapeAttribute(resolvedHref)}"`;
}

function resolveSafeHref(
  href: string | undefined,
  sourceUrl: string | null,
): string | null {
  if (href === undefined || href.trim() === "") {
    return null;
  }

  try {
    const resolvedUrl =
      sourceUrl === null ? new URL(href.trim()) : new URL(href.trim(), sourceUrl);
    const protocol = resolvedUrl.protocol.toLowerCase();

    if (protocol !== "http:" && protocol !== "https:") {
      return null;
    }

    return resolvedUrl.toString();
  } catch {
    return null;
  }
}

function findFirstElementByTagName(
  root: Parse5Node,
  tagName: string,
): Parse5Node | null {
  let foundNode: Parse5Node | null = null;

  visitNode(root, (node) => {
    if (foundNode === null && node.tagName === tagName) {
      foundNode = node;
    }
  });

  return foundNode;
}

function normalizeInlineWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
