import { describe, it, expect, vi } from "vitest";
import { APIKeyError, RateLimitError, TimeoutError, ParseError } from "./errors";

// Mock the AI SDK (generateText delegates to real by default; override streamText/createGateway)
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn((...args: unknown[]) => (actual.generateText as (...a: unknown[]) => Promise<{ text: string }>)(...args)),
    streamText: vi.fn(),
    createGateway: vi.fn(() => vi.fn()),
  };
});

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn()),
}));

describe("AI error handling", () => {
  it("should throw APIKeyError for 401 status from Groq", async () => {
    // Mock fetch to return 401 (use Response so SDK gets iterable headers)
    global.fetch = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));

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
    // Mock generateText to throw SDK-style error with statusCode 429 (avoids SDK retry/timeout)
    const err = Object.assign(new Error("Rate limit"), { statusCode: 429 });
    const ai = await import("ai");
    vi.mocked(ai.generateText).mockRejectedValueOnce(err);

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
    // Mock generateText to return unparseable content (SDK uses Responses API; avoid depending on its format)
    const ai = await import("ai");
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: "This is not a valid move response",
    } as Awaited<ReturnType<typeof ai.generateText>>);

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
