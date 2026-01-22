import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const [state] = await db
    .select()
    .from(tournament)
    .where(eq(tournament.id, 1));

  return NextResponse.json(state);
}
