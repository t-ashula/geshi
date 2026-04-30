const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "u",
  "ul",
]);

const BLOCKED_TAGS = new Set([
  "base",
  "button",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "script",
  "select",
  "style",
  "textarea",
]);

export function sanitizeContentSummary(summary: string): string {
  if (summary.trim() === "") {
    return "";
  }

  if (typeof DOMParser === "undefined") {
    return escapeHtml(summary).replaceAll("\n", "<br>");
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(summary, "text/html");

  return Array.from(document.body.childNodes)
    .map((node) => sanitizeNode(node))
    .join("");
}

export function summarizeContentSummary(summary: string): string {
  if (summary.trim() === "") {
    return "";
  }

  if (typeof DOMParser === "undefined") {
    return normalizeWhitespace(summary.replaceAll(/<[^>]+>/g, " "));
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(summary, "text/html");

  return normalizeWhitespace(
    Array.from(document.body.childNodes)
      .map((node) => extractText(node))
      .join(" "),
  );
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (BLOCKED_TAGS.has(tagName)) {
    return "";
  }

  const children = Array.from(element.childNodes)
    .map((child) => sanitizeNode(child))
    .join("");

  if (!ALLOWED_TAGS.has(tagName)) {
    return children;
  }

  if (tagName === "br") {
    return "<br>";
  }

  if (tagName === "a") {
    const href = sanitizeHref(element.getAttribute("href"));
    const title = sanitizeTitle(element.getAttribute("title"));
    const attributes = [
      href === null ? null : `href="${escapeAttribute(href)}"`,
      title === null ? null : `title="${escapeAttribute(title)}"`,
      href === null ? null : 'rel="noreferrer noopener"',
      href === null ? null : 'target="_blank"',
    ]
      .filter((value) => value !== null)
      .join(" ");

    return attributes === "" ? children : `<a ${attributes}>${children}</a>`;
  }

  return `<${tagName}>${children}</${tagName}>`;
}

function sanitizeHref(href: string | null): string | null {
  if (href === null) {
    return null;
  }

  const trimmedHref = href.trim();

  if (trimmedHref === "") {
    return null;
  }

  try {
    const url = new URL(trimmedHref, "https://example.invalid");

    if (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "mailto:"
    ) {
      return trimmedHref;
    }
  } catch {
    return null;
  }

  return null;
}

function extractText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (BLOCKED_TAGS.has(tagName)) {
    return "";
  }

  return Array.from(element.childNodes)
    .map((child) => extractText(child))
    .join(" ");
}

function sanitizeTitle(title: string | null): string | null {
  if (title === null) {
    return null;
  }

  const trimmedTitle = title.trim();

  return trimmedTitle === "" ? null : trimmedTitle;
}

function normalizeWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
