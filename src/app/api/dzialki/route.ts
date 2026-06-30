import { NextResponse } from "next/server";
import { listaDzialek } from "@/lib/data/sample";

/** Lista dostępnych działek przykładowych (do wyboru w UI). */
export async function GET() {
  return NextResponse.json({ dzialki: listaDzialek() });
}
