import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { message: "Public endpoint not yet fully implemented." },
    { status: 501 }
  );
}
