import { streamText, createGateway } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

// Timeout constants - keep under Vercel Hobby 10s limit
// Gemini needs more time for initial response, but streaming helps
const GROQ_TIMEOUT_MS = 7_000;
const GEMINI_TIMEOUT_MS = 15_000;
const GATEWAY_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
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

// Streaming Groq API call - collects chunks until complete or valid JSON found
async function callGroqAPIStreaming(model: string, prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5, // Lower temperature for more consistent JSON
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error ${response.status}: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(line => line.startsWith("data: "));
      
      for (const line of lines) {
        const data = line.slice(6); // Remove "data: " prefix
        if (data === "[DONE]") continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || "";
          fullText += content;
          
          // Early exit: if we have valid JSON, stop streaming
          const earlyParse = parseAIResponse(fullText);
          if (earlyParse) {
            reader.cancel();
            return fullText;
          }
        } catch {
          // Ignore JSON parse errors for SSE chunks
        }
      }
    }
    
    return fullText;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Streaming Gemini API call using AI SDK
async function callGeminiStreaming(model: string, prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const google = createGoogleGenerativeAI({ apiKey });
  
  const streamPromise = (async () => {
    const result = streamText({
      model: google(model),
      prompt,
      temperature: 0.5,
    });
    
    let fullText = "";
    for await (const chunk of (await result).textStream) {
      fullText += chunk;
      
      // Early exit: if we have valid JSON, stop streaming
      const earlyParse = parseAIResponse(fullText);
      if (earlyParse) {
        return fullText;
      }
    }
    return fullText;
  })();
  
  return withTimeout(streamPromise, timeoutMs, `Gemini streaming for ${model}`);
}

// AI Gateway handles routing to all providers (OpenAI, Anthropic, Google, etc.)
// Uses OIDC authentication automatically when deployed to Vercel
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

interface PromptParams {
  fen: string;
  color: "white" | "black";
  legalMoves: string[];
  lastMoves: string[];
  errorContext?: string;
}

export function buildPrompt(params: PromptParams): string {
  const { fen, color, legalMoves, lastMoves, errorContext } = params;

  let prompt = `You are playing chess as ${color} against another AI model.

Current position (FEN): ${fen}
${lastMoves.length > 0 ? `Recent moves: ${lastMoves.join(", ")}` : "This is the first move."}

CRITICAL: You MUST choose ONE move from this exact list of legal moves:
${legalMoves.join(", ")}

${errorContext ? `IMPORTANT: ${errorContext}\n\n` : ""}Analyze the position and choose your move. Consider:
- Material balance
- Piece activity
- King safety
- Pawn structure

RESPONSE FORMAT - You must respond with ONLY this JSON format:
{"move": "e4", "reasoning": "brief explanation"}

The "move" field MUST be EXACTLY one of the legal moves listed above (e.g., "e4", "Nf3", "O-O").
Do NOT use numbers alone like "4" - use proper chess notation like "e4".
Do NOT add any text before or after the JSON.`;

  return prompt;
}

