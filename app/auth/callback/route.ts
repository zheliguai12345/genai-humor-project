import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/utils/supabase/profile";
import { needsNames } from "@/utils/profile";
import { LOGIN_NONCE_COOKIE, matchingCsrf } from "@/utils/auth-validation";

function redirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(LOGIN_NONCE_COOKIE, "", {
    httpOnly: true, secure: true, sameSite: "none", path: "/auth/callback", maxAge: 0,
  });
  return response;
}

// GIS redirect mode sends a standard form POST here, not an OAuth code GET.
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) {
    return redirect(request, "/?error=google-sign-in");
  }
  let form: FormData;
  try { form = await request.formData(); }
  catch { return redirect(request, "/?error=google-sign-in"); }
  const cookieStore = await cookies();
  const nonce = cookieStore.get(LOGIN_NONCE_COOKIE)?.value;
  const credential = form.get("credential");
  if (
    !matchingCsrf(cookieStore.get("g_csrf_token")?.value, form.get("g_csrf_token")) ||
    !nonce || typeof credential !== "string" || !credential || credential.length > 12_000
  ) return redirect(request, "/?error=google-sign-in");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google", token: credential, nonce,
  });
  if (error) return redirect(request, "/?error=google-sign-in");
  const current = await getCurrentProfile();
  if (!current) return redirect(request, "/?error=google-sign-in");
  return redirect(request, needsNames(current.profile) ? "/profile" : "/rate");
}

export async function GET(request: NextRequest) {
  return redirect(request, "/?error=google-sign-in");
}
