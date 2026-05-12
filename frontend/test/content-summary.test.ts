import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sanitizeContentSummary,
  summarizeContentSummary,
} from "../src/content-summary.js";

describe("content summary rendering", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sanitizes unsafe html while preserving safe markup", () => {
    const source =
      '<p>Hello <strong>world</strong><script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://example.com/post" onclick="alert(1)">good</a></p>';

    installFakeDomParser({
      [source]: createDocument([
        createElement("p", {}, [
          createText("Hello "),
          createElement("strong", {}, [createText("world")]),
          createElement("script", {}, [createText("alert(1)")]),
          createElement("a", { href: "javascript:alert(1)" }, [
            createText("bad"),
          ]),
          createElement(
            "a",
            {
              href: "https://example.com/post",
              onclick: "alert(1)",
            },
            [createText("good")],
          ),
        ]),
      ]),
    });

    expect(sanitizeContentSummary(source)).toBe(
      '<p>Hello <strong>world</strong>bad<a href="https://example.com/post" rel="noreferrer noopener" target="_blank">good</a></p>',
    );
  });

  it("extracts preview text from html summaries", () => {
    const source =
      "<div><p>Hello</p><p>world</p><script>alert(1)</script></div>";

    installFakeDomParser({
      [source]: createDocument([
        createElement("div", {}, [
          createElement("p", {}, [createText("Hello")]),
          createElement("p", {}, [createText("world")]),
          createElement("script", {}, [createText("alert(1)")]),
        ]),
      ]),
    });

    expect(summarizeContentSummary(source)).toBe("Hello world");
  });

  it("falls back to escaped plain text when dom parsing is unavailable", () => {
    vi.stubGlobal("DOMParser", undefined);

    expect(sanitizeContentSummary("<p>Hello</p>\nworld")).toBe(
      "&lt;p&gt;Hello&lt;/p&gt;<br>world",
    );
    expect(summarizeContentSummary("<p>Hello</p>\nworld")).toBe("Hello world");
  });
});

function installFakeDomParser(documents: Record<string, FakeDocument>): void {
  vi.stubGlobal("Node", {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
  });
  vi.stubGlobal(
    "DOMParser",
    class {
      public parseFromString(source: string): FakeDocument {
        const document = documents[source];

        if (document === undefined) {
          throw new Error(`Unexpected DOMParser input: ${source}`);
        }

        return document;
      }
    },
  );
}

type FakeNode = FakeTextNode | FakeElementNode;

type FakeTextNode = {
  nodeType: number;
  textContent: string;
};

type FakeElementNode = {
  childNodes: FakeNode[];
  getAttribute: (name: string) => string | null;
  nodeType: number;
  tagName: string;
  textContent: string;
};

type FakeDocument = {
  body: {
    childNodes: FakeNode[];
    textContent: string;
  };
};

function createDocument(childNodes: FakeNode[]): FakeDocument {
  return {
    body: {
      childNodes,
      textContent: childNodes.map((node) => node.textContent).join(" "),
    },
  };
}

function createElement(
  tagName: string,
  attributes: Record<string, string>,
  childNodes: FakeNode[],
): FakeElementNode {
  return {
    childNodes,
    getAttribute(name: string): string | null {
      return attributes[name] ?? null;
    },
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    textContent: childNodes.map((node) => node.textContent).join(" "),
  };
}

function createText(textContent: string): FakeTextNode {
  return {
    nodeType: 3,
    textContent,
  };
}
