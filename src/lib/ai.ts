import { streamText, generateText, createGateway } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { APIKeyError, RateLimitError, TimeoutError, ParseError } from "./errors";
import { AI_TIMEOUTS } from "./config";

// Timeout constants - adjusted for each provider's typical response times
// Non-streaming is simpler and more reliable for short JSON responses
// Note: Gemini timeout increased to 30s to handle API slowness and cold starts

/**
 * Wraps a promise with a timeout that rejects with a TimeoutError if the
 * operation takes longer than the specified time.
 * 
 * @param promise - The promise to wrap with timeout
 * @param timeoutMs - The timeout duration in milliseconds
 * @param label - A descriptive label for the operation
 * @returns A promise that resolves with the original result or rejects with TimeoutError
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Makes a non-streaming API call to Groq with the provided parameters.
 * Uses @ai-sdk/openai with Groq baseURL + generateText (same pattern as Gemini).
 *
 * @param model - The Groq model identifier
 * @param prompt - The prompt to send to the model
 * @param apiKey - The API key for Groq
 * @param timeoutMs - The timeout in milliseconds
 * @returns The complete response text from the model
 */
async function callGroqNonStreaming(model: string, prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });

  const textPromise = generateText({
    model: groq(model),
    prompt,
    temperature: 0.5,
    maxOutputTokens: 200,
  }).then((result) => result.text);

  return withTimeout(textPromise, timeoutMs, `Groq request for ${model}`);
}

/**
 * Makes a non-streaming API call to Google Gemini with the provided parameters.
 * Uses generateText for simpler, more reliable responses (no streaming complexity).
 * 
 * @param model - The Gemini model identifier
 * @param prompt - The prompt to send to the model
 * @param apiKey - The API key for Gemini
 * @param timeoutMs - The timeout in milliseconds
 * @returns The complete response text from the model
 */
async function callGeminiNonStreaming(model: string, prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const google = createGoogleGenerativeAI({ apiKey });
  
  // Limit maxTokens to speed up generation and prevent overly long responses
  // Chess moves are short (e.g., "e4", "Nf3"), so 200 tokens is more than enough
  const textPromise = generateText({
    model: google(model),
    prompt,
    temperature: 0.5,
    maxOutputTokens: 200, // Limit response size for faster generation
  }).then(result => result.text);
  
  return withTimeout(textPromise, timeoutMs, `Gemini request for ${model}`);
}

/**
 * Makes a non-streaming API call to Anthropic (Claude) with the provided parameters.
 *
 * @param model - The Anthropic model identifier (e.g. "claude-sonnet-4-5")
 * @param prompt - The prompt to send to the model
 * @param apiKey - The API key for Anthropic
 * @param timeoutMs - The timeout in milliseconds
 * @returns The complete response text from the model
 */
async function callAnthropicNonStreaming(model: string, prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const anthropic = createAnthropic({ apiKey });

  const textPromise = generateText({
    model: anthropic(model),
    prompt,
    temperature: 0.5,
    maxOutputTokens: 200,
  }).then((result) => result.text);

  return withTimeout(textPromise, timeoutMs, `Anthropic request for ${model}`);
}

/**
 * Makes a non-streaming API call to OpenAI (direct) with the provided parameters.
 * Uses the default OpenAI baseURL (unlike the Groq path, which overrides it).
 *
 * @param model - The OpenAI model identifier (e.g. "gpt-4o-mini")
 * @param prompt - The prompt to send to the model
 * @param apiKey - The API key for OpenAI
 * @param timeoutMs - The timeout in milliseconds
 * @returns The complete response text from the model
 */
async function callOpenAINonStreaming(model: string, prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const openai = createOpenAI({ apiKey });

  const textPromise = generateText({
    model: openai(model),
    prompt,
    temperature: 0.5,
    maxOutputTokens: 200,
  }).then((result) => result.text);

  return withTimeout(textPromise, timeoutMs, `OpenAI request for ${model}`);
}

// AI Gateway handles routing to all providers (OpenAI, Anthropic, Google, etc.)
// Uses OIDC authentication automatically when deployed to Vercel.
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY, // Optional - falls back to OIDC on Vercel
});

