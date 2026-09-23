import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server_new";

// Google 로그인 후 돌아오는 주소. 받은 code를 로그인 세션으로 바꾼다.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=login`);
}
