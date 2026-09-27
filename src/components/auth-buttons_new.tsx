"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client_new";
import { Button } from "@/components/ui-button_new";

export function LoginButton() {
  async function login() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <Button onClick={login} variant="primary" size="md" className="w-full">
      Google로 시작하기
    </Button>
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
