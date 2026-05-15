import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirror of PlanSchema from llm.ts — tested independently
const PlanSchema = z.object({
  blocks: z.array(
    z.object({
      dayNumber: z.number(),
      startTime: z.string(),
      durationMin: z.number(),
      type: z.enum(["deep_work", "review", "rest", "skill_practice"]),
      description: z.string(),
    })
  ),
});

describe("PlanSchema", () => {
  it("accepts a valid plan block", () => {
    const valid = {
      blocks: [
        { dayNumber: 1, startTime: "08:30", durationMin: 60, type: "deep_work", description: "Solve 5 array problems" },
      ],
    };
    expect(() => PlanSchema.parse(valid)).not.toThrow();
  });

  it("accepts all valid block types", () => {
    const types = ["deep_work", "review", "rest", "skill_practice"];
    for (const type of types) {
      expect(() =>
        PlanSchema.parse({ blocks: [{ dayNumber: 1, startTime: "08:00", durationMin: 30, type, description: "test" }] })
      ).not.toThrow();
    }
  });

  it("rejects an invalid block type", () => {
    const invalid = {
      blocks: [{ dayNumber: 1, startTime: "08:30", durationMin: 60, type: "nap", description: "bad" }],
    };
    expect(() => PlanSchema.parse(invalid)).toThrow();
  });

  it("rejects a block missing durationMin", () => {
    const invalid = {
      blocks: [{ dayNumber: 1, startTime: "08:30", type: "rest", description: "test" }],
    };
    expect(() => PlanSchema.parse(invalid)).toThrow();
  });

  it("accepts a multi-day plan", () => {
    const blocks = Array.from({ length: 7 }, (_, i) => ({
      dayNumber: i + 1,
      startTime: "08:00",
      durationMin: 60,
      type: "deep_work" as const,
      description: `Day ${i + 1} block`,
    }));
    expect(() => PlanSchema.parse({ blocks })).not.toThrow();
  });
});
