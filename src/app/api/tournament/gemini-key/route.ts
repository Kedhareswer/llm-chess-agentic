import { NextResponse } from "next/server";
import { setGeminiApiKey } from "@/lib/api-key-store";
import { SetAPIKeyRequestSchema } from "@/types/api";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  // Sets a server-wide key shared by all games. Admin only.
  const denied = requireAdmin(request);
  if (denied) return denied;

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

  await setGeminiApiKey(key);

  return NextResponse.json({ success: true });
}
