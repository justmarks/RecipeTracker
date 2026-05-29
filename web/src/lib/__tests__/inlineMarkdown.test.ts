import { describe, it, expect } from "vitest";
import React from "react";
import { isSafeUrl, renderInlineMarkdown } from "../inlineMarkdown";

describe("isSafeUrl", () => {
  it("allows http:// URLs", () => {
    expect(isSafeUrl("http://example.com")).toBe(true);
  });

  it("allows https:// URLs", () => {
    expect(isSafeUrl("https://example.com/recipe")).toBe(true);
  });

  it("allows mailto: URLs", () => {
    expect(isSafeUrl("mailto:user@example.com")).toBe(true);
  });

  it("blocks javascript: scheme", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("blocks javascript: with leading whitespace", () => {
    expect(isSafeUrl("  javascript:alert(1)")).toBe(false);
  });

  it("blocks data: URLs", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("blocks vbscript: scheme", () => {
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("blocks empty string", () => {
    expect(isSafeUrl("")).toBe(false);
  });

  it("blocks bare path with no scheme", () => {
    expect(isSafeUrl("/recipes/123")).toBe(false);
  });
});

describe("renderInlineMarkdown", () => {
  it("returns plain string for text with no markup", () => {
    const result = renderInlineMarkdown("plain text");
    expect(result).toEqual(["plain text"]);
  });

  it("wraps **bold** in <strong>", () => {
    const result = renderInlineMarkdown("Mix **well** before serving.");
    const strong = result.find(
      (n) => React.isValidElement(n) && n.type === "strong",
    ) as React.ReactElement<{ children: string }> | undefined;
    expect(strong).toBeDefined();
    expect(strong?.props.children).toBe("well");
  });

  it("wraps [label](url) in <a> for safe URLs", () => {
    const result = renderInlineMarkdown(
      "See [recipe source](https://example.com).",
    );
    const anchor = result.find(
      (n) => React.isValidElement(n) && n.type === "a",
    ) as React.ReactElement<{
      href: string;
      children: string;
      target: string;
      rel: string;
    }> | undefined;
    expect(anchor).toBeDefined();
    expect(anchor?.props.href).toBe("https://example.com");
    expect(anchor?.props.children).toBe("recipe source");
    expect(anchor?.props.target).toBe("_blank");
    expect(anchor?.props.rel).toContain("noreferrer");
  });

  it("renders label as plain text for unsafe link URLs", () => {
    const result = renderInlineMarkdown(
      "Click [here](javascript:alert(1)) to continue.",
    );
    expect(result.some((n) => React.isValidElement(n) && n.type === "a")).toBe(
      false,
    );
    expect(result.some((n) => n === "here")).toBe(true);
  });

  it("preserves surrounding text around bold", () => {
    const result = renderInlineMarkdown("Add **2 cups** flour.");
    expect(result[0]).toBe("Add ");
    const strong = result[1] as React.ReactElement<{ children: string }>;
    expect(strong.props.children).toBe("2 cups");
    expect(result[2]).toBe(" flour.");
  });

  it("handles multiple bold spans", () => {
    const result = renderInlineMarkdown("**A** and **B**");
    const strongs = result.filter(
      (n) => React.isValidElement(n) && n.type === "strong",
    );
    expect(strongs).toHaveLength(2);
  });

  it("returns empty array for empty string", () => {
    const result = renderInlineMarkdown("");
    expect(result).toEqual([]);
  });

  it("passes through text with no special chars as single string", () => {
    const result = renderInlineMarkdown("just plain text here");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("just plain text here");
  });
});
