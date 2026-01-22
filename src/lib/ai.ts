import { generateText, createGateway } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

// Direct Groq API call (AI SDK v5 uses responses API which Groq doesn't support)
async function callGroqAPI(model: string, prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// AI Gateway handles routing to all providers (OpenAI, Anthropic, Google, etc.)
// Uses OIDC authentication automatically when deployed to Vercel
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY, // Optional - falls back to OIDC on Vercel
});

const MoveResponseSchema = z.object({
  move: z.string(),
  reasoning: z.string(),
});

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
Legal moves: ${legalMoves.join(", ")}

${errorContext ? `IMPORTANT: ${errorContext}\n\n` : ""}Analyze the position and choose your move. Consider:
- Material balance
- Piece activity
- King safety
- Pawn structure

Respond with valid JSON only:
{"move": "your_move", "reasoning": "brief explanation"}`;

  return prompt;
}

export function parseAIResponse(response: string): MoveResponse | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    const validated = MoveResponseSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function requestMove(
  modelId: string,
  params: PromptParams,
  retries = 3,
  options?: { groqApiKey?: string; geminiApiKey?: string }
): Promise<MoveResponse> {
  const prompt = buildPrompt(params);

  // Groq uses OpenAI-compatible API
  const isGroq = modelId.startsWith("groq/");
  const groqModel = isGroq ? modelId.replace(/^groq\//, "") : null;
  const groqApiKey = options?.groqApiKey || process.env.GROQ_API_KEY;

  // Google Gemini models
  const isGoogle = modelId.startsWith("google/");
  const googleModel = isGoogle ? modelId.replace(/^google\//, "") : null;
  const geminiApiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY;

  console.log(
    `[requestMove] Model: ${modelId}, isGroq: ${isGroq}, isGoogle: ${isGoogle}, groqKey: ${!!groqApiKey}, geminiKey: ${!!geminiApiKey}`
  );

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[requestMove] Attempt ${attempt}/${retries} for ${modelId}`);
      let text: string;
      
      if (isGroq && groqApiKey) {
        // Use direct API call for Groq (AI SDK v5 uses responses API which Groq doesn't support)
        text = await callGroqAPI(groqModel!, prompt, groqApiKey);
      } else if (isGoogle && geminiApiKey) {
        const result = await generateText({
          model: createGoogleGenerativeAI({ apiKey: geminiApiKey })(googleModel!),
          prompt,
          temperature: 0.7,
        });
        text = result.text;
      } else {
        // Use AI Gateway for other providers
        const result = await generateText({
          model: gateway(modelId),
          prompt,
          temperature: 0.7,
        });
        text = result.text;
      }

      const parsed = parseAIResponse(text);
      if (parsed) {
        return parsed;
      }

      // Retry with JSON hint
      params.errorContext = "Your previous response was not valid JSON. Please respond with ONLY valid JSON.";

    } catch (error) {
      console.error(`[requestMove] Attempt ${attempt} error:`, error);
      if (attempt === retries) throw error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  throw new Error(`Failed to get valid move from ${modelId} after ${retries} attempts`);
}
