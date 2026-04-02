import { describe, it, expect } from "bun:test";
import { parallelBruteForce } from "./finder.js";

describe("parallelBruteForce", () => {
  it("finds matching salt for simple target", async () => {
    const result = await parallelBruteForce("test-user", { species: "duck" }, null);
    expect(result).not.toBeNull();
    expect(result.salt).toBeDefined();
    expect(result.result.species).toBe("duck");
    expect(result.checked).toBeGreaterThan(0);
    expect(result.elapsed).toBeGreaterThanOrEqual(0);
    expect(result.workers).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it("calls onProgress callback", async () => {
    let progressCalled = false;
    await parallelBruteForce("test-user", { species: "cat" }, (attempts, elapsed, expected, workers) => {
      if (attempts > 0) progressCalled = true;
    });
  }, 30_000);

  it("returns result with compatible shape", async () => {
    const result = await parallelBruteForce("test-user", { species: "blob" }, null);
    expect(result).toHaveProperty("salt");
    expect(result).toHaveProperty("result");
    expect(result).toHaveProperty("checked");
    expect(result).toHaveProperty("elapsed");
    expect(result.result).toHaveProperty("rarity");
    expect(result.result).toHaveProperty("species");
    expect(result.result).toHaveProperty("eye");
    expect(result.result).toHaveProperty("hat");
    expect(result.result).toHaveProperty("shiny");
    expect(result.result).toHaveProperty("stats");
  }, 30_000);
});
