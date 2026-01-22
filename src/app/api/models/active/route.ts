import { NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const { id, active } = await request.json();

  if (typeof id !== "string" || typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await db.update(models).set({ active }).where(eq(models.id, id));

  return NextResponse.json({ success: true });
}
