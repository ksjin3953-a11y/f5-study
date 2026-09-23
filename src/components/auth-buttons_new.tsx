"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client_new";

export function LoginButton() {
  async function login() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button
      onClick={login}
      className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-900 px-6 font-medium text-white transition-colors hover:bg-zinc-700 sm:w-auto"
    >
      Google로 시작하기
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="h-10 rounded-full border border-zinc-300 px-5 text-sm transition-colors hover:bg-zinc-100"
    >
      로그아웃
    </button>
  );
}
