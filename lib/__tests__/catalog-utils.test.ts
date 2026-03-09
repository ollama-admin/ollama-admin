import { describe, it, expect } from "vitest";
import { isSizeTag, getSizeTags, getCapabilityTags } from "../catalog-utils";

describe("isSizeTag", () => {
  it("matches common size tags", () => {
    expect(isSizeTag("8b")).toBe(true);
    expect(isSizeTag("70b")).toBe(true);
    expect(isSizeTag("1.5b")).toBe(true);
    expect(isSizeTag("0.5b")).toBe(true);
    expect(isSizeTag("7B")).toBe(true);
    expect(isSizeTag("24b")).toBe(true);
  });

  it("rejects capability tags", () => {
    expect(isSizeTag("vision")).toBe(false);
    expect(isSizeTag("tools")).toBe(false);
    expect(isSizeTag("embedding")).toBe(false);
    expect(isSizeTag("thinking")).toBe(false);
  });

  it("handles whitespace", () => {
    expect(isSizeTag(" 8b ")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(isSizeTag("")).toBe(false);
  });
});

describe("getSizeTags", () => {
  it("extracts size tags from CSV", () => {
    expect(getSizeTags("tools, vision, 8b, 70b")).toEqual(["8b", "70b"]);
  });

  it("returns empty for no sizes", () => {
    expect(getSizeTags("tools, vision")).toEqual([]);
  });

  it("handles size-only tags", () => {
    expect(getSizeTags("8b, 13b, 70b")).toEqual(["8b", "13b", "70b"]);
  });

  it("handles empty string", () => {
    expect(getSizeTags("")).toEqual([]);
  });
});

describe("getCapabilityTags", () => {
  it("extracts capability tags from CSV", () => {
    expect(getCapabilityTags("tools, vision, 8b, 70b")).toEqual(["tools", "vision"]);
  });

  it("returns empty for no capabilities", () => {
    expect(getCapabilityTags("8b, 70b")).toEqual([]);
  });

  it("handles empty string", () => {
    expect(getCapabilityTags("")).toEqual([]);
  });
});
