import { NextResponse } from "next/server";
import { getGroqApiKey, getGeminiApiKey } from "@/lib/api-key-store";

export async function GET() {
  return NextResponse.json({
    groqApiKey: !!getGroqApiKey(),
    geminiApiKey: !!getGeminiApiKey(),
  });
}
