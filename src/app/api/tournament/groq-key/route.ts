import { NextResponse } from "next/server";
import { setGroqApiKey } from "@/lib/groq-key-store";

export async function POST(request: Request) {
  const { key } = await request.json();

  if (typeof key !== "string" || key.trim().length === 0) {
    return NextResponse.json({ error: "Missing groq key" }, { status: 400 });
  }

  setGroqApiKey(key);

  return NextResponse.json({ success: true });
}
