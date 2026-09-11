import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}
