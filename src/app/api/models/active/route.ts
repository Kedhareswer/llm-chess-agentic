import { NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ToggleModelRequestSchema } from "@/types/api";

export async function POST(request: Request) {
  // Validate request body
  const body = await request.json().catch(() => null);
  const validation = ToggleModelRequestSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }
  
  const { id, active } = validation.data;

  await db.update(models).set({ active }).where(eq(models.id, id));

  return NextResponse.json({ success: true });
}
