import { config } from "dotenv";
import { generateText, createGateway } from "ai";

config({ path: ".env.local" });

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const MODELS_TO_TEST = [
  "openai/gpt-5.1-thinking",
  "anthropic/claude-opus-4.5",
  "google/gemini-3-pro-preview",
  "xai/grok-4-fast-reasoning",
  "deepseek/deepseek-v3",
  "meta/llama-4-maverick",
];

async function testModel(modelId: string): Promise<void> {
  try {
    const { text } = await generateText({
      model: gateway(modelId),
      prompt: "What model are you? Reply with just your model name/version in 10 words or less.",
    });
    console.log(`${modelId}:`);
    console.log(`  -> "${text.trim()}"`);
  } catch (error) {
    console.log(`${modelId}: FAILED - ${String(error).slice(0, 80)}`);
  }
}

async function main() {
  console.log("Checking model identities...\n");

  for (const modelId of MODELS_TO_TEST) {
    await testModel(modelId);
  }
}

main().catch(console.error);