const MoveResponseSchema = z.object({
  move: z.string(),
  reasoning: z.string().optional(),
  reason: z.string().optional(),
}).transform((data) => ({
  move: data.move,
  reasoning: data.reasoning || data.reason || "No reasoning provided",
}));

type MoveResponse = z.infer<typeof MoveResponseSchema>;

/**
 * Parameters for building chess prompts for AI models
 */
interface PromptParams {
  fen: string;
  color: "white" | "black";
  legalMoves: string[];
  lastMoves: string[];
  lastMovesWithColor?: Array<{ move: string; color: "white" | "black" }>;
  errorContext?: string;
}

/**
 * Builds a prompt for an AI model to make a chess move based on the current game state.
 * 
 * @param params - The parameters for building the prompt
 * @returns A formatted string prompt for the AI model
 */
export function buildPrompt(params: PromptParams): string {
  const { fen, color, legalMoves, lastMoves, lastMovesWithColor, errorContext } = params;

  // Detect repetition patterns - only check moves made by THIS player
  const myRecentMoves = lastMovesWithColor 
    ? lastMovesWithColor
        .filter(m => m.color === color)
        .map(m => m.move)
        .slice(-6)
    : lastMoves.slice(-6); // Fallback if color info not available
  
  let repetitionWarning = "";
  let pieceRepetition = "";
  
  if (myRecentMoves.length >= 4) {
    const lastFewMoves = myRecentMoves.slice(-4);
    
    // Check for A-B-A-B pattern
    if (lastFewMoves.length >= 4 &&
        lastFewMoves[0] === lastFewMoves[2] &&
        lastFewMoves[1] === lastFewMoves[3]) {
      repetitionWarning = "\n\n⚠️ CRITICAL: You are repeating moves! This is poor chess. Vary your play - use different pieces, develop new pieces, create threats. Do NOT repeat the same move pattern.";
    }
    // Check if same move repeated
    else if (lastFewMoves[lastFewMoves.length - 1] === lastFewMoves[lastFewMoves.length - 2]) {
      repetitionWarning = "\n\n⚠️ CRITICAL: You just repeated a move! This is weak play. Use a DIFFERENT piece. Develop undeveloped pieces. Create new threats.";
    }
    
    // Detect if same piece type is being moved repeatedly
    const piecePatterns = myRecentMoves.slice(-4).map(move => {
      if (move.startsWith("O-")) return "K"; // Castling
      if (/^[KQRBN]/.test(move)) return move[0];
      return "P"; // Pawn move
    });
    
    if (piecePatterns.length >= 3 && piecePatterns.every(p => p === piecePatterns[piecePatterns.length - 1])) {
      const pieceName = piecePatterns[0] === "K" ? "king" : piecePatterns[0] === "Q" ? "queen" : piecePatterns[0] === "R" ? "rook" : piecePatterns[0] === "B" ? "bishop" : piecePatterns[0] === "N" ? "knight" : "pawn";
      pieceRepetition = `\n\n⚠️ WARNING: You are moving the same type of piece (${pieceName}) repeatedly! This is weak play. Develop ALL your pieces - use your rooks, bishops, knights, and queen. Coordinate your entire army, not just one or two pieces.`;
    }
  }

  let prompt = `You are playing chess as ${color} against another AI model. Play strong, diverse chess using ALL your pieces.

Current position (FEN): ${fen}
${lastMoves.length > 0 ? `Recent moves: ${lastMoves.join(", ")}` : "This is the first move."}

CRITICAL: You MUST choose ONE move from this exact list of legal moves:
${legalMoves.join(", ")}

${errorContext ? `IMPORTANT: ${errorContext}\n\n` : ""}${repetitionWarning}${pieceRepetition}

STRATEGIC GUIDELINES - Follow these principles:
1. **Use ALL your pieces**: Develop rooks, bishops, knights, and queen. Don't rely on just one or two pieces.
2. **Avoid repetition**: Do NOT repeat moves unnecessarily. If you just moved a piece, consider moving a different piece next.
3. **Piece development**: Get all pieces into active positions. Undeveloped pieces are wasted resources.
4. **Coordinate your army**: Work with multiple pieces together, not in isolation.
5. **Create threats**: Use different pieces to create various threats - don't tunnel vision on one idea.
6. **Material balance**: Consider exchanges and material value.
7. **King safety**: Keep your king safe, especially in the middlegame.
8. **Pawn structure**: Maintain healthy pawn structure and avoid weaknesses.
9. **Control the center**: Centralize your pieces when possible.
10. **Think ahead**: Consider your opponent's responses and plan multiple moves ahead.

${repetitionWarning || pieceRepetition ? "REMEMBER: Strong chess requires using your entire army, not repeating moves with the same pieces!" : ""}

RESPONSE FORMAT - You must respond with ONLY this JSON format:
{"move": "e4", "reasoning": "brief explanation"}

The "move" field MUST be EXACTLY one of the legal moves listed above (e.g., "e4", "Nf3", "O-O").
Do NOT use numbers alone like "4" - use proper chess notation like "e4".
Do NOT add any text before or after the JSON.`;

  return prompt;
}

