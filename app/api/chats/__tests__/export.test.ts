import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chat: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockChat = {
  id: "chat_1",
  title: "Test Chat",
  model: "llama3",
  parameters: null,
  createdAt: new Date("2025-06-15T10:00:00Z"),
  updatedAt: new Date("2025-06-15T10:05:00Z"),
  server: { name: "Local" },
  messages: [
    {
      id: "msg_1",
      role: "user",
      content: "Hello",
      images: null,
      promptTokens: null,
      completionTokens: null,
      latencyMs: null,
      createdAt: new Date("2025-06-15T10:00:00Z"),
    },
    {
      id: "msg_2",
      role: "assistant",
      content: "Hi there!",
      images: null,
      promptTokens: 10,
      completionTokens: 5,
      latencyMs: 200,
      createdAt: new Date("2025-06-15T10:00:01Z"),
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/chats/[id]/export", () => {
  it("exports as JSON with Content-Disposition", async () => {
    (prisma.chat.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockChat
    );

    const { GET } = await import("@/app/api/chats/[id]/export/route");
    const req = new NextRequest(
      "http://localhost/api/chats/chat_1/export?format=json"
    );
    const res = await GET(req, { params: { id: "chat_1" } });

    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("Test_Chat.json");

    const data = JSON.parse(await res.text());
    expect(data.title).toBe("Test Chat");
    expect(data.messages).toHaveLength(2);
    expect(data.messages[1].latencyMs).toBe(200);
  });

  it("exports as markdown", async () => {
    (prisma.chat.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockChat
    );

    const { GET } = await import("@/app/api/chats/[id]/export/route");
    const req = new NextRequest(
      "http://localhost/api/chats/chat_1/export?format=markdown"
    );
    const res = await GET(req, { params: { id: "chat_1" } });

    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    const text = await res.text();
    expect(text).toContain("# Test Chat");
    expect(text).toContain("### User");
    expect(text).toContain("Hello");
    expect(text).toContain("### Assistant");
    expect(text).toContain("Hi there!");
    expect(text).toContain("15 tokens");
  });

  it("returns 404 for non-existent chat", async () => {
    (prisma.chat.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const { GET } = await import("@/app/api/chats/[id]/export/route");
    const req = new NextRequest(
      "http://localhost/api/chats/nope/export?format=json"
    );
    const res = await GET(req, { params: { id: "nope" } });

    expect(res.status).toBe(404);
  });

  it("defaults to JSON format when not specified", async () => {
    (prisma.chat.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockChat
    );

    const { GET } = await import("@/app/api/chats/[id]/export/route");
    const req = new NextRequest("http://localhost/api/chats/chat_1/export");
    const res = await GET(req, { params: { id: "chat_1" } });

    expect(res.headers.get("Content-Type")).toContain("application/json");
  });
});
