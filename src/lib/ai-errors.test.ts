import { describe, it, expect, vi } from "vitest";
import { APIKeyError, RateLimitError, TimeoutError, ParseError } from "./errors";

// Mock the AI SDK and Google SDK
vi.mock("ai", () => ({
  streamText: vi.fn(),
  createGateway: vi.fn(() => vi.fn()),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn()),
}));

describe("AI error handling", () => {
  it("should throw APIKeyError for 401 status from Groq", async () => {
    // Mock fetch to return 401
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const { requestMove } = await import("./ai");

    await expect(
      requestMove(
        "groq/llama-3.3-70b-versatile",
        {
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          color: "white",
          legalMoves: ["e4", "d4"],
          lastMoves: [],
        },
        1,
        { groqApiKey: "invalid-key" }
      )
    ).rejects.toThrow(APIKeyError);
  });

  it("should throw RateLimitError for 429 status from Groq", async () => {
    // Mock fetch to return 429
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
      headers: {
        get: (name: string) => (name === "retry-after" ? "60" : null),
      },
    });

    const { requestMove } = await import("./ai");

    await expect(
      requestMove(
        "groq/llama-3.3-70b-versatile",
        {
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          color: "white",
          legalMoves: ["e4", "d4"],
          lastMoves: [],
        },
        1,
        { groqApiKey: "test-key" }
      )
    ).rejects.toThrow(RateLimitError);
  });

  it("should throw ParseError when AI response cannot be parsed", async () => {
    // Mock fetch to return unparseable response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"This is not a valid move response"}}]}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
          cancel: vi.fn(),
        }),
      },
    });

    const { requestMove } = await import("./ai");

    await expect(
      requestMove(
        "groq/llama-3.3-70b-versatile",
        {
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          color: "white",
          legalMoves: ["e4", "d4"],
          lastMoves: [],
        },
        1,
        { groqApiKey: "test-key" }
      )
    ).rejects.toThrow(ParseError);
  });
});
