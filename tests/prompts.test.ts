import { describe, it, expect } from "vitest";
import { fillTemplate } from "@/lib/prompts";

describe("fillTemplate", () => {
  it("replaces a single placeholder", () => {
    expect(fillTemplate("hello {{name}}", { name: "world" })).toBe("hello world");
  });

  it("replaces multiple placeholders", () => {
    expect(fillTemplate("{{a}} and {{b}}", { a: "x", b: "y" })).toBe("x and y");
  });

  it("leaves unresolved placeholders intact", () => {
    expect(fillTemplate("{{a}} and {{b}}", { a: "x" })).toBe("x and {{b}}");
  });

  it("handles numeric values", () => {
    expect(fillTemplate("{{days}} days", { days: 90 })).toBe("90 days");
  });

  it("returns template unchanged when no vars given", () => {
    expect(fillTemplate("no vars here", {})).toBe("no vars here");
  });
});