export function parseAIResponse(response: string): MoveResponse | null {
  if (!response || response.trim().length === 0) return null;
  
  // Multiple extraction strategies for robust JSON parsing
  const strategies = [
    // Strategy 1: Direct JSON match
    () => {
      const match = response.match(/\{[\s\S]*?\}/);
      return match ? match[0] : null;
    },
    // Strategy 2: Extract from markdown code block
    () => {
      const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      return codeBlockMatch ? codeBlockMatch[1] : null;
    },
    // Strategy 3: Find JSON between curly braces more aggressively
    () => {
      const start = response.indexOf("{");
      const end = response.lastIndexOf("}");
      if (start !== -1 && end > start) {
        return response.slice(start, end + 1);
      }
      return null;
    },
    // Strategy 4: Try to fix common JSON issues
    () => {
      let jsonStr = response;
      // Remove markdown formatting
      jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      // Extract potential JSON
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (!match) return null;
      
      let candidate = match[0];
      // Fix common issues: single quotes to double quotes
      candidate = candidate.replace(/'/g, '"');
      // Fix unquoted keys
      candidate = candidate.replace(/(\{|,)\s*(\w+)\s*:/g, '$1"$2":');
      // Remove trailing commas
      candidate = candidate.replace(/,\s*}/g, "}");
      return candidate;
    },
    // Strategy 5: Extract move and reasoning from natural language as last resort
    () => {
      // Look for patterns like "move": "e4" or move: e4 or I play e4
      const movePatterns = [
        /"move"\s*:\s*"([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8][+#]?|O-O(?:-O)?|0-0(?:-0)?)"/i,
        /\bmove[:\s]+([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?|0-0(?:-0)?)\b/i,
        /\bplay(?:ing)?\s+([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?|0-0(?:-0)?)\b/i,
        /\bchoose\s+([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?|0-0(?:-0)?)\b/i,
      ];
      
      for (const pattern of movePatterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          // Try to extract reasoning from the response
          const reasoningMatch = response.match(/"reasoning"\s*:\s*"([^"]+)"|"reason"\s*:\s*"([^"]+)"/i);

          let reasoning: string;
          if (reasoningMatch) {
            reasoning = reasoningMatch[1] || reasoningMatch[2] || "No reasoning provided";
          } else {
            // As a fallback, keep the full natural-language response as the reasoning
            // so the UI shows the actual explanation the model gave, not a placeholder.
            reasoning = response.trim();
          }

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
        console.log(`[parseAIResponse] Successfully parsed with strategy`);
        return validated.data;
      }
    } catch {
      // Try next strategy
    }
  }
  
  console.warn(`[parseAIResponse] All strategies failed for response: ${response.slice(0, 200)}...`);
  return null;
}

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

// Pick a random legal move as fallback when AI fails
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

export async function requestMove(
  modelId: string,
  params: PromptParams,
  retries = 2,
  options?: { groqApiKey?: string; geminiApiKey?: string }
): Promise<MoveResponse> {
  const prompt = buildPrompt(params);
  const isGroq = modelId.startsWith("groq/");
  const isGoogle = modelId.startsWith("google/");

  // Groq uses OpenAI-compatible API
  const groqModel = isGroq ? modelId.replace(/^groq\//, "") : null;
  const groqApiKey = options?.groqApiKey || process.env.GROQ_API_KEY;

  // Google Gemini models
  const googleModel = isGoogle ? modelId.replace(/^google\//, "") : null;
  const geminiApiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY;

  console.log(
    `[requestMove] Model: ${modelId}, isGroq: ${isGroq}, isGoogle: ${isGoogle}, groqKey: ${!!groqApiKey}, geminiKey: ${!!geminiApiKey}`
  );

  let lastError: Error | null = null;
  
  // Try up to 2 attempts with streaming
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[requestMove] Attempt ${attempt}/${retries} for ${modelId}`);
      let text: string;
      
      if (isGroq && groqApiKey) {
        // Use streaming Groq API
        text = await callGroqAPIStreaming(groqModel!, prompt, groqApiKey, GROQ_TIMEOUT_MS);
      } else if (isGoogle && geminiApiKey) {
        // Use streaming Gemini API
        text = await callGeminiStreaming(googleModel!, prompt, geminiApiKey, GEMINI_TIMEOUT_MS);
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
        text = await withTimeout(streamPromise, GATEWAY_TIMEOUT_MS, `Gateway request for ${modelId}`);
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
        lastError = new Error("Failed to parse AI response");
      }

    } catch (error) {
      console.error(`[requestMove] Attempt ${attempt} error:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If timeout on first attempt, try once more with shorter prompt
      if (attempt === 1 && lastError.message.includes("timed out")) {
        console.log(`[requestMove] Timeout on attempt 1, will retry...`);
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