/**
 * Parses an AI response to extract the move and reasoning.
 * Uses multiple strategies to handle different response formats.
 * 
 * @param response - The raw response string from the AI
 * @returns An object containing the move and reasoning, or null if parsing fails
 */
export function parseAIResponse(response: string): MoveResponse | null {
  if (!response || response.trim().length === 0) return null;
  
  // Three strategies for robust JSON parsing
  const strategies = [
    // Strategy 1: Direct JSON extraction
    () => {
      const match = response.match(/\{[\s\S]*?\}/);
      return match ? match[0] : null;
    },
    
    // Strategy 2: Markdown code block extraction
    () => {
      const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      return codeBlockMatch ? codeBlockMatch[1] : null;
    },
    
    // Strategy 3: Natural language extraction
    () => {
      const movePatterns = [
        /"move"\s*:\s*"([^"]+)"/i,
        /\bwill\s+play\s+([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8][+#]?|O-O(?:-O)?|0-0(?:-0)?)\b/i,
        /\bplay(?:ing)?\s+([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?|0-0(?:-0)?)\b/i,
        /\bmove[:\s]+([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?|0-0(?:-0)?)\b/i,
      ];
      
      for (const pattern of movePatterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          const reasoningMatch = response.match(/"reasoning"\s*:\s*"([^"]+)"/i);
          const reasoning = reasoningMatch ? reasoningMatch[1] : response.trim();
          return JSON.stringify({ move: match[1], reasoning });
        }
      }
      return null;
    },
  ];

  for (const strategy of strategies) {
    try {
      const jsonStr = strategy();
      if (!jsonStr) continue;
      
      const parsed = JSON.parse(jsonStr);
      const validated = MoveResponseSchema.safeParse(parsed);
      
      if (validated.success) {
        return validated.data;
      }
    } catch {
      // Try next strategy
    }
  }
  
  return null;
}

/**
 * Attempts to map an invalid move to a legal move when the AI returns an illegal move.
 * 
 * @param invalidMove - The invalid move returned by the AI
 * @param legalMoves - The list of legal moves in the current position
 * @returns A legal move string or null if no mapping could be found
 */
// Intelligently map invalid moves to legal moves (e.g., "5" -> "e5", "4" -> "e4")
function mapInvalidMoveToLegal(invalidMove: string, legalMoves: string[]): string | null {
  // If it's just a number, try common pawn moves
  if (/^\d$/.test(invalidMove)) {
    const num = invalidMove;
    // Try e4, e5, d4, d5, c4, c5, f4, f5 patterns
    const commonFiles = ['e', 'd', 'c', 'f', 'g', 'b', 'a', 'h'];
    for (const file of commonFiles) {
      const candidate = `${file}${num}`;
      if (legalMoves.includes(candidate)) {
        return candidate;
      }
    }
  }
  
  // If it's a file letter + number (like "e4" but might be malformed)
  const fileNumMatch = invalidMove.match(/([a-h])(\d)/i);
  if (fileNumMatch) {
    const candidate = `${fileNumMatch[1].toLowerCase()}${fileNumMatch[2]}`;
    if (legalMoves.includes(candidate)) {
      return candidate;
    }
  }
  
  return null;
}

/**
 * Picks a random legal move as a fallback when the AI fails to provide a valid response.
 * 
 * @param legalMoves - The list of legal moves in the current position
 * @returns An object containing a random legal move and a fallback reasoning
 */
