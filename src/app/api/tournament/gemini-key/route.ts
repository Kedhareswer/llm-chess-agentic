import { NextResponse } from "next/server";
import { setGeminiApiKey } from "@/lib/api-key-store";
import { SetAPIKeyRequestSchema } from "@/types/api";

export async function POST(request: Request) {
  // Validate request body
  const body = await request.json().catch(() => null);
  const validation = SetAPIKeyRequestSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }
  
  const { key } = validation.data;

  setGeminiApiKey(key);

  return NextResponse.json({ success: true });
}
