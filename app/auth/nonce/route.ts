import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { LOGIN_NONCE_COOKIE } from "@/utils/auth-validation";

export async function GET(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return new NextResponse(null, { status: 403 });
  }
  const nonce = randomBytes(32).toString("hex");
  const response = NextResponse.json({ nonce: createHash("sha256").update(nonce).digest("hex") });
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(LOGIN_NONCE_COOKIE, nonce, {
    httpOnly: true, secure: true, sameSite: "none", path: "/auth/callback", maxAge: 600,
  });
  return response;
}
