import { describe, it, expect } from "vitest";
import { parsePullCount, parseModelsFromHtml, inferFamily } from "../catalog-scraper";

describe("parsePullCount", () => {
  it("parses plain numbers", () => {
    expect(parsePullCount("100")).toBe(100);
    expect(parsePullCount("0")).toBe(0);
  });

  it("parses K suffix", () => {
    expect(parsePullCount("929K")).toBe(929000);
    expect(parsePullCount("99.5K")).toBe(99500);
    expect(parsePullCount("1.2K")).toBe(1200);
  });

  it("parses M suffix", () => {
    expect(parsePullCount("1M")).toBe(1000000);
    expect(parsePullCount("1.9M")).toBe(1900000);
    expect(parsePullCount("12.5M")).toBe(12500000);
  });

  it("parses B suffix", () => {
    expect(parsePullCount("1B")).toBe(1000000000);
    expect(parsePullCount("2.5B")).toBe(2500000000);
  });

  it("handles whitespace", () => {
    expect(parsePullCount("  929K  ")).toBe(929000);
  });

  it("returns 0 for invalid input", () => {
    expect(parsePullCount("")).toBe(0);
    expect(parsePullCount("abc")).toBe(0);
  });
});

describe("inferFamily", () => {
  it("infers known families from model name", () => {
    expect(inferFamily("llama3.1")).toBe("llama");
    expect(inferFamily("deepseek-coder")).toBe("deepseek");
    expect(inferFamily("qwen2.5")).toBe("qwen");
    expect(inferFamily("phi3")).toBe("phi");
    expect(inferFamily("gemma2")).toBe("gemma");
    expect(inferFamily("mistral-nemo")).toBe("mistral");
    expect(inferFamily("command-r-plus")).toBe("command-r");
  });

  it("returns empty string for unknown families", () => {
    expect(inferFamily("custom-model")).toBe("");
    expect(inferFamily("lfm2")).toBe("");
  });
});

describe("parseModelsFromHtml", () => {
  const sampleHtml = `
<html><body>
<li x-test-model class="flex items-baseline border-b border-neutral-200 py-6">
  <a href="/library/llama3.1" class="group w-full">
    <div class="flex flex-col mb-1" title="llama3.1">
      <h2 class="truncate text-xl font-medium">
        <span x-test-search-response-title>llama3.1</span>
      </h2>
      <p class="max-w-lg break-words text-neutral-800">Meta's latest open source model.</p>
    </div>
    <div class="flex flex-col">
      <div class="flex flex-wrap space-x-2">
        <span x-test-capability class="inline-flex">tools</span>
        <span x-test-capability class="inline-flex">vision</span>
        <span x-test-size class="inline-flex">8b</span>
        <span x-test-size class="inline-flex">70b</span>
      </div>
      <p class="my-1 flex space-x-5">
        <span class="flex items-center">
          <span x-test-pull-count>1.9M</span>
          <span>&nbsp;Pulls</span>
        </span>
        <span class="flex items-center">
          <span x-test-updated>2 days ago</span>
        </span>
      </p>
    </div>
  </a>
</li>
<li x-test-model class="flex items-baseline border-b border-neutral-200 py-6">
  <a href="/library/lfm2" class="group w-full">
    <div class="flex flex-col mb-1" title="lfm2">
      <h2 class="truncate text-xl font-medium">
        <span x-test-search-response-title>lfm2</span>
      </h2>
      <p class="max-w-lg break-words text-neutral-800">Lightweight model.</p>
    </div>
    <div class="flex flex-col">
      <div class="flex flex-wrap space-x-2">
        <span x-test-size class="inline-flex">24b</span>
      </div>
      <p class="my-1 flex space-x-5">
        <span class="flex items-center">
          <span x-test-pull-count>929K</span>
        </span>
        <span class="flex items-center">
          <span x-test-updated>1 week ago</span>
        </span>
      </p>
    </div>
  </a>
</li>
</body></html>`;

  it("parses model entries from HTML", () => {
    const models = parseModelsFromHtml(sampleHtml, "");
    expect(models).toHaveLength(2);
  });

  it("extracts model name and id", () => {
    const models = parseModelsFromHtml(sampleHtml, "");
    expect(models[0].name).toBe("llama3.1");
    expect(models[0].id).toBe("llama3.1");
    expect(models[1].name).toBe("lfm2");
    expect(models[1].id).toBe("lfm2");
  });

  it("extracts description", () => {
    const models = parseModelsFromHtml(sampleHtml, "");
    expect(models[0].description).toBe("Meta's latest open source model.");
  });

  it("extracts tags (capabilities + sizes)", () => {
    const models = parseModelsFromHtml(sampleHtml, "");
    expect(models[0].tags).toBe("tools, vision, 8b, 70b");
    expect(models[1].tags).toBe("24b");
  });

  it("parses pull count", () => {
    const models = parseModelsFromHtml(sampleHtml, "");
    expect(models[0].pullCount).toBe(1900000);
    expect(models[1].pullCount).toBe(929000);
  });

  it("extracts last updated", () => {
    const models = parseModelsFromHtml(sampleHtml, "");
    expect(models[0].lastUpdated).toBe("2 days ago");
    expect(models[1].lastUpdated).toBe("1 week ago");
  });

  it("infers family from model name when no category", () => {
    const models = parseModelsFromHtml(sampleHtml, "");
    expect(models[0].family).toBe("llama");
    expect(models[1].family).toBe("");
  });

  it("uses category as family when provided", () => {
    const models = parseModelsFromHtml(sampleHtml, "vision");
    expect(models[0].family).toBe("vision");
    expect(models[1].family).toBe("vision");
  });

  it("handles empty HTML", () => {
    const models = parseModelsFromHtml("<html><body></body></html>", "");
    expect(models).toHaveLength(0);
  });

  it("excludes cloud-only models (no sizes + cloud badge)", () => {
    const cloudOnlyHtml = `
<html><body>
<li x-test-model class="flex">
  <a href="/library/cloud-model" class="group w-full">
    <div class="flex flex-col mb-1" title="cloud-model">
      <h2><span x-test-search-response-title>cloud-model</span></h2>
      <p class="max-w-lg break-words text-neutral-800">A cloud-only model.</p>
    </div>
    <div class="flex flex-col">
      <div class="flex flex-wrap space-x-2">
        <span x-test-capability class="inline-flex">tools</span>
        <span class="inline-flex bg-cyan-50 text-cyan-500">cloud</span>
      </div>
      <p><span class="flex"><span x-test-pull-count>500K</span></span></p>
    </div>
  </a>
</li>
<li x-test-model class="flex">
  <a href="/library/local-model" class="group w-full">
    <div class="flex flex-col mb-1" title="local-model">
      <h2><span x-test-search-response-title>local-model</span></h2>
      <p class="max-w-lg break-words text-neutral-800">A local model.</p>
    </div>
    <div class="flex flex-col">
      <div class="flex flex-wrap space-x-2">
        <span x-test-capability class="inline-flex">tools</span>
        <span class="inline-flex bg-cyan-50 text-cyan-500">cloud</span>
        <span x-test-size class="inline-flex">8b</span>
      </div>
      <p><span class="flex"><span x-test-pull-count>1M</span></span></p>
    </div>
  </a>
</li>
</body></html>`;
    const models = parseModelsFromHtml(cloudOnlyHtml, "");
    expect(models).toHaveLength(1);
    expect(models[0].name).toBe("local-model");
  });
});