export function pickRandomMove(legalMoves: string[]): MoveResponse {
  if (legalMoves.length === 0) {
    throw new Error("No legal moves available");
  }
  const randomIndex = Math.floor(Math.random() * legalMoves.length);
  return {
    move: legalMoves[randomIndex],
    reasoning: "Fallback: random legal move due to AI response issues",
  };
}

/**
 * Requests a move from an AI model based on the current game state.
 * Handles different providers (Groq, Google, others) and includes retry logic.
 * 
 * @param modelId - The ID of the model to request a move from
 * @param params - The parameters for building the prompt
 * @param retries - Number of retry attempts (default: 2)
 * @param options - Optional API key overrides
 * @returns A promise that resolves to the AI's move and reasoning
 */
export async function requestMove(
  modelId: string,
  params: PromptParams,
  retries = 2,
  options?: { groqApiKey?: string; geminiApiKey?: string; anthropicApiKey?: string; openaiApiKey?: string }
): Promise<MoveResponse> {
  const prompt = buildPrompt(params);
  const isGroq = modelId.startsWith("groq/");
  const isGoogle = modelId.startsWith("google/");
  const isAnthropic = modelId.startsWith("anthropic/");
  const isOpenAI = modelId.startsWith("openai/");

  // Human-readable provider label used for typed error attribution below.
  const providerLabel = isGroq ? "Groq" : isGoogle ? "Google" : isAnthropic ? "Anthropic" : isOpenAI ? "OpenAI" : "Unknown";

  // Groq uses OpenAI-compatible API
  const groqModel = isGroq ? modelId.replace(/^groq\//, "") : null;
  const groqApiKey = options?.groqApiKey || process.env.GROQ_API_KEY;

  // Google Gemini models
  const googleModel = isGoogle ? modelId.replace(/^google\//, "") : null;
  const geminiApiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY;

  // Anthropic (Claude) models
  const anthropicModel = isAnthropic ? modelId.replace(/^anthropic\//, "") : null;
  const anthropicApiKey = options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

  // OpenAI (direct) models
  const openaiModel = isOpenAI ? modelId.replace(/^openai\//, "") : null;
  const openaiApiKey = options?.openaiApiKey || process.env.OPENAI_API_KEY;

  console.log(
    `[requestMove] Model: ${modelId}, provider: ${providerLabel}, groqKey: ${!!groqApiKey}, geminiKey: ${!!geminiApiKey}, anthropicKey: ${!!anthropicApiKey}, openaiKey: ${!!openaiApiKey}`
  );

  // Check for missing API keys BEFORE attempting requests
  if (isGroq && !groqApiKey) {
    throw new APIKeyError('Groq');
  }
  if (isGoogle && !geminiApiKey) {
    throw new APIKeyError('Google');
  }
  if (isAnthropic && !anthropicApiKey) {
    throw new APIKeyError('Anthropic');
  }
  if (isOpenAI && !openaiApiKey) {
    throw new APIKeyError('OpenAI');
  }

  let lastError: Error | null = null;
  
  // Try up to 2 attempts with non-streaming API calls
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[requestMove] Attempt ${attempt}/${retries} for ${modelId}`);
      let text: string;
      
      if (isGroq && groqApiKey) {
        // Use non-streaming Groq API (simpler and more reliable)
        text = await callGroqNonStreaming(groqModel!, prompt, groqApiKey, AI_TIMEOUTS.GROQ_MS);
      } else if (isGoogle && geminiApiKey) {
        // Use non-streaming Gemini API (more reliable for short JSON responses)
        text = await callGeminiNonStreaming(googleModel!, prompt, geminiApiKey, AI_TIMEOUTS.GEMINI_MS);
      } else if (isAnthropic && anthropicApiKey) {
        // Use non-streaming Anthropic (Claude) API
        text = await callAnthropicNonStreaming(anthropicModel!, prompt, anthropicApiKey, AI_TIMEOUTS.ANTHROPIC_MS);
      } else if (isOpenAI && openaiApiKey) {
        // Use non-streaming OpenAI (direct) API
        text = await callOpenAINonStreaming(openaiModel!, prompt, openaiApiKey, AI_TIMEOUTS.OPENAI_MS);
      } else {
        // Use AI Gateway for other providers (non-streaming fallback)
        const streamPromise = (async () => {
          const result = streamText({
            model: gateway(modelId),
            prompt,
            temperature: 0.5,
          });
          let fullText = "";
          for await (const chunk of (await result).textStream) {
            fullText += chunk;
            const earlyParse = parseAIResponse(fullText);
            if (earlyParse) return fullText;
          }
          return fullText;
        })();
        text = await withTimeout(streamPromise, AI_TIMEOUTS.GATEWAY_MS, `Gateway request for ${modelId}`);
      }

      console.log(`[requestMove] Got response (${text.length} chars): ${text.slice(0, 100)}...`);
      
      const parsed = parseAIResponse(text);
      if (parsed) {
        // Do not auto-map or auto-fix illegal moves here; the judge layer will
        // validate against chess.js and, if needed, warn the model and retry.
        console.log(`[requestMove] Parsed move candidate: ${parsed.move}`);
        return parsed;
      } else {
        console.warn(`[requestMove] Failed to parse response, retrying...`);
        lastError = new ParseError(text);
      }

    } catch (error) {
      console.error(`[requestMove] Attempt ${attempt} error:`, error);
      
      // Detect and throw typed errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCause = (error as any)?.cause;
      const causeMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '');
      
      // Check if it's already a typed error - just pass it through
      if (error instanceof APIKeyError || error instanceof RateLimitError || 
          error instanceof TimeoutError || error instanceof ParseError) {
        lastError = error;
        // For fatal errors (API key, rate limit), throw immediately
        if (error instanceof APIKeyError || error instanceof RateLimitError) {
          throw error;
        }
      } else {
        // Map SDK APICallError (e.g. from @ai-sdk/openai) by statusCode
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 401 || statusCode === 403) {
          const provider = providerLabel;
          lastError = new APIKeyError(provider, statusCode);
          throw lastError;
        }
        if (statusCode === 429) {
          const provider = providerLabel;
          lastError = new RateLimitError(provider);
          throw lastError;
        }

        // Check for Gateway authentication errors (common when API keys are missing)
        if (errorMessage.includes('Gateway') && (errorMessage.includes('authentication') || errorMessage.includes('401') || 
            causeMessage.includes('authentication') || causeMessage.includes('401'))) {
          const provider = providerLabel;
          lastError = new APIKeyError(provider, 401);
          throw lastError;
        }
        
        // Detect API key errors from error messages
        if (errorMessage.includes('401') || errorMessage.includes('403') || 
            errorMessage.includes('Unauthorized') || errorMessage.includes('API key') ||
            errorMessage.includes('Invalid API') || causeMessage.includes('401') || 
            causeMessage.includes('403') || causeMessage.includes('Unauthorized')) {
          const provider = providerLabel;
          lastError = new APIKeyError(provider);
          throw lastError;
        }
        
        // Detect rate limit errors
        if (errorMessage.includes('429') || errorMessage.includes('rate limit') || 
            errorMessage.includes('quota exceeded') || errorMessage.includes('Too Many Requests') ||
            causeMessage.includes('429') || causeMessage.includes('rate limit')) {
          const provider = providerLabel;
          lastError = new RateLimitError(provider);
          throw lastError;
        }
        
        // Detect timeout errors
        if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
          const timeoutMs = isGroq ? AI_TIMEOUTS.GROQ_MS : isGoogle ? AI_TIMEOUTS.GEMINI_MS : isAnthropic ? AI_TIMEOUTS.ANTHROPIC_MS : isOpenAI ? AI_TIMEOUTS.OPENAI_MS : AI_TIMEOUTS.GATEWAY_MS;
          lastError = new TimeoutError(`AI request for ${modelId}`, timeoutMs);
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      // If timeout on first attempt, wait a bit before retrying to avoid hammering the API
      if (attempt === 1 && lastError instanceof TimeoutError) {
        console.log(`[requestMove] Timeout on attempt 1, will retry after brief delay...`);
        // Small delay before retry to avoid hammering slow APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // All retries failed - surface the error so the judge layer can decide whether
  // to warn the model, retry, or eventually forfeit the game. We no longer
  // generate random fallback moves here, because every move should come from
  // the model itself.
  console.warn(`[requestMove] All attempts failed for ${modelId}`);
  throw (lastError ?? new Error(`All attempts failed for ${modelId}`));
}